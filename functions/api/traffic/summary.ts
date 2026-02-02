const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

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
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "500", 10), 2000);
  const table = env.AI_TRAFFIC_TABLE || "ai_requests";

  const params = new URLSearchParams();
  params.set("select", "provider,model,feature,status,total_tokens,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const buildQuery = (key: string, value?: string) => {
    if (!value) return;
    params.append(key, value);
  };

  buildQuery("user_id", url.searchParams.get("user_id") ? `eq.${url.searchParams.get("user_id")}` : undefined);
  buildQuery("project_id", url.searchParams.get("project_id") ? `eq.${url.searchParams.get("project_id")}` : undefined);
  buildQuery("feature", url.searchParams.get("feature") ? `eq.${url.searchParams.get("feature")}` : undefined);
  buildQuery("model", url.searchParams.get("model") ? `eq.${url.searchParams.get("model")}` : undefined);
  buildQuery("provider", url.searchParams.get("provider") ? `eq.${url.searchParams.get("provider")}` : undefined);
  buildQuery("status", url.searchParams.get("status") ? `eq.${url.searchParams.get("status")}` : undefined);

  const gte = url.searchParams.get("from");
  const lte = url.searchParams.get("to");
  if (gte) params.append("created_at", `gte.${gte}`);
  if (lte) params.append("created_at", `lte.${lte}`);

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

    const items = (await res.json()) as Array<{ provider?: string; model?: string; feature?: string; status?: string; total_tokens?: number; created_at?: string }>;
    const totals = items.map((item) => item.total_tokens || 0);

    const byFeature: Record<string, { totalTokens: number; count: number }> = {};
    const byModel: Record<string, { totalTokens: number; count: number }> = {};
    const byProvider: Record<string, { totalTokens: number; count: number }> = {};
    const byDay: Record<string, { totalTokens: number; count: number }> = {};

    items.forEach((item) => {
      const feature = item.feature || "unknown";
      const model = item.model || "unknown";
      const provider = item.provider || "unknown";
      const tokens = item.total_tokens || 0;
      let dateKey = "unknown";
      if (item.created_at) {
        const parsed = new Date(item.created_at);
        if (!Number.isNaN(parsed.getTime())) {
          dateKey = parsed.toISOString().slice(0, 10);
        }
      }

      byFeature[feature] = byFeature[feature] || { totalTokens: 0, count: 0 };
      byFeature[feature].totalTokens += tokens;
      byFeature[feature].count += 1;

      byModel[model] = byModel[model] || { totalTokens: 0, count: 0 };
      byModel[model].totalTokens += tokens;
      byModel[model].count += 1;

      byProvider[provider] = byProvider[provider] || { totalTokens: 0, count: 0 };
      byProvider[provider].totalTokens += tokens;
      byProvider[provider].count += 1;

      byDay[dateKey] = byDay[dateKey] || { totalTokens: 0, count: 0 };
      byDay[dateKey].totalTokens += tokens;
      byDay[dateKey].count += 1;
    });

    const summary = {
      windowSize: items.length,
      totalTokens: sum(totals),
      totalRequests: items.length,
      errorRequests: items.filter((item) => item.status === "error").length,
      byFeature,
      byModel,
      byProvider,
      byDay,
      series: Object.entries(byDay)
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
