# LLM Layer Spec (Draft v1)

This document defines the LLM layer design for Margin. The goal is to provide a stable, low-coupling foundation for Agent and App layers, while supporting multiple providers and edge runtime constraints.

## 1. Scope

### Goals
- Provide a single, stable interface for text generation and streaming.
- Support multiple providers via adapters (v1 实际仅启用 Qwen，其他 provider 预留).
- Isolate provider SDKs and API differences from Agent and App layers.
- Run safely on Cloudflare Pages Functions / Workers.
- Normalize errors, usage, and response formats.
- Support model tier routing (L1, L2, L3) without hardcoding model names in Agents.

### Non-goals (for v1)
- Tool calling abstraction for all providers.
- Full RAG stack or vector search.
- Long-term memory store (handled by Agent/Tools).
- Full observability stack (only minimal logging in v1).

## 2. Layering Boundaries

- LLM layer: only capability access. It knows how to call models and return text/stream.
- Agent layer: capability orchestration. It knows how to build graphs and use tools.
- App layer: product UI and business logic. It should never call providers directly.

The dependency direction must be:

App -> Agent -> LLM

No reverse coupling.

## 3. Runtime Constraints (Cloudflare Pages)

- Use standard Web fetch + streaming APIs (no Node-only APIs).
- Use env variables on the server side only. No API keys in the client bundle.
- Keep functions small and stateless. Persist state elsewhere if needed.

## 4. Public Interfaces

### 4.1 Types

```ts
export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMRequest = {
  model: string;           // resolved model name
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>; // optional tags
};

export type LLMUsage = {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
};

export type LLMResponse = {
  text: string;
  usage?: LLMUsage;
  raw?: unknown;
};

export type LLMStreamChunk = {
  text?: string;
  usage?: LLMUsage;
  raw?: unknown;
};
```

### 4.2 Provider Interface

```ts
export interface LLMProvider {
  generate(req: LLMRequest): Promise<LLMResponse>;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
}
```

### 4.3 Client Interface

```ts
export interface LLMClient {
  generate(req: LLMRequest): Promise<LLMResponse>;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
  withModel(model: string): LLMClient;
}
```

## 5. Model Tier Routing

Agents should request model tiers, not concrete model names. The registry resolves tiers to provider models.

Example tiers:
- L1 -> fast
- L2 -> balanced
- L3 -> deep

Example alias mapping (env-driven):

```
LLM_PROVIDER=qwen
QWEN_API_KEY=your_key_here
LLM_MODEL_L1=qwen-plus
LLM_MODEL_L2=qwen-plus
LLM_MODEL_L3=qwen-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

The LLM registry resolves these at runtime:

```ts
const model = resolveModel("L2");
client.withModel(model).stream(...)
```

## 6. Error Normalization

All provider errors are mapped into a small error set:

- LLMError.InvalidRequest
- LLMError.Unauthorized
- LLMError.RateLimited
- LLMError.Upstream
- LLMError.Timeout

Downstream layers should not handle provider-specific errors.

## 7. Streaming Protocol

LLM layer exposes streaming via Web standard `ReadableStream` or SSE.

Preferred minimal contract:
- Each chunk contains a partial text `delta`.
- Final chunk may contain usage data.

This allows App to render partial output without provider-specific parsing.

## 8. Directory Structure

```
/llm
  /core
    types.ts
    registry.ts
    errors.ts
  /providers
    qwen.ts
    openai.ts (预留)
    openrouter.ts (预留)
  /runtime
    createClient.ts
    stream.ts
```

This stays independent from:

```
/agents
/tools
/functions
```

## 9. Security

- API keys only in server-side env.
- No provider SDK in client bundle.
- Optional allowlist of models to prevent arbitrary usage.

## 10. Initial Integration Plan

1) Implement LLM core types + registry.
2) Add Qwen provider adapter (唯一启用).
3) Expose API endpoints: `POST /api/llm/stream` and `POST /api/llm/generate`.
4) Switch frontend LLM calls to Agent endpoints (not direct provider).

## 11. Migration Notes (from current code)

- Move current LLM 调用逻辑到 `/services/llmClient.ts` + `/services/llmService.ts`，由云端 provider 处理。
- Replace direct `process.env.API_KEY` use in client code.
- Keep prompts in Agent layer, not in provider adapters.
