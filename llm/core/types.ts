export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMRequest = {
  model: string; // resolved model name or tier alias (L1/L2/L3)
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
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

export interface LLMProvider {
  generate(req: LLMRequest): Promise<LLMResponse>;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
}

export interface LLMClient {
  generate(req: LLMRequest): Promise<LLMResponse>;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
  withModel(model: string): LLMClient;
}

export type LLMProviderName = "openai" | "openrouter" | "qwen";

export type LLMModelTier = "L1" | "L2" | "L3";

export type LLMRegistryConfig = {
  provider?: LLMProviderName;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  modelAliases?: Partial<Record<LLMModelTier, string>>;
  traffic?: {
    enabled?: boolean;
    sink?: "supabase" | "console" | "none";
    supabaseUrl?: string;
    supabaseKey?: string;
    table?: string;
  };
};
