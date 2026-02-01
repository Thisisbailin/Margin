import { createLLMClient, iterableToSSEStream, type LLMMessage } from "../../../llm";

const jsonResponse = (payload: unknown, init?: ResponseInit) => {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const resolveEnvConfig = (env: Record<string, string | undefined>) => {
  return {
    provider: "qwen" as const,
    apiKey: env.QWEN_API_KEY || env.VITE_QWEN_API_KEY || env.DASHSCOPE_API_KEY,
    baseUrl: env.LLM_BASE_URL,
    defaultModel: env.LLM_DEFAULT_MODEL,
    modelAliases: {
      L1: env.LLM_MODEL_L1,
      L2: env.LLM_MODEL_L2,
      L3: env.LLM_MODEL_L3,
    },
    traffic: {
      enabled: env.AI_TRAFFIC_ENABLED !== "false",
      sink: (env.AI_TRAFFIC_SINK as "supabase" | "console" | "none") || "supabase",
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY,
      table: env.AI_TRAFFIC_TABLE || "ai_requests",
    },
  };
};

const parseBody = async (request: Request) => {
  try {
    return (await request.json()) as {
      model?: string;
      messages?: LLMMessage[];
      temperature?: number;
      maxTokens?: number;
      metadata?: Record<string, string>;
    };
  } catch {
    return null;
  }
};

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, { status: 405, headers: corsHeaders });
  }

  const body = await parseBody(request);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "Invalid request body" }, { status: 400, headers: corsHeaders });
  }

  const client = createLLMClient(resolveEnvConfig(env));
  const stream = client.stream({
    model: body.model || "L2",
    messages: body.messages,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    stream: true,
    metadata: body.metadata,
  });

  return new Response(iterableToSSEStream(stream), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
