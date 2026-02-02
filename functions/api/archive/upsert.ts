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

  const archive = body?.archive;
  if (!archive || !pick(archive, "user_id", "userId") || !pick(archive, "title")) {
    return new Response(JSON.stringify({ error: "Invalid archive payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const payload = {
    id: pick(archive, "id"),
    user_id: pick(archive, "user_id", "userId"),
    project_id: pick(archive, "project_id", "projectId"),
    book_id: pick(archive, "book_id", "bookId"),
    title: pick(archive, "title"),
    topic: pick(archive, "topic"),
    status: pick(archive, "status") || "active",
    summary: pick(archive, "summary"),
    outline: pick(archive, "outline"),
    tags: pick(archive, "tags"),
    metadata: pick(archive, "metadata"),
    updated_at: new Date().toISOString(),
  };

  const table = env.AGENT_ARCHIVE_TABLE || "agent_archives";
  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${table}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText || "Upsert failed" }), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ archive: Array.isArray(data) ? data[0] : data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Upsert failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
