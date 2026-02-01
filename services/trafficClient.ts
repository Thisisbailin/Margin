export type TrafficRecord = {
  id: string;
  created_at?: string;
  provider?: string;
  model?: string;
  status?: string;
  total_tokens?: number;
  feature?: string;
  user_id?: string;
  project_id?: string;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
};

export type TrafficSummary = {
  windowSize: number;
  totalTokens: number;
  totalRequests: number;
  errorRequests: number;
  byFeature: Record<string, { totalTokens: number; count: number }>;
  byModel: Record<string, { totalTokens: number; count: number }>;
  byProvider: Record<string, { totalTokens: number; count: number }>;
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  return search.toString();
};

export const fetchTrafficList = async (params?: {
  limit?: number;
  user_id?: string;
  project_id?: string;
  feature?: string;
  model?: string;
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
}): Promise<TrafficRecord[]> => {
  const query = buildQuery(params || {});
  const response = await fetch(`/api/traffic/list${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
};

export const fetchTrafficSummary = async (params?: {
  limit?: number;
  from?: string;
  to?: string;
}): Promise<TrafficSummary> => {
  const query = buildQuery(params || {});
  const response = await fetch(`/api/traffic/summary${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as TrafficSummary;
};
