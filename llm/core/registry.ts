import { LLMModelTier, LLMProviderName, LLMRegistryConfig } from "./types";

const normalizeEnvValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return undefined;
  return trimmed;
};

export const getEnv = (key: string): string | undefined => {
  try {
    return normalizeEnvValue(process.env[key]);
  } catch {}
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return normalizeEnvValue(metaEnv[key]);
  } catch {}
  try {
    return normalizeEnvValue((globalThis as any).process?.env?.[key]);
  } catch {}
  return undefined;
};

export const resolveProvider = (config?: LLMRegistryConfig): LLMProviderName => {
  const fromConfig = config?.provider;
  const fromEnv = getEnv("LLM_PROVIDER") || getEnv("VITE_LLM_PROVIDER");
  return (fromConfig || fromEnv || "qwen") as LLMProviderName;
};

const resolveTierEnvKey = (tier: LLMModelTier): string => {
  if (tier === "L1") return "LLM_MODEL_L1";
  if (tier === "L2") return "LLM_MODEL_L2";
  return "LLM_MODEL_L3";
};

export const resolveModel = (
  tierOrModel: string,
  config?: LLMRegistryConfig
): string => {
  const upper = tierOrModel.toUpperCase();
  if (upper === "L1" || upper === "L2" || upper === "L3") {
    const tier = upper as LLMModelTier;
    const aliasFromConfig = config?.modelAliases?.[tier];
    const aliasFromEnv = getEnv(resolveTierEnvKey(tier));
    const fallback = config?.defaultModel || getEnv("LLM_DEFAULT_MODEL");
    return aliasFromConfig || aliasFromEnv || fallback || "qwen-plus";
  }
  return tierOrModel;
};

export const resolveApiKey = (
  provider: LLMProviderName,
  config?: LLMRegistryConfig
): string | undefined => {
  if (config?.apiKey) return config.apiKey;
  if (provider === "qwen") {
    return (
      getEnv("QWEN_API_KEY") ||
      getEnv("VITE_QWEN_API_KEY") ||
      getEnv("DASHSCOPE_API_KEY")
    );
  }
  if (provider === "openai") return getEnv("OPENAI_API_KEY");
  if (provider === "openrouter") return getEnv("OPENROUTER_API_KEY");
  return undefined;
};

export const resolveBaseUrl = (
  provider: LLMProviderName,
  config?: LLMRegistryConfig
): string | undefined => {
  if (config?.baseUrl) return config.baseUrl;
  const fromEnv = getEnv("LLM_BASE_URL");
  if (fromEnv) return fromEnv;
  if (provider === "qwen") return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return undefined;
};
