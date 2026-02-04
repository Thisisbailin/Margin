import { iterableToSSEStream } from "../../../llm";
import { streamAgent, type AgentRequest } from "../../../agents";
import { requireUser } from "../library/_auth";

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
    return (await request.json()) as AgentRequest;
  } catch {
    return null;
  }
};

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const auth = await requireUser(request, env);
  if ("error" in auth) return auth.error;

  const body = await parseBody(request);
  if (!body || !body.task) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const stream = streamAgent(body, resolveEnvConfig(env));

  return new Response(iterableToSSEStream(stream), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
