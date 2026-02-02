import React, { useEffect, useMemo, useState } from 'react';
import { fetchArchiveDetail, fetchArchiveList, type ArchiveCatalog, type ArchiveDetail, type ArchiveEntry } from '../services/archiveClient';

interface MeditationRoomProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
  bookId?: string;
}

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const renderOutline = (outline: unknown) => {
  if (!outline) return null;
  if (Array.isArray(outline)) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {outline.map((item, index) => (
          <li key={`${index}-${String(item).slice(0, 8)}`}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof outline === 'object') {
    return <pre className="whitespace-pre-wrap text-[11px] text-gray-500">{JSON.stringify(outline, null, 2)}</pre>;
  }
  return <div>{String(outline)}</div>;
};

const MeditationRoom: React.FC<MeditationRoomProps> = ({ isOpen, onClose, userId, projectId, bookId }) => {
  const [archives, setArchives] = useState<ArchiveCatalog[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const loadList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchArchiveList({
        user_id: userId,
        project_id: projectId,
        book_id: bookId,
        status: status || undefined,
        search: search || undefined,
        limit: 80,
      });
      setArchives(items);
      if (items.length === 0) {
        setActiveId(null);
        setDetail(null);
        setEntries([]);
      } else if (!activeId || !items.find((item) => item.id === activeId)) {
        setActiveId(items[0].id);
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchArchiveDetail(id);
      setDetail(data.archive);
      setEntries(data.entries);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadList();
  }, [isOpen, userId, projectId, bookId, status, search]);

  useEffect(() => {
    if (!isOpen || !activeId) return;
    loadDetail(activeId);
  }, [isOpen, activeId]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      loadList();
      if (activeId) {
        loadDetail(activeId);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, activeId, userId, projectId, bookId, status, search]);

  const activeArchive = useMemo(() => archives.find((item) => item.id === activeId) || detail, [archives, activeId, detail]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-paper animate-fade-in-up p-6 md:p-12 overflow-hidden">
      <div className="h-full flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-ink italic">冥想室</h1>
            <p className="text-[11px] text-gray-400 mt-2">Agent 研究档案与研究日志实时透明化</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadList}
              className="px-4 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            {error}
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1.4fr_1fr] gap-6 overflow-hidden">
          <div className="bg-surface rounded-[2rem] border border-black/5 p-5 flex flex-col gap-4 overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">目录索引</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索主题/标题"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px]"
            >
              <option value="">全部状态</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {archives.length === 0 ? (
                <div className="text-[10px] text-gray-400">暂无研究档案</div>
              ) : (
                archives.map((item) => {
                  const active = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition ${active ? 'border-accent bg-white' : 'border-black/5 bg-white hover:border-accent/30'}`}
                    >
                      <div className="text-[11px] font-bold text-ink">{item.title || 'Untitled'}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{item.topic || '未标注主题'}</div>
                      <div className="text-[9px] text-gray-400 mt-2">{formatDate(item.updated_at)}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white/70 rounded-[2rem] border border-black/5 p-6 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">研究项目</div>
            {!activeArchive ? (
              <div className="text-[11px] text-gray-400 mt-6">选择一个档案查看研究项目结构</div>
            ) : (
              <div className="space-y-6 mt-4">
                <div>
                  <h2 className="font-display text-2xl text-ink">{activeArchive.title || 'Untitled'}</h2>
                  <p className="text-[11px] text-gray-400 mt-2">{activeArchive.topic || '未标注主题'}</p>
                  <div className="text-[10px] text-gray-400 mt-2">更新：{formatDate(activeArchive.updated_at)}</div>
                </div>
                {activeArchive.summary && (
                  <div className="bg-surface border border-black/5 rounded-2xl p-4 text-[11px] text-gray-600 leading-relaxed">
                    {activeArchive.summary}
                  </div>
                )}
                {activeArchive.outline && (
                  <div className="bg-surface border border-black/5 rounded-2xl p-4 text-[11px] text-gray-600 leading-relaxed">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Outline</div>
                    {renderOutline(activeArchive.outline)}
                  </div>
                )}
                {activeArchive.tags && activeArchive.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeArchive.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded-full bg-accent/10 text-[10px] text-accent">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white/70 rounded-[2rem] border border-black/5 p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">研究日志</div>
              <span className="text-[10px] text-emerald-500">Live</span>
            </div>
            <div className="mt-4 space-y-4">
              {entries.length === 0 ? (
                <div className="text-[11px] text-gray-400">暂无日志</div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="border border-black/5 rounded-2xl p-4 bg-surface">
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{entry.entry_type || 'note'}</span>
                      <span>{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.title && <div className="text-[11px] font-bold text-ink mt-2">{entry.title}</div>}
                    {entry.content && <div className="text-[11px] text-gray-600 mt-2 whitespace-pre-wrap">{entry.content}</div>}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {entry.tags.map((tag) => (
                          <span key={`${entry.id}-${tag}`} className="px-2 py-1 rounded-full bg-black/5 text-[9px] text-gray-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeditationRoom;
