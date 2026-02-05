import React, { useMemo, useState } from 'react';
import { useSyncState } from '../../services/sync/useSyncState';
import { syncEngine } from '../../services/sync/syncEngine';

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '未同步';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const SyncStatusIndicator: React.FC = () => {
  const state = useSyncState();
  const [isOpen, setIsOpen] = useState(false);

  const meta = useMemo(() => {
    switch (state.health) {
      case 'exception':
        return {
          label: '同步异常',
          tone: 'text-secondary bg-secondary/10 border-secondary/30',
          detail: '网络或服务暂时异常，稍后会自动重试。'
        };
      case 'failed':
        return {
          label: '同步失败',
          tone: 'text-red-500 bg-red-500/10 border-red-500/30',
          detail: '同步已停止，需要重新认证或检查权限。'
        };
      case 'conflict':
        return {
          label: '需要处理冲突',
          tone: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
          detail: '云端与本地都发生了修改，请选择一个版本。'
        };
      default:
        return {
          label: '同步正常',
          tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
          detail: '云端同步保持正常。'
        };
    }
  }, [state.health]);

  const isSyncing = state.phase === 'syncing';
  const statusLabel = isSyncing ? '同步中...' : meta.label;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-11 h-11 rounded-full border shadow-soft flex items-center justify-center transition ${meta.tone} ${
          isSyncing ? 'animate-pulse' : ''
        }`}
        aria-label={`Sync Status: ${statusLabel}`}
        title={statusLabel}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 19.5h9a4.5 4.5 0 001.12-8.85 5.25 5.25 0 10-10.2 1.65 4.5 4.5 0 00.08 7.2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.5m0 0l-2.25-2.25M12 16.25l2.25-2.25" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-[120] bg-transparent"
            aria-label="Close sync status"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-4 w-72 bg-paper border border-black/5 rounded-2xl shadow-float overflow-hidden animate-fade-in z-[130]">
            <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.25em] border ${meta.tone}`}>
                {statusLabel}
              </span>
              {state.pending > 0 && (
                <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">未同步更改</span>
              )}
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="text-[11px] text-gray-500">{meta.detail}</div>
              <div className="text-[11px] text-gray-400">上次同步: {formatTime(state.lastSyncAt)}</div>
              {state.lastError && (
                <div className="text-[11px] text-red-500 break-words">错误: {state.lastError}</div>
              )}
            </div>

            <div className="px-4 pb-4 space-y-2">
              {state.health === 'conflict' ? (
                <>
                  <button
                    onClick={async () => {
                      await syncEngine.resolveConflict('use-remote');
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-black/5 text-[11px] font-semibold text-ink hover:border-accent/40 hover:text-accent transition"
                  >
                    使用云端版本
                  </button>
                  <button
                    onClick={async () => {
                      await syncEngine.resolveConflict('keep-local');
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-black/5 text-[11px] font-semibold text-ink hover:border-accent/40 hover:text-accent transition"
                  >
                    保留本地并覆盖云端
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    await syncEngine.syncNow('manual');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-black/5 text-[11px] font-semibold text-ink hover:border-accent/40 hover:text-accent transition"
                  disabled={isSyncing}
                >
                  {isSyncing ? '同步中...' : '立即同步'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
