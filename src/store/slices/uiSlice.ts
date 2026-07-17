import type { StateCreator } from 'zustand';
import type { Page, BvcStatus } from '../../types';
import type { Store } from '../types';

export type UiSlice = {
  page:              Page;
  sub:               string | null;
  discret:           boolean;
  bvcStatus:         BvcStatus;
  isRefreshing:      boolean;
  isOffline:         boolean;
  pendingActifsSub:  string | null;
  setPage:              (page: Page, sub?: string | null) => void;
  setDiscret:           (v: boolean) => void;
  setBvcStatus:         (v: BvcStatus) => void;
  setIsRefreshing:      (v: boolean) => void;
  setIsOffline:         (v: boolean) => void;
  setPendingActifsSub:  (v: string | null) => void;
};

export const createUiSlice: StateCreator<Store, [], [], UiSlice> = (set) => ({
  page:              'dashboard',
  sub:               null,
  discret:           false,
  bvcStatus:         'loading',
  isRefreshing:      false,
  isOffline:         false,
  pendingActifsSub:  null,

  setPage:              (page, sub = null) => set({ page, sub }),
  setDiscret:           (v) => set({ discret: v }),
  setBvcStatus:         (v) => set({ bvcStatus: v }),
  setIsRefreshing:      (v) => set({ isRefreshing: v }),
  setIsOffline:         (v) => set({ isOffline: v }),
  setPendingActifsSub:  (v) => set({ pendingActifsSub: v }),
});
