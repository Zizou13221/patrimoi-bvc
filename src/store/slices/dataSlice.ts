import type { StateCreator } from 'zustand';
import type { PatrimoineData } from '../../types';
import type { Store } from '../types';
import { INIT } from '../../constants/data';
import { enqueueSync } from '../../utils/syncQueue';

export type DataSlice = {
  data: PatrimoineData;
  setData: (fn: PatrimoineData | ((prev: PatrimoineData) => PatrimoineData)) => void;
};

export const createDataSlice: StateCreator<Store, [], [], DataSlice> = (set, get) => ({
  data: INIT as PatrimoineData,

  setData: (fn) => set(state => {
    const newData = typeof fn === 'function' ? fn(state.data) : fn;
    if (state.user && !state.demoMode) {
      enqueueSync(state.user.id, newData);
    }
    return { data: newData };
  }),
});
