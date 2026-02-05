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
  const projectParams = new URLSearchParams();
  projectParams.set("select", "id,active_document_id,updated_at");
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
    const project = projectRows?.[0] || null;
    return jsonResponse({ project });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Fetch failed" }, 500);
  }
};
