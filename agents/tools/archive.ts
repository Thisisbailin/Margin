import { ToolDefinition } from "./types";

type ArchiveToolConfig = {
  supabaseUrl?: string;
  supabaseKey?: string;
  archiveTable?: string;
  entryTable?: string;
};

const normalizeTagList = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

const pick = (value: Record<string, any> | undefined, key: string, fallbackKey?: string) => {
  if (!value) return undefined;
  if (value[key] !== undefined) return value[key];
  if (fallbackKey && value[fallbackKey] !== undefined) return value[fallbackKey];
  return undefined;
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
};

const buildHeaders = (config: ArchiveToolConfig) => ({
  "Content-Type": "application/json",
  apikey: config.supabaseKey || "",
  Authorization: `Bearer ${config.supabaseKey}`,
});

const canUse = (config: ArchiveToolConfig) => Boolean(config.supabaseUrl && config.supabaseKey);

export const createArchiveTools = (config: ArchiveToolConfig): ToolDefinition[] => {
  if (!canUse(config)) return [];
  const base = config.supabaseUrl!.replace(/\/+$/, "");
  const archiveTable = config.archiveTable || "agent_archives";
  const entryTable = config.entryTable || "agent_archive_entries";

  return [
    {
      name: "archive.catalog.list",
      description: "List archive catalog entries by filters: user_id, project_id, book_id, status, tag, search, limit.",
      run: async (input) => {
        const payload = typeof input === "string" ? {} : (input as Record<string, any>);
        const params = new URLSearchParams();
        params.set("select", "id,title,topic,summary,status,tags,updated_at,project_id,book_id");
        params.set("order", "updated_at.desc");
        params.set("limit", String(payload?.limit || 40));

        const userId = pick(payload, "user_id", "userId");
        if (userId) params.append("user_id", `eq.${userId}`);
        const projectId = pick(payload, "project_id", "projectId");
        if (projectId) params.append("project_id", `eq.${projectId}`);
        const bookId = pick(payload, "book_id", "bookId");
        if (bookId) params.append("book_id", `eq.${bookId}`);
        const status = pick(payload, "status");
        if (status) params.append("status", `eq.${status}`);
        const tag = pick(payload, "tag");
        if (tag) params.append("tags", `cs.{${tag}}`);
        const search = pick(payload, "search");
        if (search) {
          const safe = String(search).replace(/%/g, "").replace(/,/g, " ").trim();
          if (safe) {
            params.set("or", `(title.ilike.*${safe}*,topic.ilike.*${safe}*,summary.ilike.*${safe}*)`);
          }
        }

        const endpoint = `${base}/rest/v1/${archiveTable}?${params.toString()}`;
        const res = await fetch(endpoint, { headers: buildHeaders(config) });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return await res.json();
      },
    },
    {
      name: "archive.read",
      description: "Read an archive with entries. Input: { id }.",
      run: async (input) => {
        const payload = typeof input === "string" ? { id: input } : (input as Record<string, any>);
        const id = pick(payload, "id");
        if (!id) throw new Error("archive id is required");

        const archiveUrl = `${base}/rest/v1/${archiveTable}?select=*&id=eq.${id}&limit=1`;
        const entriesUrl = `${base}/rest/v1/${entryTable}?select=*&archive_id=eq.${id}&order=created_at.desc&limit=200`;
        const [archiveRes, entriesRes] = await Promise.all([
          fetch(archiveUrl, { headers: buildHeaders(config) }),
          fetch(entriesUrl, { headers: buildHeaders(config) }),
        ]);
        if (!archiveRes.ok) {
          throw new Error(await archiveRes.text());
        }
        if (!entriesRes.ok) {
          throw new Error(await entriesRes.text());
        }
        const archiveData = await archiveRes.json();
        const entriesData = await entriesRes.json();
        return {
          archive: Array.isArray(archiveData) ? archiveData[0] : archiveData,
          entries: entriesData,
        };
      },
    },
    {
      name: "archive.write",
      description: "Upsert archive content. Input: { archive: { id?, user_id, title, summary?, outline?, tags?, status?, project_id?, book_id?, topic? } }",
      run: async (input) => {
        const payload = typeof input === "string" ? {} : (input as Record<string, any>);
        const archive = payload?.archive || payload;
        if (!archive) throw new Error("archive payload is required");

        const body = {
          id: pick(archive, "id"),
          user_id: pick(archive, "user_id", "userId"),
          project_id: pick(archive, "project_id", "projectId"),
          book_id: pick(archive, "book_id", "bookId"),
          title: pick(archive, "title"),
          topic: pick(archive, "topic"),
          status: pick(archive, "status") || "active",
          summary: pick(archive, "summary"),
          outline: pick(archive, "outline"),
          tags: normalizeTagList(pick(archive, "tags")),
          metadata: pick(archive, "metadata"),
          updated_at: new Date().toISOString(),
        };

        if (!body.user_id || !body.title) throw new Error("user_id and title are required");

        const endpoint = `${base}/rest/v1/${archiveTable}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...buildHeaders(config),
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();
        return Array.isArray(data) ? data[0] : data;
      },
    },
    {
      name: "archive.append_entry",
      description: "Append a research log entry. Input: { entry: { archive_id, content, title?, entry_type?, tags?, metadata?, role? } }",
      run: async (input) => {
        const payload = typeof input === "string" ? {} : (input as Record<string, any>);
        const entry = payload?.entry || payload;
        if (!entry) throw new Error("entry payload is required");

        const body = {
          archive_id: pick(entry, "archive_id", "archiveId"),
          entry_type: pick(entry, "entry_type", "entryType") || "note",
          title: pick(entry, "title"),
          content: pick(entry, "content"),
          tags: normalizeTagList(pick(entry, "tags")),
          metadata: pick(entry, "metadata"),
          role: pick(entry, "role"),
        };
        if (!body.archive_id) throw new Error("archive_id is required");

        const endpoint = `${base}/rest/v1/${entryTable}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...buildHeaders(config),
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();

        await fetch(`${base}/rest/v1/${archiveTable}?id=eq.${body.archive_id}`, {
          method: "PATCH",
          headers: buildHeaders(config),
          body: JSON.stringify({ updated_at: new Date().toISOString() }),
        });

        return Array.isArray(data) ? data[0] : data;
      },
    },
  ];
};
