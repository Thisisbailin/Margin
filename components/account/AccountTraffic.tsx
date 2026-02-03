import React, { useEffect, useMemo, useState } from 'react';
import { fetchTrafficList, fetchTrafficSummary, type TrafficRecord, type TrafficSummary } from '../../services/trafficClient';

interface AccountTrafficProps {
  userId?: string;
  projectId?: string;
  isActive?: boolean;
  className?: string;
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

const AccountTraffic: React.FC<AccountTrafficProps> = ({ userId, projectId, isActive = true, className }) => {
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
    if (!isActive) return;
    loadData();
  }, [isActive]);

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

  if (!isActive) return null;

  return (
    <div className={className || ''}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink italic">Traffic</h2>
          <p className="text-[11px] text-gray-400 mt-1">Token 明细与聚合统计</p>
        </div>
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
      </div>

      {error && (
        <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mt-6">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-black/5 p-4 space-y-4 mt-6">
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
            onClick={() => setFilters({ from: '', to: '', feature: '', model: '', status: '' })}
            className="px-4 py-2 border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-accent/30 transition-all"
          >
            重置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 mt-6">
        <div className="bg-white/70 rounded-2xl border border-black/5 p-5 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Overview</div>
            <div className="text-[10px] text-gray-400">Total Tokens: {formatNumber(summary?.totalTokens || 0)}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              {featureStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxFeatureTokens} />
              ))}
            </div>
            <div className="space-y-4">
              {modelStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxModelTokens} />
              ))}
            </div>
          </div>
          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Providers</div>
            <div className="space-y-3">
              {providerStats.map((item) => (
                <BarRow key={item.key} label={item.key} value={item.totalTokens} max={maxProviderTokens} />
              ))}
            </div>
          </div>
          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Recent 14 Days</div>
            <div className="space-y-2">
              {daySeries.map((day) => (
                <BarRow key={day.date} label={day.date} value={day.totalTokens || 0} max={maxDayTokens} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/70 rounded-2xl border border-black/5 p-5 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Recent Requests</div>
            <span className="text-[10px] text-gray-400">{records.length} items</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {records.length === 0 ? (
              <div className="text-[11px] text-gray-400">暂无数据</div>
            ) : (
              records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className={`w-full text-left p-3 rounded-2xl border transition ${
                    selectedRecord?.id === record.id ? 'border-accent bg-white' : 'border-black/5 bg-white hover:border-accent/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{record.feature || 'unknown'}</span>
                    <span>{formatNumber(record.total_tokens || 0)} tokens</span>
                  </div>
                  <div className="text-[11px] text-ink mt-1">{record.model || record.provider || 'unknown'}</div>
                  <div className="text-[9px] text-gray-400 mt-2">{formatDate(record.created_at)}</div>
                </button>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-black/5 pt-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2">Request Detail</div>
            {!selectedRecord ? (
              <div className="text-[11px] text-gray-400">选择一条记录查看详情</div>
            ) : (
              <div className="space-y-2 text-[11px] text-gray-600">
                <div><span className="text-gray-400">Feature:</span> {selectedRecord.feature || 'unknown'}</div>
                <div><span className="text-gray-400">Model:</span> {selectedRecord.model || 'unknown'}</div>
                <div><span className="text-gray-400">Status:</span> {selectedRecord.status || 'unknown'}</div>
                <div><span className="text-gray-400">Tokens:</span> {formatNumber(selectedRecord.total_tokens || 0)}</div>
                <div><span className="text-gray-400">Latency:</span> {selectedRecord.latency_ms || 0} ms</div>
                {selectedRecord.error && (
                  <div className="text-red-500">{selectedRecord.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountTraffic;
