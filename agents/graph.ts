import { Annotation, StateGraph, START, END } from "@langchain/langgraph/web";
import { createLLMClient, type LLMUsage, type LLMRegistryConfig } from "../llm";
import { AgentRequest } from "./types";
import { buildMessages, buildPlanMessages, buildActMessages, buildReflectMessages } from "./prompts";
import { ToolCall, ToolResult, ToolRegistry, createToolRegistry } from "./tools";

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
  plan: Annotation<string>(),
  toolCalls: Annotation<ToolCall[]>(),
  toolResults: Annotation<ToolResult[]>(),
  draft: Annotation<string>(),
  result: Annotation<string>(),
  usage: Annotation<LLMUsage | undefined>(),
});

export type AgentGraphState = typeof AgentState.State;

const mergeUsage = (current: LLMUsage | undefined, next: LLMUsage | undefined): LLMUsage | undefined => {
  if (!current && !next) return undefined;
  return {
    promptTokens: (current?.promptTokens || 0) + (next?.promptTokens || 0),
    responseTokens: (current?.responseTokens || 0) + (next?.responseTokens || 0),
    totalTokens: (current?.totalTokens || 0) + (next?.totalTokens || 0),
  };
};

const parsePlan = (text: string): { plan: string; toolCalls: ToolCall[] } => {
  const fallback = { plan: text.trim(), toolCalls: [] as ToolCall[] };
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;
  const jsonText = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonText) as { plan?: string; tool_calls?: ToolCall[] };
    const toolCalls = Array.isArray(parsed.tool_calls)
      ? parsed.tool_calls.filter((call) => call && typeof call.name === "string")
      : [];
    return {
      plan: parsed.plan || text.trim(),
      toolCalls,
    };
  } catch {
    return fallback;
  }
};

export const createAgentGraph = (options?: {
  llm?: LLMRegistryConfig;
  tools?: ToolRegistry;
}) => {
  const llmClient = createLLMClient(options?.llm);
  const toolRegistry = options?.tools || createToolRegistry();

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

  const planNode = async (state: AgentGraphState) => {
    const planMessages = buildPlanMessages(state.messages, toolRegistry.list());
    const response = await llmClient.generate({
      model: state.model,
      messages: planMessages,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      metadata: state.metadata,
    });
    const parsed = parsePlan(response.text || "");
    return {
      plan: parsed.plan,
      toolCalls: parsed.toolCalls,
      usage: mergeUsage(state.usage, response.usage),
    };
  };

  const actNode = async (state: AgentGraphState) => {
    const toolCalls = state.toolCalls || [];
    const toolResults: ToolResult[] = [];
    for (const call of toolCalls) {
      toolResults.push(await toolRegistry.execute(call, { context: state.context, metadata: state.metadata }));
    }

    const actMessages = buildActMessages(state.messages, state.plan, toolResults);
    const response = await llmClient.generate({
      model: state.model,
      messages: actMessages,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      metadata: state.metadata,
    });

    return {
      toolResults,
      draft: response.text,
      usage: mergeUsage(state.usage, response.usage),
    };
  };

  const reflectNode = async (state: AgentGraphState) => {
    const reflectMessages = buildReflectMessages(state.messages, state.draft);
    const response = await llmClient.generate({
      model: state.model,
      messages: reflectMessages,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      metadata: state.metadata,
    });

    return {
      result: response.text,
      usage: mergeUsage(state.usage, response.usage),
    };
  };

  const graph = new StateGraph(AgentState)
    .addNode("router", routerNode)
    .addNode("plan", planNode)
    .addNode("act", actNode)
    .addNode("reflect", reflectNode)
    .addEdge(START, "router")
    .addEdge("router", "plan")
    .addEdge("plan", "act")
    .addEdge("act", "reflect")
    .addEdge("reflect", END);

  return graph.compile();
};
