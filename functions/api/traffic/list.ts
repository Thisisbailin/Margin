const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const buildQuery = (params: URLSearchParams, key: string, value?: string) => {
  if (!value) return;
  params.append(key, value);
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

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const table = env.AI_TRAFFIC_TABLE || "ai_requests";

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  buildQuery(params, "user_id", url.searchParams.get("user_id") ? `eq.${url.searchParams.get("user_id")}` : undefined);
  buildQuery(params, "project_id", url.searchParams.get("project_id") ? `eq.${url.searchParams.get("project_id")}` : undefined);
  buildQuery(params, "feature", url.searchParams.get("feature") ? `eq.${url.searchParams.get("feature")}` : undefined);
  buildQuery(params, "model", url.searchParams.get("model") ? `eq.${url.searchParams.get("model")}` : undefined);
  buildQuery(params, "provider", url.searchParams.get("provider") ? `eq.${url.searchParams.get("provider")}` : undefined);
  buildQuery(params, "status", url.searchParams.get("status") ? `eq.${url.searchParams.get("status")}` : undefined);

  const gte = url.searchParams.get("from");
  const lte = url.searchParams.get("to");
  if (gte) buildQuery(params, "created_at", `gte.${gte}`);
  if (lte) buildQuery(params, "created_at", `lte.${lte}`);

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${table}?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText || "Fetch failed" }), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ items: data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
