import { corsHeaders, jsonResponse, requireUser } from "./_auth";

export const onRequest = async ({ request, env }: { request: Request; env: Record<string, string> }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
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

  const projectTable = env.MARGIN_PROJECTS_TABLE || "margin_projects";
  const documentTable = env.MARGIN_DOCUMENTS_TABLE || "margin_documents";

  const projectParams = new URLSearchParams();
  projectParams.set("select", "id,user_id,name,description,lexeme_index,interaction_log,active_document_id,updated_at");
  projectParams.append("user_id", `eq.${userId}`);
  projectParams.set("order", "updated_at.desc");
  projectParams.set("limit", "1");

  const projectEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${projectTable}?${projectParams.toString()}`;

  try {
    const projectRes = await fetch(projectEndpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!projectRes.ok) {
      const errText = await projectRes.text();
      return jsonResponse({ error: errText || "Fetch failed" }, projectRes.status);
    }

    const projectRows = (await projectRes.json()) as any[];
    const project = projectRows?.[0];
    if (!project) {
      return jsonResponse({ project: null, documents: [] });
    }

    const docParams = new URLSearchParams();
    docParams.set("select", "data");
    docParams.append("user_id", `eq.${userId}`);
    docParams.append("project_id", `eq.${project.id}`);
    docParams.set("order", "created_at.asc");

    const docsEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${documentTable}?${docParams.toString()}`;

    const docsRes = await fetch(docsEndpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!docsRes.ok) {
      const errText = await docsRes.text();
      return jsonResponse({ error: errText || "Fetch failed" }, docsRes.status);
    }

    const docsRows = (await docsRes.json()) as Array<{ data?: unknown }>; 
    const documents = docsRows.map((row) => row.data).filter(Boolean);

    return jsonResponse({ project, documents });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Fetch failed" }, 500);
  }
};
