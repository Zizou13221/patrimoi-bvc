/**
 * PatriMoi — Keychain Storage (Phase 1 DAT v2.0 — Sécurité)
 *
 * Adaptateur SupportedStorage pour Supabase Auth.
 * Utilise react-native-keychain si disponible et lié nativement,
 * sinon fallback AsyncStorage (mode dev / simulateur sans native linking).
 *
 * IMPORTANT : aucun import statique — tout en require() dans try/catch
 * pour éviter que l'évaluation du module factory throw et propage une
 * erreur en cascade vers supabase.js → auth.js → exports void 0.
 *
 * Supabase requiert : { getItem, setItem, removeItem } (sync ou async)
 */

const SERVICE_PREFIX = 'patrimoi.supabase.';
const AS_PREFIX      = '@patrimoi_kc_';

// Tente de charger le module natif Keychain — ne crash pas si absent
let _keychain = null;
try {
  const K = require('react-native-keychain');
  if (K && typeof K.getGenericPassword === 'function') {
    _keychain = K;
  }
} catch (_) { /* non lié */ }

// Tente de charger AsyncStorage — ne crash pas si absent
let _asyncStorage = null;
try {
  const AS = require('@react-native-async-storage/async-storage');
  _asyncStorage = AS.default || AS;
} catch (_) { /* non disponible */ }

export const keychainStorage = {
  async getItem(key) {
    try {
      if (_keychain) {
        const result = await _keychain.getGenericPassword({
          service: `${SERVICE_PREFIX}${key}`,
        });
        return result ? result.password : null;
      }
      if (_asyncStorage) {
        return await _asyncStorage.getItem(`${AS_PREFIX}${key}`);
      }
      return null;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (_keychain) {
        await _keychain.setGenericPassword('supabase', value, {
          service:    `${SERVICE_PREFIX}${key}`,
          accessible: _keychain.ACCESSIBLE
            ? _keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
            : undefined,
        });
        return;
      }
      if (_asyncStorage) {
        await _asyncStorage.setItem(`${AS_PREFIX}${key}`, value);
      }
    } catch {}
  },

  async removeItem(key) {
    try {
      if (_keychain) {
        await _keychain.resetGenericPassword({
          service: `${SERVICE_PREFIX}${key}`,
        });
        return;
      }
      if (_asyncStorage) {
        await _asyncStorage.removeItem(`${AS_PREFIX}${key}`);
      }
    } catch {}
  },
};
