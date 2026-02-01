import { LLMClient, LLMRequest, LLMStreamChunk, LLMResponse, LLMRegistryConfig } from "../core/types";
import { LLMError } from "../core/errors";
import { resolveApiKey, resolveBaseUrl, resolveModel, resolveProvider } from "../core/registry";
import { createProvider } from "../providers";
import { createTrafficRecorder, withTraffic } from "../traffic/recorder";

export type LLMRuntimeConfig = LLMRegistryConfig;

const resolveRequestModel = (req: LLMRequest, config?: LLMRuntimeConfig): string => {
  const fromReq = req.model || config?.defaultModel || \"L2\";
  const resolved = resolveModel(fromReq, config);
  if (!resolved) {
    throw new LLMError("InvalidRequest", "Missing model mapping for request");
  }
  return resolved;
};

export const createLLMClient = (config?: LLMRuntimeConfig): LLMClient => {
  const providerName = resolveProvider(config);
  const apiKey = resolveApiKey(providerName, config);
  const baseUrl = resolveBaseUrl(providerName, config);

  const provider = createProvider(providerName, { apiKey, baseUrl });
  const trackedProvider = (() => {
    if (!config?.traffic || config.traffic.enabled === false) return provider;
    const recorder = createTrafficRecorder({
      enabled: config.traffic.enabled,
      sink: config.traffic.sink,
      supabaseUrl: config.traffic.supabaseUrl,
      supabaseKey: config.traffic.supabaseKey,
      table: config.traffic.table,
      provider: providerName,
    });
    return withTraffic(provider, recorder);
  })();

  return {
    async generate(req: LLMRequest): Promise<LLMResponse> {
      const model = resolveRequestModel(req, config);
      return trackedProvider.generate({ ...req, model });
    },

    async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
      const model = resolveRequestModel(req, config);
      yield* trackedProvider.stream({ ...req, model, stream: true });
    },

    withModel(model: string): LLMClient {
      return createLLMClient({ ...config, defaultModel: model });
    },
  };
};
