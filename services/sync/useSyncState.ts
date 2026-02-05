import { useSyncExternalStore } from 'react';
import { syncStore } from './syncStore';

export const useSyncState = () =>
  useSyncExternalStore(syncStore.subscribe, syncStore.getState, syncStore.getState);
