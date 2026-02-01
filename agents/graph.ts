import { Annotation, StateGraph, START, END } from "@langchain/langgraph/web";
import { createLLMClient, type LLMUsage } from "../llm";
import { AgentRequest } from "./types";
import { buildMessages } from "./prompts";

const AgentState = Annotation.Root({
  task: Annotation<string>(),
  input: Annotation<string>(),
  context: Annotation<Record<string, unknown> | undefined>(),
  history: Annotation<Array<{ role: string; content: string }> | undefined>(),
  messages: Annotation<Array<{ role: string; content: string }>>(),
  model: Annotation<string>(),
  temperature: Annotation<number | undefined>(),
  maxTokens: Annotation<number | undefined>(),
  metadata: Annotation<Record<string, string> | undefined>(),
  result: Annotation<string>(),
  usage: Annotation<LLMUsage | undefined>(),
});

export type AgentGraphState = typeof AgentState.State;

export const createAgentGraph = (config?: {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  modelAliases?: Record<string, string | undefined>;
}) => {
  const llmClient = createLLMClient(config);

  const routerNode = (state: AgentGraphState) => {
    const { messages, model } = buildMessages({
      task: (state.task as AgentRequest["task"]) || "freeform",
      input: state.input,
      context: state.context,
      history: state.history as AgentRequest["history"],
      messages: state.messages as AgentRequest["messages"],
      model: state.model,
    });

    return { messages, model };
  };

  const llmNode = async (state: AgentGraphState) => {
    const response = await llmClient.generate({
      model: state.model,
      messages: state.messages,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      metadata: state.metadata,
    });

    return {
      result: response.text,
      usage: response.usage,
    };
  };

  const graph = new StateGraph(AgentState)
    .addNode("router", routerNode)
    .addNode("llm", llmNode)
    .addEdge(START, "router")
    .addEdge("router", "llm")
    .addEdge("llm", END);

  return graph.compile();
};
