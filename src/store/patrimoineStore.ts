/**
 * PatriMoi — Store Zustand 4 (Phase 3 DAT v2.0)
 *
 * API publique inchangée : usePatrimoineStore(s => s.field)
 * Le store est découpé en 4 slices typés.
 */

import { create } from 'zustand';
import type { Store } from './types';
import { createDataSlice } from './slices/dataSlice';
import { createAuthSlice } from './slices/authSlice';
import { createUiSlice } from './slices/uiSlice';
import { createHistorySlice } from './slices/historySlice';

export const usePatrimoineStore = create<Store>()((...a) => ({
  ...createDataSlice(...a),
  ...createAuthSlice(...a),
  ...createUiSlice(...a),
  ...createHistorySlice(...a),
}));
