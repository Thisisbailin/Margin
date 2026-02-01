import { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../core/types";
import { LLMError, mapHttpStatusToLLMErrorCode } from "../core/errors";

export type QwenProviderConfig = {
  apiKey: string;
  baseUrl: string;
};

type QwenChoice = {
  message?: { content?: unknown };
  delta?: { content?: unknown };
  finish_reason?: string | null;
};

type QwenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

type QwenResponse = {
  choices?: QwenChoice[];
  usage?: QwenUsage;
};

const resolveEndpoint = (baseUrl: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
};

const mapUsage = (usage?: QwenUsage) => {
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const responseTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + responseTokens;
  return { promptTokens, responseTokens, totalTokens };
};

const flattenContent = (content: unknown): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof (part as any)?.text === "string") return (part as any).text;
        if (typeof (part as any)?.content === "string") return (part as any).content;
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof content === "object") {
    const obj = content as { content?: string; text?: string };
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
  }
  return "";
};

const extractText = (data?: QwenResponse): string => {
  if (!data?.choices?.length) return "";
  const choice = data.choices[0];
  const content = choice?.message?.content ?? choice?.delta?.content ?? "";
  return flattenContent(content);
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data?.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
};

export const createQwenProvider = (config: QwenProviderConfig): LLMProvider => {
  const { apiKey, baseUrl } = config;

  const assertApiKey = () => {
    if (!apiKey) throw new LLMError("Unauthorized", "Qwen API key is missing");
  };

  return {
    async generate(req: LLMRequest): Promise<LLMResponse> {
      assertApiKey();
      const endpoint = resolveEndpoint(baseUrl);
      const body: Record<string, unknown> = {
        model: req.model || "qwen-plus",
        messages: req.messages,
      };
      if (typeof req.temperature === "number") body.temperature = req.temperature;
      if (typeof req.maxTokens === "number") body.max_tokens = req.maxTokens;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        const code = mapHttpStatusToLLMErrorCode(response.status);
        throw new LLMError(code, message, response.status);
      }

      const data = (await response.json()) as QwenResponse;
      return {
        text: extractText(data),
        usage: mapUsage(data.usage),
        raw: data,
      };
    },

    async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
      assertApiKey();
      const endpoint = resolveEndpoint(baseUrl);
      const body: Record<string, unknown> = {
        model: req.model || "qwen-plus",
        messages: req.messages,
        stream: true,
      };
      if (typeof req.temperature === "number") body.temperature = req.temperature;
      if (typeof req.maxTokens === "number") body.max_tokens = req.maxTokens;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        const code = mapHttpStatusToLLMErrorCode(response.status);
        throw new LLMError(code, message, response.status);
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emitChunk = (data: QwenResponse): LLMStreamChunk | null => {
        const text = extractText(data);
        const usage = mapUsage(data.usage);
        if (!text && !usage) return null;
        return { text, usage, raw: data };
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const payloadLine = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
          if (payloadLine === "[DONE]") return;
          try {
            const parsed = JSON.parse(payloadLine) as QwenResponse;
            const chunk = emitChunk(parsed);
            if (chunk) yield chunk;
          } catch {
            // ignore non-JSON lines
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        const payloadLine = tail.startsWith("data:") ? tail.slice(5).trim() : tail;
        if (payloadLine !== "[DONE]") {
          try {
            const parsed = JSON.parse(payloadLine) as QwenResponse;
            const chunk = emitChunk(parsed);
            if (chunk) yield chunk;
          } catch {
            // ignore final parse error
          }
        }
      }
    },
  };
};
