export type TrafficRecord = {
  id: string;
  created_at?: string;
  provider?: string;
  model?: string;
  status?: string;
  error?: string;
  total_tokens?: number;
  prompt_tokens?: number;
  response_tokens?: number;
  feature?: string;
  source?: string;
  user_id?: string;
  project_id?: string;
  latency_ms?: number;
  stream?: boolean;
  message_count?: number;
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
  byDay?: Record<string, { totalTokens: number; count: number }>;
  series?: Array<{ date: string; totalTokens: number; count: number }>;
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
  user_id?: string;
  project_id?: string;
  feature?: string;
  model?: string;
  provider?: string;
  status?: string;
}): Promise<TrafficSummary> => {
  const query = buildQuery(params || {});
  const response = await fetch(`/api/traffic/summary${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as TrafficSummary;
};
