import type { SyncState } from './types';

export type SyncListener = (state: SyncState) => void;

const defaultState: SyncState = {
  health: 'normal',
  phase: 'idle',
  pending: 0
};

class SyncStore {
  private state: SyncState = { ...defaultState };
  private listeners = new Set<SyncListener>();

  getState = () => this.state;

  setState = (partial: Partial<SyncState>) => {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  };

  reset = () => {
    this.state = { ...defaultState };
    this.listeners.forEach((listener) => listener(this.state));
  };

  subscribe = (listener: SyncListener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const syncStore = new SyncStore();
