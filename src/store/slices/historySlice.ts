import type { StateCreator } from 'zustand';
import type { HistoryEntry, Objectif } from '../../types';
import type { Store } from '../types';

export type HistorySlice = {
  history:  HistoryEntry[];
  objectif: Objectif | null;
  setHistory: (fn: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => void;
  setObjectif:(v: Objectif | null) => void;
};

export const createHistorySlice: StateCreator<Store, [], [], HistorySlice> = (set) => ({
  history:  [],
  objectif: null,

  setHistory: (fn) => set(state => ({
    history: typeof fn === 'function' ? fn(state.history) : fn,
  })),
  setObjectif: (v) => set({ objectif: v }),
});
