export type AgentTask = "annotation" | "lexicon" | "project" | "freeform";

export type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentRequest = {
  task: AgentTask;
  input?: string;
  context?: Record<string, unknown>;
  history?: AgentMessage[];
  messages?: AgentMessage[]; // direct messages override prompt builder
  model?: string; // L1/L2/L3 or concrete model
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
};

export type AgentResponse = {
  task: AgentTask;
  model: string;
  text: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
};
