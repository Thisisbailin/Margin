import { LLMProvider, LLMProviderName } from "../core/types";
import { LLMError } from "../core/errors";
import { createQwenProvider } from "./qwen";

export type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
};

export const createProvider = (
  provider: LLMProviderName,
  config: ProviderConfig
): LLMProvider => {
  if (!config.apiKey) {
    throw new LLMError("Unauthorized", `${provider} API key is missing`);
  }

  if (provider === "qwen") {
    return createQwenProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }

  throw new LLMError(
    "InvalidRequest",
    `Only Qwen is enabled in the current build (received: ${provider})`
  );
};
