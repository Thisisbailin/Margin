const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const table = env.AGENT_ARCHIVE_TABLE || "agent_archives";
  const entryTable = env.AGENT_ARCHIVE_ENTRY_TABLE || "agent_archive_entries";
  const base = supabaseUrl.replace(/\/+$/, "");

  const archiveUrl = `${base}/rest/v1/${table}?select=*&id=eq.${id}&limit=1`;
  const entryLimit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 300);
  const entriesUrl = `${base}/rest/v1/${entryTable}?select=*&archive_id=eq.${id}&order=created_at.desc&limit=${entryLimit}`;

  try {
    const [archiveRes, entriesRes] = await Promise.all([
      fetch(archiveUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }),
      fetch(entriesUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }),
    ]);

    if (!archiveRes.ok) {
      const errText = await archiveRes.text();
      return new Response(JSON.stringify({ error: errText || "Fetch failed" }), {
        status: archiveRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!entriesRes.ok) {
      const errText = await entriesRes.text();
      return new Response(JSON.stringify({ error: errText || "Fetch failed" }), {
        status: entriesRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const archiveData = await archiveRes.json();
    const entriesData = await entriesRes.json();
    const archive = Array.isArray(archiveData) ? archiveData[0] : null;

    return new Response(JSON.stringify({ archive, entries: entriesData }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};
