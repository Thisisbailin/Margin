export type AgentRole = "system" | "user" | "assistant";

export type AgentMessage = {
  role: AgentRole;
  content: string;
};

export type AgentRequest = {
  task: "annotation" | "project" | "lexicon" | "freeform";
  input?: string;
  context?: Record<string, unknown>;
  history?: AgentMessage[];
  messages?: AgentMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
};

export type AgentStreamChunk = {
  text?: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
};

export type AgentResponse = {
  task: string;
  model?: string;
  text: string;
  usage?: AgentStreamChunk["usage"];
};

const parseErrorText = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (data?.error) return String(data.error);
  } catch {}
  try {
    const text = await response.text();
    if (text) return text;
  } catch {}
  return response.statusText || "Unknown error";
};

export const runAgent = async (payload: AgentRequest, token?: string): Promise<AgentResponse> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/agent/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorText(response);
    throw new Error(message);
  }

  return (await response.json()) as AgentResponse;
};

export const streamAgent = async (
  payload: AgentRequest,
  onUpdate?: (fullText: string, chunk: AgentStreamChunk) => void,
  token?: string
): Promise<string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/agent/stream", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorText(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Stream response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data:")) return false;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") return true;
    try {
      const chunk = JSON.parse(data) as AgentStreamChunk;
      if (chunk.text) {
        fullText += chunk.text;
        onUpdate?.(fullText, chunk);
      } else {
        onUpdate?.(fullText, chunk);
      }
    } catch {
      // ignore parse errors
    }
    return false;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const doneFlag = handleLine(line);
      if (doneFlag) return fullText;
    }
  }

  if (buffer.trim()) {
    handleLine(buffer);
  }

  return fullText;
};
