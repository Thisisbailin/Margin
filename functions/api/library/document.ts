import { corsHeaders, jsonResponse, requireUser } from "./_auth";

const chunk = <T>(items: T[], size = 500): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const upsertRows = async (
  endpoint: string,
  supabaseKey: string,
  rows: Array<Record<string, unknown>>
) => {
  if (!rows.length) return { ok: true };
  const batches = chunk(rows, 500);
  for (const batch of batches) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || "Upsert failed" };
    }
  }
  return { ok: true };
};

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

  const document = body?.document;
  const projectId = body?.projectId || document?.projectId || document?.project_id;
  if (!document?.id || !projectId) {
    return jsonResponse({ error: "Invalid document payload" }, 400);
  }

  const payload = {
    id: document.id,
    user_id: userId,
    project_id: projectId,
    data: document,
    title: document.title || null,
    author: document.author || null,
    language: document.language || null,
    type: document.type || null,
    updated_at: new Date().toISOString(),
  };

  const table = env.MARGIN_DOCUMENTS_TABLE || "margin_documents";
  const sectionTable = env.MARGIN_SECTIONS_TABLE || "margin_document_sections";
  const blockTable = env.MARGIN_BLOCKS_TABLE || "margin_document_blocks";
  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${table}`;
  const sectionEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${sectionTable}`;
  const blockEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${blockTable}`;

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

    const sections = Array.isArray(document.sections) ? document.sections : [];
    const sectionRows = sections.map((section: any, index: number) => ({
      id: section.id,
      user_id: userId,
      project_id: projectId,
      document_id: document.id,
      title: section.title || "",
      order: section.order || index + 1,
      level: section.level || null,
      parent_id: section.parentId || null,
      source_path: section.sourcePath || null,
      updated_at: new Date().toISOString(),
    }));

    const blockRows = sections.flatMap((section: any) => {
      const blocks = Array.isArray(section.blocks) ? section.blocks : [];
      return blocks.map((block: any, index: number) => {
        const spans = Array.isArray(block.spans) ? block.spans : [];
        const text = spans
          .map((span: any) => span.text || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          id: block.id,
          user_id: userId,
          project_id: projectId,
          document_id: document.id,
          section_id: section.id,
          block_order: index + 1,
          type: block.type || null,
          level: block.level || null,
          align: block.align || null,
          indent: block.indent || null,
          indent_kind: block.indentKind || null,
          line_height: block.lineHeight || null,
          spacing_before: block.spacingBefore || null,
          spacing_after: block.spacingAfter || null,
          note_type: block.noteType || null,
          text,
          source_ids: block.sourceIds || null,
          updated_at: new Date().toISOString(),
        };
      });
    });

    const sectionUpsert = await upsertRows(sectionEndpoint, supabaseKey, sectionRows);
    if (!sectionUpsert.ok) {
      return jsonResponse({ error: sectionUpsert.error || "Section upsert failed" }, 500);
    }

    const blockUpsert = await upsertRows(blockEndpoint, supabaseKey, blockRows);
    if (!blockUpsert.ok) {
      return jsonResponse({ error: blockUpsert.error || "Block upsert failed" }, 500);
    }

    const data = await res.json();
    return jsonResponse({ document: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Upsert failed" }, 500);
  }
};
