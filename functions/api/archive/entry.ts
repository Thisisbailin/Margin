const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const pick = (value: Record<string, any>, key: string, fallbackKey?: string) => {
  if (!value) return undefined;
  if (value[key] !== undefined) return value[key];
  if (fallbackKey && value[fallbackKey] !== undefined) return value[fallbackKey];
  return undefined;
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

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const entry = body?.entry;
  if (!entry || !pick(entry, "archive_id", "archiveId")) {
    return new Response(JSON.stringify({ error: "Invalid entry payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const payload = {
    archive_id: pick(entry, "archive_id", "archiveId"),
    entry_type: pick(entry, "entry_type", "entryType") || "note",
    title: pick(entry, "title"),
    content: pick(entry, "content"),
    tags: pick(entry, "tags"),
    metadata: pick(entry, "metadata"),
    role: pick(entry, "role"),
  };

  const table = env.AGENT_ARCHIVE_ENTRY_TABLE || "agent_archive_entries";
  const archiveTable = env.AGENT_ARCHIVE_TABLE || "agent_archives";
  const base = supabaseUrl.replace(/\/+$/, "");
  const endpoint = `${base}/rest/v1/${table}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText || "Insert failed" }), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await res.json();

    if (payload.archive_id) {
      await fetch(`${base}/rest/v1/${archiveTable}?id=eq.${payload.archive_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
    }

    return new Response(JSON.stringify({ entry: Array.isArray(data) ? data[0] : data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Insert failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
