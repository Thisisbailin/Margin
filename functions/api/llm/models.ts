const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const resolveBaseUrl = (env: Record<string, string | undefined>) => {
  const base = env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  return base.trim();
};

const resolveModelsEndpoint = (baseUrl: string) => {
  let base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) {
    return base.replace(/\/chat\/completions$/, "/models");
  }
  if (base.endsWith("/generation")) {
    return base.replace(/\/generation$/, "/models");
  }
  if (base.endsWith("/video-synthesis")) {
    return base.replace(/\/video-synthesis$/, "/models");
  }
  if (base.endsWith("/models")) return base;
  if (base.endsWith("/v1")) return `${base}/models`;
  return `${base}/models`;
};

const normalizeModels = (data: any) => {
  const list =
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.models) && data.models) ||
    (Array.isArray(data?.result) && data.result) ||
    [];
  return list
    .map((model: any) => ({
      ...model,
      id: model.id || model.model || model.name || model?.data?.id || "",
    }))
    .filter((model: any) => model.id);
};

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const apiKey = env.QWEN_API_KEY || env.VITE_QWEN_API_KEY || env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing Qwen API key" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const baseUrl = resolveBaseUrl(env);
  const endpoint = resolveModelsEndpoint(baseUrl);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Qwen models fetch failed (${response.status}): ${errText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await response.json();
    const models = normalizeModels(data);

    return new Response(JSON.stringify({ models }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Fetch models failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
