export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMRequestPayload = {
  model?: string; // model tier (L1/L2/L3) or concrete model
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
};

export type LLMStreamChunk = {
  text?: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
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

export const generateLLM = async (payload: LLMRequestPayload) => {
  const response = await fetch("/api/llm/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseErrorText(response);
    throw new Error(message);
  }

  return (await response.json()) as { text: string } & LLMStreamChunk;
};

export const streamLLM = async (
  payload: LLMRequestPayload,
  onUpdate?: (fullText: string, chunk: LLMStreamChunk) => void
): Promise<string> => {
  const response = await fetch("/api/llm/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      const chunk = JSON.parse(data) as LLMStreamChunk;
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
