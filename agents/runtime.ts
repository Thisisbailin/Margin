import { createLLMClient, type LLMStreamChunk, type LLMRegistryConfig } from "../llm";
import { AgentRequest, AgentResponse } from "./types";
import { buildMessages } from "./prompts";
import { createAgentGraph } from "./graph";
import { ToolRegistry, createToolRegistry } from "./tools";

const resolveTask = (task?: AgentRequest["task"]) => task || "freeform";

export type AgentRuntimeConfig = {
  llm?: LLMRegistryConfig;
  tools?: ToolRegistry;
};

const resolveRuntimeConfig = (
  config?: LLMRegistryConfig | AgentRuntimeConfig
): AgentRuntimeConfig => {
  if (!config) return { llm: undefined, tools: createToolRegistry() };
  const looksLikeLLMConfig =
    "provider" in config ||
    "apiKey" in config ||
    "modelAliases" in config ||
    "traffic" in config;
  if (looksLikeLLMConfig) {
    return { llm: config as LLMRegistryConfig, tools: createToolRegistry() };
  }
  return config as AgentRuntimeConfig;
};

export const runAgent = async (
  request: AgentRequest,
  config?: LLMRegistryConfig | AgentRuntimeConfig
): Promise<AgentResponse> => {
  const runtime = resolveRuntimeConfig(config);
  const app = createAgentGraph({ llm: runtime.llm, tools: runtime.tools });

  const initialState = {
    task: resolveTask(request.task),
    input: request.input || "",
    context: request.context,
    history: request.history,
    messages: request.messages,
    model: request.model || "",
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    plan: "",
    toolCalls: [],
    toolResults: [],
    draft: "",
    metadata: {
      source: "agent",
      feature: request.task || "freeform",
      ...(request.metadata || {}),
    },
  };

  const result = await app.invoke(initialState);

  return {
    task: resolveTask(request.task),
    model: result.model || request.model || "",
    text: result.result || "",
    usage: result.usage,
  };
};

export const streamAgent = (
  request: AgentRequest,
  config?: LLMRegistryConfig | AgentRuntimeConfig
): AsyncIterable<LLMStreamChunk> => {
  const runtime = resolveRuntimeConfig(config);
  const llmClient = createLLMClient(runtime.llm);
  const { messages, model } = buildMessages({
    ...request,
    task: resolveTask(request.task),
  });

  return llmClient.stream({
    model,
    messages,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    stream: true,
    metadata: {
      source: "agent",
      feature: request.task || "freeform",
      ...(request.metadata || {}),
    },
  });
};
