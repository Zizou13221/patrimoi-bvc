import type { DataSlice } from './slices/dataSlice';
import type { AuthSlice } from './slices/authSlice';
import type { UiSlice } from './slices/uiSlice';
import type { HistorySlice } from './slices/historySlice';

export type Store = DataSlice & AuthSlice & UiSlice & HistorySlice;
