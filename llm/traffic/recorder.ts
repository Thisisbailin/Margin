import { LLMRequest, LLMUsage } from "../core/types";
import { TrafficRecorder, TrafficRecorderConfig, TrafficStart, TrafficFinish, TrafficRecord } from "./types";

const createRequestId = () => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const now = () => Date.now();

const resolveMetaValue = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
};

const buildRecord = (
  start: TrafficStart,
  finish: TrafficFinish,
  config: TrafficRecorderConfig
): TrafficRecord => {
  const endedAt = now();
  const usage = finish.usage;
  const promptTokens = usage?.promptTokens;
  const responseTokens = usage?.responseTokens;
  const totalTokens = usage?.totalTokens;
  const messages = start.request.messages || [];
  const promptChars = messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
  const metadata = start.request.metadata;

  return {
    id: start.id,
    startedAt: start.startedAt,
    endedAt,
    latencyMs: endedAt - start.startedAt,
    provider: config.provider,
    model: start.request.model,
    stream: !!start.request.stream,
    status: finish.status,
    error: finish.error,
    promptTokens,
    responseTokens,
    totalTokens,
    messageCount: messages.length,
    promptChars,
    metadata,
    source: resolveMetaValue(metadata, "source"),
    feature: resolveMetaValue(metadata, "feature"),
    userId: resolveMetaValue(metadata, "user_id"),
    projectId: resolveMetaValue(metadata, "project_id"),
  };
};

const recordToConsole = async (record: TrafficRecord) => {
  const payload = {
    id: record.id,
    provider: record.provider,
    model: record.model,
    status: record.status,
    totalTokens: record.totalTokens,
    latencyMs: record.latencyMs,
    source: record.source,
    feature: record.feature,
  };
  if (record.status === "error") {
    console.warn("[AI Traffic]", payload, record.error);
  } else {
    console.info("[AI Traffic]", payload);
  }
};

const recordToSupabase = async (record: TrafficRecord, config: TrafficRecorderConfig) => {
  if (!config.supabaseUrl || !config.supabaseKey) {
    await recordToConsole(record);
    return;
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const table = config.table || "ai_requests";
  const endpoint = `${base}/rest/v1/${table}`;
  const payload = {
    id: record.id,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    latency_ms: record.latencyMs,
    provider: record.provider,
    model: record.model,
    stream: record.stream,
    status: record.status,
    error: record.error,
    prompt_tokens: record.promptTokens,
    response_tokens: record.responseTokens,
    total_tokens: record.totalTokens,
    message_count: record.messageCount,
    prompt_chars: record.promptChars,
    metadata: record.metadata,
    source: record.source,
    feature: record.feature,
    user_id: record.userId,
    project_id: record.projectId,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[AI Traffic] Supabase insert failed", res.status, text);
  }
};

const mergeUsage = (current: LLMUsage | undefined, next: LLMUsage | undefined): LLMUsage | undefined => {
  if (!next) return current;
  return {
    promptTokens: next.promptTokens ?? current?.promptTokens ?? 0,
    responseTokens: next.responseTokens ?? current?.responseTokens ?? 0,
    totalTokens: next.totalTokens ?? current?.totalTokens ?? 0,
  };
};

export const createTrafficRecorder = (config: TrafficRecorderConfig): TrafficRecorder => {
  const enabled = config.enabled !== false && config.sink !== "none";
  const sink = config.sink || (config.supabaseUrl && config.supabaseKey ? "supabase" : "console");

  const finishRecord = async (record: TrafficRecord) => {
    if (!enabled) return;
    if (sink === "supabase") {
      await recordToSupabase(record, config);
      return;
    }
    await recordToConsole(record);
  };

  return {
    start(request: LLMRequest): TrafficStart {
      return {
        id: createRequestId(),
        startedAt: now(),
        provider: config.provider,
        request,
      };
    },

    async finish(start: TrafficStart, finish: TrafficFinish) {
      const record = buildRecord(start, finish, config);
      await finishRecord(record);
    },
  };
};

export const withTraffic = (provider: { generate: any; stream: any }, recorder: TrafficRecorder) => {
  return {
    async generate(req: LLMRequest) {
      const start = recorder.start(req);
      try {
        const response = await provider.generate(req);
        await recorder.finish(start, { status: "success", usage: response.usage });
        return response;
      } catch (error: any) {
        await recorder.finish(start, { status: "error", error: error?.message || "Unknown error" });
        throw error;
      }
    },

    async *stream(req: LLMRequest) {
      const start = recorder.start(req);
      let usage: LLMUsage | undefined;
      try {
        for await (const chunk of provider.stream(req)) {
          usage = mergeUsage(usage, chunk.usage as LLMUsage | undefined);
          yield chunk;
        }
        await recorder.finish(start, { status: "success", usage });
      } catch (error: any) {
        await recorder.finish(start, { status: "error", error: error?.message || "Unknown error", usage });
        throw error;
      }
    },
  };
};
