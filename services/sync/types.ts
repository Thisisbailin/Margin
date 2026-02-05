import type { Document, Project } from '../../types';

export type SyncHealth = 'normal' | 'exception' | 'failed' | 'conflict';
export type SyncPhase = 'idle' | 'syncing';

export interface SyncConflict {
  reason: 'remote-newer' | 'schema-mismatch' | 'unknown';
  message: string;
  remoteUpdatedAt?: string;
  localUpdatedAt?: number;
}

export interface SyncState {
  health: SyncHealth;
  phase: SyncPhase;
  pending: number;
  lastSyncAt?: number;
  lastError?: string;
  lastErrorAt?: number;
  remoteUpdatedAt?: string;
  conflict?: SyncConflict;
}

export interface SyncSnapshot {
  project: Project;
  documents: Document[];
  activeDocumentId?: string;
  remoteUpdatedAt?: string;
}

export interface SyncRemoteMeta {
  remoteUpdatedAt?: string;
  projectId?: string;
}

export interface SyncPushResult {
  remoteUpdatedAt?: string;
}

export interface SyncAdapter {
  name: string;
  pull: (token: string) => Promise<SyncSnapshot | null>;
  push: (snapshot: SyncSnapshot, token: string) => Promise<SyncPushResult>;
  peek?: (token: string) => Promise<SyncRemoteMeta | null>;
}
