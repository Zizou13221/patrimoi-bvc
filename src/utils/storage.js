/**
 * PatriMoi — Storage abstraction (Phase 3 DAT v2.0)
 *
 * Tente d'utiliser MMKV (synchrone, performant).
 * Si le module natif n'est pas disponible (pod pas installé, simulateur
 * sans rebuild natif), bascule sur un store in-memory synchrone
 * afin d'éviter tout crash au démarrage.
 */

let _store = null;

try {
  const { MMKV } = require('react-native-mmkv');
  _store = new MMKV({ id: 'patrimoi' });
  // Vérification minimale que le natif est bien là
  _store.set('__probe__', '1');
  _store.delete('__probe__');
} catch (_) {
  // Fallback in-memory synchrone (même API)
  console.warn('[PatriMoi] MMKV non disponible — fallback in-memory (pod install requis)');
  const _mem = {};
  _store = {
    getString:  (k)    => _mem[k] ?? undefined,
    set:        (k, v) => { _mem[k] = String(v); },
    delete:     (k)    => { delete _mem[k]; },
    contains:   (k)    => k in _mem,
  };
}

export const storage = {
  // ── String brut ─────────────────────────────────────────────
  getString: (key)       => _store.getString(key) ?? null,
  setString: (key, val)  => _store.set(key, String(val)),

  // ── JSON (auto-sérialise) ───────────────────────────────────
  get: (key) => {
    const raw = _store.getString(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  set: (key, val) => _store.set(key, JSON.stringify(val)),

  // ── Suppression ─────────────────────────────────────────────
  delete:    (key)       => _store.delete(key),
  deleteAll: (keys)      => keys.forEach(k => _store.delete(k)),

  // ── Vérification ────────────────────────────────────────────
  has: (key) => _store.contains(key),
};
