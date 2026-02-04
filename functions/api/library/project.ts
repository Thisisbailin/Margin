import { corsHeaders, jsonResponse, requireUser } from "./_auth";

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if ("error" in auth) return auth.error;
  const { userId } = auth;

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 400);
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const project = body?.project;
  if (!project?.id) {
    return jsonResponse({ error: "Invalid project payload" }, 400);
  }

  const payload = {
    id: project.id,
    user_id: userId,
    name: project.name || "Margin Project",
    description: project.description || "",
    lexeme_index: project.lexemeIndex || project.lexeme_index || null,
    interaction_log: project.interactionLog || project.interaction_log || null,
    active_document_id: body?.activeDocumentId || project.activeDocumentId || project.active_document_id || null,
    updated_at: new Date().toISOString(),
  };

  const table = env.MARGIN_PROJECTS_TABLE || "margin_projects";
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
      return jsonResponse({ error: errText || "Upsert failed" }, res.status);
    }

    const data = await res.json();
    return jsonResponse({ project: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Upsert failed" }, 500);
  }
};
