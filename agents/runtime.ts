import { createLLMClient, type LLMStreamChunk, type LLMRegistryConfig } from "../llm";
import { AgentRequest, AgentResponse } from "./types";
import { buildMessages } from "./prompts";
import { createAgentGraph } from "./graph";

const resolveTask = (task?: AgentRequest["task"]) => task || "freeform";

export const runAgent = async (
  request: AgentRequest,
  config?: LLMRegistryConfig
): Promise<AgentResponse> => {
  const app = createAgentGraph(config);

  const initialState = {
    task: resolveTask(request.task),
    input: request.input || "",
    context: request.context,
    history: request.history,
    messages: request.messages,
    model: request.model || "",
    temperature: request.temperature,
    maxTokens: request.maxTokens,
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
  config?: LLMRegistryConfig
): AsyncIterable<LLMStreamChunk> => {
  const llmClient = createLLMClient(config);
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
