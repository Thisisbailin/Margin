export type ToolCall = {
  name: string;
  input?: Record<string, unknown> | string;
  id?: string;
};

export type ToolResult = {
  name: string;
  output?: unknown;
  error?: string;
  id?: string;
};

export type ToolExecutionContext = {
  context?: Record<string, unknown>;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  run: (input: Record<string, unknown> | string | undefined, ctx: ToolExecutionContext) => Promise<unknown> | unknown;
};
