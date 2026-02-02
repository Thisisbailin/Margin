import React, { useEffect, useMemo, useState } from 'react';
import { fetchTrafficList, fetchTrafficSummary, type TrafficRecord, type TrafficSummary } from '../services/trafficClient';

interface TrafficDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
}

const formatNumber = (value: number) => value.toLocaleString();

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const buildTopList = (source: Record<string, { totalTokens: number; count: number }>, limit = 6) => {
  return Object.entries(source)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit);
};

const BarRow = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span className="font-bold uppercase tracking-[0.2em]">{label}</span>
        <span>{formatNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-black/5 overflow-hidden">
        <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }}></div>
      </div>
    </div>
  );
};

const TrafficDashboardModal: React.FC<TrafficDashboardModalProps> = ({ isOpen, onClose, userId, projectId }) => {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [records, setRecords] = useState<TrafficRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<TrafficRecord | null>(null);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    feature: '',
    model: '',
    status: '',
  });

  const normalizeDate = (value: string, endOfDay: boolean) => {
    if (!value) return '';
    const iso = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`);
    if (Number.isNaN(iso.getTime())) return value;
    return iso.toISOString();
  };

  const loadData = async (override?: Partial<typeof filters>) => {
    const nextFilters = { ...filters, ...(override || {}) };
    setIsLoading(true);
    setError(null);
    try {
      const from = nextFilters.from ? normalizeDate(nextFilters.from, false) : undefined;
      const to = nextFilters.to ? normalizeDate(nextFilters.to, true) : undefined;
      const [summaryResult, listResult] = await Promise.all([
        fetchTrafficSummary({
          limit: 1200,
          from,
          to,
          feature: nextFilters.feature || undefined,
          model: nextFilters.model || undefined,
          status: nextFilters.status || undefined,
          user_id: userId,
          project_id: projectId,
        }),
        fetchTrafficList({
          limit: 60,
          user_id: userId,
          project_id: projectId,
          feature: nextFilters.feature || undefined,
          model: nextFilters.model || undefined,
          status: nextFilters.status || undefined,
          from,
          to,
        }),
      ]);
      setSummary(summaryResult);
      setRecords(listResult);
      setSelectedRecord((prev) => {
        if (!prev) return null;
        return listResult.find((item) => item.id === prev.id) || null;
      });
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const featureStats = useMemo(() => (summary ? buildTopList(summary.byFeature) : []), [summary]);
  const modelStats = useMemo(() => (summary ? buildTopList(summary.byModel) : []), [summary]);
  const providerStats = useMemo(() => (summary ? buildTopList(summary.byProvider) : []), [summary]);
  const daySeries = useMemo(() => {
    if (!summary) return [];
    const series =
      summary.series ||
      Object.entries(summary.byDay || {}).map(([date, value]) => ({
        date,
        ...value,
      }));
    return series
      .filter((item) => item.date !== 'unknown')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [summary]);

  const featureOptions = useMemo(() => {
    const fromSummary = summary ? Object.keys(summary.byFeature || {}) : [];
    const fromRecords = records.map((r) => r.feature).filter(Boolean) as string[];
    return Array.from(new Set([...fromSummary, ...fromRecords])).sort();
  }, [summary, records]);

  const modelOptions = useMemo(() => {
    const fromSummary = summary ? Object.keys(summary.byModel || {}) : [];
    const fromRecords = records.map((r) => r.model).filter(Boolean) as string[];
    return Array.from(new Set([...fromSummary, ...fromRecords])).sort();
  }, [summary, records]);

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: unknown) => {
    const text = value === undefined || value === null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportJson = () => {
    downloadBlob(JSON.stringify({ summary, records }, null, 2), 'ai-traffic.json', 'application/json');
  };

  const exportCsv = () => {
    const header = [
      'id',
      'created_at',
      'provider',
      'model',
      'feature',
      'status',
      'total_tokens',
      'prompt_tokens',
      'response_tokens',
      'latency_ms',
      'stream',
      'message_count',
      'source',
      'user_id',
      'project_id',
      'error',
    ];
    const rows = records.map((record) => [
      record.id,
      record.created_at,
      record.provider,
      record.model,
      record.feature,
      record.status,
      record.total_tokens,
      record.prompt_tokens,
      record.response_tokens,
      record.latency_ms,
      record.stream,
      record.message_count,
      record.source,
      record.user_id,
      record.project_id,
      record.error,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadBlob(csv, 'ai-traffic.csv', 'text/csv');
  };

  const maxFeatureTokens = Math.max(0, ...featureStats.map((item) => item.totalTokens));
  const maxModelTokens = Math.max(0, ...modelStats.map((item) => item.totalTokens));
  const maxProviderTokens = Math.max(0, ...providerStats.map((item) => item.totalTokens));
  const maxDayTokens = Math.max(0, ...daySeries.map((item) => item.totalTokens));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper w-full max-w-5xl p-10 rounded-[2.5rem] shadow-float border border-black/5 flex flex-col gap-8 max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display text-3xl text-ink italic">AI Traffic Hub</h2>
            <p className="text-[11px] text-gray-400 mt-1">Token 明细与聚合统计</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData()}
                className="px-4 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={exportJson}
                className="px-3 py-2 border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-accent/30 transition-all"
              >
                导出 JSON
              </button>
              <button
                onClick={exportCsv}
                className="px-3 py-2 border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-accent/30 transition-all"
              >
                导出 CSV
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            {error}
          </div>
        )}

        <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Filters</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gray-400">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gray-400">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Feature</label>
              <select
                value={filters.feature}
                onChange={(e) => setFilters((prev) => ({ ...prev, feature: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
              >
                <option value="">All</option>
                {featureOptions.map((feature) => (
                  <option key={feature} value={feature}>
                    {feature}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Model</label>
              <select
                value={filters.model}
                onChange={(e) => setFilters((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
              >
                <option value="">All</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(filters)}
              className="px-4 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
            >
              应用筛选
            </button>
            <button
              onClick={() => {
                setFilters({ from: '', to: '', feature: '', model: '', status: '' });
                loadData({ from: '', to: '', feature: '', model: '', status: '' });
              }}
              className="px-4 py-2 border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-accent/30 transition-all"
            >
              重置
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface rounded-2xl border border-black/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Total Tokens</div>
            <div className="text-3xl font-bold text-ink mt-2">{summary ? formatNumber(summary.totalTokens) : '—'}</div>
          </div>
          <div className="bg-surface rounded-2xl border border-black/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Total Requests</div>
            <div className="text-3xl font-bold text-ink mt-2">{summary ? formatNumber(summary.totalRequests) : '—'}</div>
          </div>
          <div className="bg-surface rounded-2xl border border-black/5 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Error Requests</div>
            <div className="text-3xl font-bold text-ink mt-2">{summary ? formatNumber(summary.errorRequests) : '—'}</div>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-black/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Daily Token Trend</div>
            <div className="text-[10px] text-gray-400">最近 {daySeries.length || 0} 天</div>
          </div>
          {daySeries.length === 0 ? (
            <div className="text-[10px] text-gray-400 mt-4">暂无趋势数据</div>
          ) : (
            <div className="mt-4 grid grid-cols-7 md:grid-cols-14 gap-2 items-end">
              {daySeries.map((item) => {
                const height = maxDayTokens ? Math.max(8, Math.round((item.totalTokens / maxDayTokens) * 80)) : 8;
                return (
                  <div key={item.date} className="flex flex-col items-center gap-2" title={`${item.date} · ${formatNumber(item.totalTokens)} tokens`}>
                    <div className="h-20 w-full flex items-end">
                      <div className="w-full rounded-full bg-accent/70" style={{ height: `${height}px` }}></div>
                    </div>
                    <div className="text-[9px] text-gray-400">{item.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">By Feature</div>
            {featureStats.length === 0 ? (
              <div className="text-[10px] text-gray-400">暂无数据</div>
            ) : (
              featureStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxFeatureTokens} />
              ))
            )}
          </div>
          <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">By Model</div>
            {modelStats.length === 0 ? (
              <div className="text-[10px] text-gray-400">暂无数据</div>
            ) : (
              modelStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxModelTokens} />
              ))
            )}
          </div>
          <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">By Provider</div>
            {providerStats.length === 0 ? (
              <div className="text-[10px] text-gray-400">暂无数据</div>
            ) : (
              providerStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxProviderTokens} />
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="bg-surface rounded-2xl border border-black/5 p-4 overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Recent Requests</div>
            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-2">
              {records.length === 0 ? (
                <div className="text-[10px] text-gray-400">暂无请求记录</div>
              ) : (
                records.map((record) => {
                  const isActive = selectedRecord?.id === record.id;
                  return (
                    <button
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className={`w-full text-left flex items-center justify-between gap-4 p-3 rounded-xl border transition ${isActive ? 'border-accent bg-white' : 'border-black/5 bg-white hover:border-accent/30'}`}
                    >
                      <div className="flex-1">
                        <div className="text-[11px] font-bold text-ink">{record.feature || 'unknown'} · {record.model || 'model'}</div>
                        <div className="text-[10px] text-gray-400">{formatDate(record.created_at)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-ink">{formatNumber(record.total_tokens || 0)} tokens</div>
                        <div className={`text-[10px] ${record.status === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>{record.status}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-3 overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Request Detail</div>
            {!selectedRecord ? (
              <div className="text-[10px] text-gray-400">选择一条请求查看详情</div>
            ) : (
              <>
                <div className="space-y-2 text-[10px] text-gray-500">
                  <div><span className="font-bold text-ink">ID</span> · {selectedRecord.id}</div>
                  <div><span className="font-bold text-ink">Model</span> · {selectedRecord.model}</div>
                  <div><span className="font-bold text-ink">Feature</span> · {selectedRecord.feature || 'unknown'}</div>
                  <div><span className="font-bold text-ink">Status</span> · {selectedRecord.status}</div>
                  <div><span className="font-bold text-ink">Latency</span> · {selectedRecord.latency_ms ? `${selectedRecord.latency_ms} ms` : '—'}</div>
                  <div><span className="font-bold text-ink">Tokens</span> · {formatNumber(selectedRecord.total_tokens || 0)}</div>
                  <div><span className="font-bold text-ink">Prompt</span> · {formatNumber(selectedRecord.prompt_tokens || 0)} · <span className="font-bold text-ink">Response</span> · {formatNumber(selectedRecord.response_tokens || 0)}</div>
                  {selectedRecord.user_id && <div><span className="font-bold text-ink">User</span> · {selectedRecord.user_id}</div>}
                  {selectedRecord.project_id && <div><span className="font-bold text-ink">Project</span> · {selectedRecord.project_id}</div>}
                  {selectedRecord.status === 'error' && (
                    <div className="text-red-500">
                      <span className="font-bold">Error</span> · {selectedRecord.error || (selectedRecord.metadata as any)?.error || (selectedRecord.metadata as any)?.message || (selectedRecord.metadata as any)?.reason || '请求失败'}
                    </div>
                  )}
                </div>
                {selectedRecord.metadata && (
                  <div className="bg-white rounded-xl border border-black/5 p-3 text-[10px] text-gray-500 overflow-auto max-h-[140px]">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedRecord.metadata, null, 2)}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficDashboardModal;
