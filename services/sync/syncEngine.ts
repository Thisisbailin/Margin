import type { SyncAdapter, SyncConflict, SyncSnapshot, SyncState } from './types';
import { syncStore } from './syncStore';

type SyncSource = 'local' | 'remote';

const buildConflict = (snapshot: SyncSnapshot, localUpdatedAt?: number): SyncConflict => ({
  reason: 'remote-newer',
  message: '检测到云端数据在你上次同步后发生了变更。',
  remoteUpdatedAt: snapshot.remoteUpdatedAt,
  localUpdatedAt
});

const parseRemoteTime = (remoteUpdatedAt?: string) => {
  if (!remoteUpdatedAt) return undefined;
  const parsed = Date.parse(remoteUpdatedAt);
  return Number.isFinite(parsed) ? parsed : undefined;
};

class SyncEngine {
  private adapter?: SyncAdapter;
  private getToken?: () => Promise<string | null>;
  private userId?: string;
  private localSnapshot?: SyncSnapshot;
  private dirtySince?: number;
  private lastSyncedAt?: number;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private queued = false;
  private conflictSnapshot?: SyncSnapshot;
  private applyRemoteSnapshot?: (snapshot: SyncSnapshot) => void;

  configure = (config: { adapter: SyncAdapter; getToken: () => Promise<string | null> }) => {
    this.adapter = config.adapter;
    this.getToken = config.getToken;
  };

  setApplyRemoteSnapshot = (handler?: (snapshot: SyncSnapshot) => void) => {
    this.applyRemoteSnapshot = handler;
  };

  setUser = (userId?: string) => {
    this.userId = userId;
    if (!userId) {
      this.reset();
      return;
    }
    if (this.dirtySince) {
      this.scheduleSync(300);
    }
  };

  reset = () => {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.localSnapshot = undefined;
    this.dirtySince = undefined;
    this.lastSyncedAt = undefined;
    this.conflictSnapshot = undefined;
    this.inFlight = false;
    this.queued = false;
    syncStore.reset();
  };

  getState = (): SyncState => syncStore.getState();

  setLocalSnapshot = (snapshot: SyncSnapshot, options?: { source?: SyncSource }) => {
    this.localSnapshot = snapshot;
    if (options?.source === 'remote') {
      const remoteTime = parseRemoteTime(snapshot.remoteUpdatedAt);
      if (remoteTime) this.lastSyncedAt = remoteTime;
      this.dirtySince = undefined;
      this.conflictSnapshot = undefined;
      syncStore.setState({
        health: 'normal',
        phase: 'idle',
        pending: 0,
        lastSyncAt: this.lastSyncedAt ?? Date.now(),
        remoteUpdatedAt: snapshot.remoteUpdatedAt,
        conflict: undefined,
        lastError: undefined,
        lastErrorAt: undefined
      });
      return;
    }

    this.markDirty();
  };

  markDirty = () => {
    if (!this.dirtySince) this.dirtySince = Date.now();
    const current = syncStore.getState();
    syncStore.setState({
      pending: 1,
      health: current.health === 'conflict' ? 'conflict' : 'normal'
    });
    this.scheduleSync();
  };

  scheduleSync = (delayMs = 1500) => {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.syncNow('scheduled').catch(() => undefined);
    }, delayMs);
  };

  pullLatest = async (): Promise<SyncSnapshot | null> => {
    if (!this.adapter || !this.getToken || !this.userId) return null;
    syncStore.setState({ phase: 'syncing' });

    try {
      const token = await this.getToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const snapshot = await this.adapter.pull(token);
      if (!snapshot) {
        syncStore.setState({ phase: 'idle' });
        return null;
      }

      const remoteTime = parseRemoteTime(snapshot.remoteUpdatedAt);
      if (remoteTime) this.lastSyncedAt = remoteTime;
      syncStore.setState({
        phase: 'idle',
        health: 'normal',
        lastSyncAt: this.lastSyncedAt ?? Date.now(),
        remoteUpdatedAt: snapshot.remoteUpdatedAt,
        pending: this.dirtySince ? 1 : 0,
        lastError: undefined,
        lastErrorAt: undefined,
        conflict: undefined
      });

      return snapshot;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  };

  syncNow = async (reason: string, options?: { force?: boolean }) => {
    if (!this.adapter || !this.getToken || !this.userId) return;
    if (!this.localSnapshot) return;
    if (this.inFlight) {
      this.queued = true;
      return;
    }

    this.inFlight = true;
    syncStore.setState({ phase: 'syncing' });

    try {
      const token = await this.getToken();
      if (!token) throw new Error('AUTH_REQUIRED');

      if (!options?.force && this.dirtySince && this.lastSyncedAt) {
        if (this.adapter.peek) {
          const meta = await this.adapter.peek(token);
          const metaTime = parseRemoteTime(meta?.remoteUpdatedAt);
          if (metaTime && metaTime > this.lastSyncedAt) {
            const remoteSnapshot = await this.adapter.pull(token);
            if (remoteSnapshot) {
              this.conflictSnapshot = remoteSnapshot;
              syncStore.setState({
                phase: 'idle',
                health: 'conflict',
                pending: 1,
                conflict: buildConflict(remoteSnapshot, this.dirtySince),
                remoteUpdatedAt: remoteSnapshot.remoteUpdatedAt
              });
              return;
            }
          }
        } else {
          const remoteSnapshot = await this.adapter.pull(token);
          if (remoteSnapshot?.remoteUpdatedAt) {
            const remoteTime = parseRemoteTime(remoteSnapshot.remoteUpdatedAt);
            if (remoteTime && remoteTime > this.lastSyncedAt) {
              this.conflictSnapshot = remoteSnapshot;
              syncStore.setState({
                phase: 'idle',
                health: 'conflict',
                pending: 1,
                conflict: buildConflict(remoteSnapshot, this.dirtySince),
                remoteUpdatedAt: remoteSnapshot.remoteUpdatedAt
              });
              return;
            }
          }
        }
      }

      const result = await this.adapter.push(this.localSnapshot, token);
      const remoteTime = parseRemoteTime(result.remoteUpdatedAt);
      this.lastSyncedAt = remoteTime ?? Date.now();
      this.dirtySince = undefined;
      this.conflictSnapshot = undefined;

      syncStore.setState({
        phase: 'idle',
        health: 'normal',
        pending: 0,
        lastSyncAt: this.lastSyncedAt,
        remoteUpdatedAt: result.remoteUpdatedAt,
        lastError: undefined,
        lastErrorAt: undefined,
        conflict: undefined
      });
    } catch (error) {
      this.handleError(error);
    } finally {
      this.inFlight = false;
      if (this.queued) {
        this.queued = false;
        this.syncNow(`${reason}-queued`, options).catch(() => undefined);
      }
    }
  };

  resolveConflict = async (strategy: 'use-remote' | 'keep-local') => {
    if (!this.conflictSnapshot) return;

    if (strategy === 'use-remote') {
      const snapshot = this.conflictSnapshot;
      if (this.applyRemoteSnapshot) {
        this.applyRemoteSnapshot(snapshot);
      } else {
        this.setLocalSnapshot(snapshot, { source: 'remote' });
      }
      this.conflictSnapshot = undefined;
      return;
    }

    await this.syncNow('force-push', { force: true });
  };

  private handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const isAuth = /401|403|auth/i.test(message);
    const pending = this.dirtySince ? 1 : syncStore.getState().pending;
    syncStore.setState({
      phase: 'idle',
      health: isAuth ? 'failed' : 'exception',
      lastError: message,
      lastErrorAt: Date.now(),
      pending
    });
  };
}

export const syncEngine = new SyncEngine();
