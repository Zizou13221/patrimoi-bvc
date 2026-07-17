// Mock react-native-mmkv pour les tests Jest
const store = {};
const MMKV = jest.fn().mockImplementation(() => ({
  getString:  (k) => store[k] ?? null,
  setString:  (k, v) => { store[k] = v; },
  set:        (k, v) => { store[k] = JSON.stringify(v); },
  get:        (k) => { try { return JSON.parse(store[k]); } catch { return null; } },
  delete:     (k) => { delete store[k]; },
  clearAll:   () => { Object.keys(store).forEach(k => delete store[k]); },
}));
module.exports = { MMKV };
