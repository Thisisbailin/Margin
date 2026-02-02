export type ArchiveCatalog = {
  id: string;
  title?: string;
  topic?: string;
  summary?: string;
  status?: string;
  tags?: string[];
  updated_at?: string;
  project_id?: string;
  book_id?: string;
};

export type ArchiveDetail = ArchiveCatalog & {
  user_id?: string;
  outline?: unknown;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type ArchiveEntry = {
  id: string;
  archive_id: string;
  created_at?: string;
  entry_type?: string;
  title?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  role?: string;
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
};

export const fetchArchiveList = async (params?: {
  limit?: number;
  user_id?: string;
  project_id?: string;
  book_id?: string;
  status?: string;
  tag?: string;
  search?: string;
}): Promise<ArchiveCatalog[]> => {
  const query = buildQuery(params || {});
  const response = await fetch(`/api/archive/list${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
};

export const fetchArchiveDetail = async (
  id: string,
  params?: { limit?: number }
): Promise<{ archive: ArchiveDetail | null; entries: ArchiveEntry[] }> => {
  const query = buildQuery({ id, ...(params || {}) });
  const response = await fetch(`/api/archive/detail?${query}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = await response.json();
  return {
    archive: data?.archive || null,
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
};
