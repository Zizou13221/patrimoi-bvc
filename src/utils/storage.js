/**
 * PatriMoi — Storage abstraction (Phase 3 DAT v2.0 + R2 + R2-Keychain)
 *
 * ── Stratégie de chiffrement ─────────────────────────────────────────────────
 *
 * Store de données : id='patrimoi_v2', encryptionKey=<clé AES-128>
 * Source de clé    : Keychain iOS (service='patrimoi.mmkv.key',
 *                    WHEN_UNLOCKED_THIS_DEVICE_ONLY) — clé absente des backups
 *                    iTunes non chiffrés et liée au device.
 *
 * ── Phases d'initialisation ──────────────────────────────────────────────────
 *
 * Phase 1 — sync (au chargement du module) :
 *   Tente d'ouvrir patrimoi_v2 avec la clé encore dans MMKV patrimoi_key
 *   (backward compat / pré-migration). Si absente → in-memory temporaire.
 *
 * Phase 2 — async (initStorage(), appelé au boot avant les effets) :
 *   1. Lire la clé depuis le Keychain (source authoritative post-migration).
 *   2. Si absente du Keychain mais présente dans MMKV → migrer vers Keychain
 *      → vérifier → supprimer de MMKV.
 *   3. Si absente des deux (installation fraîche) → générer + stocker en Keychain.
 *   4. (Re-)ouvrir patrimoi_v2 avec la clé Keychain — les données sont lisibles
 *      car la valeur de la clé ne change pas, seul son emplacement change.
 *
 * ── Fallbacks ────────────────────────────────────────────────────────────────
 *
 * • Keychain indisponible (simulateur, pod manquant) : garder comportement
 *   Phase 1 — clé dans MMKV patrimoi_key (mode dégradé, sans régression).
 * • Keychain write failed → Sentry + conserver la clé dans MMKV.
 * • MMKV complètement indisponible → in-memory (tests / CI).
 * • Tout fallback silencieux émet un événement Sentry.
 *
 * ── Sécurité ─────────────────────────────────────────────────────────────────
 *
 * Post-migration : __enc_key__ absente de MMKV. Un backup iTunes non chiffré
 * contient les fichiers MMKV (chiffrés) mais PAS la clé Keychain (device-only).
 * Restauration sur un autre device → fresh start → données récupérées depuis
 * Supabase.
 *
 * IMPORTANT : aucun import ES6 statique (Zero Static Imports pattern).
 */

// ── Fallback in-memory (API identique à MMKV) ────────────────────────────────
function makeMemStore() {
  const _mem = {};
  return {
    _isMem:    true,
    getString:  (k)    => _mem[k] ?? undefined,
    set:        (k, v) => { _mem[k] = String(v); },
    delete:     (k)    => { delete _mem[k]; },
    contains:   (k)    => k in _mem,
    getAllKeys:  ()     => Object.keys(_mem),
  };
}

// ── Génération de clé (128 bits, CSPRNG si disponible) ──────────────────────
function _generateKey() {
  try {
    // crypto.getRandomValues disponible depuis RN 0.74 / Hermes 0.13
    const buf = new Uint8Array(16);
    // eslint-disable-next-line no-undef
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback Math.random (simulateur / Hermes < 0.13)
    let key = '';
    for (let i = 0; i < 32; i++) key += Math.floor(Math.random() * 16).toString(16);
    return key;
  }
}

// ── Sentry sans import statique ──────────────────────────────────────────────
function _captureError(label, err) {
  try {
    const s = require('./sentry');
    s?.captureError?.(
      new Error(`[storage] ${label}`),
      { message: err?.message ?? String(err ?? '') },
    );
  } catch {}
}

// Keychain inaccessible (errSecMissingEntitlement) sur simulateur ou build Debug
// sans Keychain Sharing configuré → comportement attendu, ne pas polluer Sentry.
function _isEntitlementError(e) {
  const msg = (e?.message ?? '').toLowerCase();
  return msg.includes('entitlement') || msg.includes('errsecmissingentitlement');
}

// ── État interne ─────────────────────────────────────────────────────────────
let _store      = null;
let _initDone   = false;
const KC_SERVICE = 'patrimoi.mmkv.key';

// ── Phase 1 : init synchrone (module load) ───────────────────────────────────
// Tente d'ouvrir patrimoi_v2 avec la clé encore dans MMKV patrimoi_key.
// Si la clé a déjà été migrée vers le Keychain (MMKV vide), bascule sur
// in-memory jusqu'à ce que initStorage() prenne le relais.
;(function _syncInit() {
  try {
    const { MMKV } = require('react-native-mmkv');
    const keyStore = new MMKV({ id: 'patrimoi_key' });
    const mmkvKey  = keyStore.getString('__enc_key__');

    if (mmkvKey) {
      // Clé encore dans MMKV (pré-migration ou Keychain indispo) — utiliser
      const s = new MMKV({ id: 'patrimoi_v2', encryptionKey: mmkvKey });
      s.set('__probe__', '1'); s.delete('__probe__');
      _store = s;
      return;
    }

    // Clé absente de MMKV → déjà migrée vers Keychain (ou installation fraîche).
    // initStorage() va re-ouvrir patrimoi_v2 avec la clé Keychain.
    // En attendant : in-memory (les reads retournent null, ce qui est géré
    // gracieusement dans la séquence de boot — Supabase est la source of truth).
    _store = makeMemStore();

  } catch (_mmkvErr) {
    // MMKV non disponible (CI / pod manquant)
    _store = makeMemStore();
  }
}());

// ── Phase 2 : init asynchrone (migration clé → Keychain) ────────────────────

/**
 * Doit être appelé au plus tôt dans le boot (avant le premier read critique).
 * Idempotent — ne s'exécute qu'une seule fois même si appelé plusieurs fois.
 *
 * @example
 *   // PatriMoi_Native.jsx (niveau module)
 *   import { initStorage } from './src/utils/storage';
 *   const _storageReady = initStorage();
 *   // ...dans le premier useEffect :
 *   await _storageReady;
 */
export async function initStorage() {
  if (_initDone) return;
  _initDone = true;

  // Charger react-native-keychain sans import statique
  let KC = null;
  try {
    const K = require('react-native-keychain');
    if (K?.getGenericPassword) KC = K;
  } catch {}

  if (!KC) {
    // Keychain non disponible (simulateur sans pod) — mode dégradé.
    // _store est déjà initialisé en Phase 1 (MMKV key ou in-memory).
    // Pas pire que l'état actuel — pas de Sentry (attendu sur simulateur).
    return;
  }

  const ACCESSIBLE = KC.ACCESSIBLE?.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
  let key = null;

  // ── 1. Lire depuis Keychain (source authoritative post-migration) ──────────
  try {
    const r = await KC.getGenericPassword({ service: KC_SERVICE });
    if (r?.password) key = r.password;
  } catch (e) {
    // Entitlement manquant = simulateur ou build Debug sans Keychain Sharing → silencieux
    if (!_isEntitlementError(e)) _captureError('keychain_read_error', e);
  }

  // ── 2. Pas dans le Keychain → chercher dans MMKV (pré-migration) ──────────
  if (!key) {
    let mmkvKey = null; // déclaré hors du try pour être accessible dans le catch
    try {
      const { MMKV } = require('react-native-mmkv');
      const keyStore = new MMKV({ id: 'patrimoi_key' });
      mmkvKey = keyStore.getString('__enc_key__') ?? null;

      if (mmkvKey) {
        // Écrire dans le Keychain
        await KC.setGenericPassword('mmkv', mmkvKey, {
          service:    KC_SERVICE,
          accessible: ACCESSIBLE,
        });

        // Vérifier que l'écriture a réussi avant de supprimer de MMKV
        const verify = await KC.getGenericPassword({ service: KC_SERVICE });
        if (verify?.password === mmkvKey) {
          keyStore.delete('__enc_key__'); // migration confirmée — supprimer de MMKV
          key = mmkvKey;
        } else {
          // Écriture non confirmée — conserver MMKV comme fallback
          key = mmkvKey;
          _captureError('keychain_migration_verify_failed', null);
        }
      }
    } catch (e) {
      // CRITIQUE : en cas d'échec Keychain (ex. entitlement manquant sur simulateur),
      // conserver mmkvKey comme clé de chiffrement active.
      // Sans ce fallback, key reste null → step 3 génère une NOUVELLE clé →
      // écrase patrimoi_key dans MMKV → patrimoi_v2 s'ouvre avec une clé différente
      // → toutes les données existantes sont inaccessibles (data loss).
      if (mmkvKey) key = mmkvKey;
      if (!_isEntitlementError(e)) _captureError('keychain_unavailable_fallback', e);
      // _store déjà initialisé en Phase 1 avec mmkvKey — pas de régression.
    }
  }

  // ── 3. Ni Keychain ni MMKV → installation fraîche ────────────────────────
  if (!key) {
    key = _generateKey();
    try {
      await KC.setGenericPassword('mmkv', key, {
        service:    KC_SERVICE,
        accessible: ACCESSIBLE,
      });
    } catch (e) {
      // Keychain write failed — fallback MMKV (mode dégradé, clé en clair)
      // Entitlement manquant = simulateur → silencieux (comportement attendu)
      if (!_isEntitlementError(e)) _captureError('mmkv_encryption_fallback', e);
      try {
        const { MMKV } = require('react-native-mmkv');
        const keyStore = new MMKV({ id: 'patrimoi_key' });
        keyStore.set('__enc_key__', key);
      } catch {}
      // On continue avec la clé générée — même si elle finit dans MMKV,
      // c'est le même niveau de sécurité qu'avant cette migration.
    }
  }

  if (!key) return; // pas de clé du tout — garder _store actuel

  // ── 4. (Re-)ouvrir patrimoi_v2 avec la clé authoritative ─────────────────
  // La valeur de la clé ne change pas (même données, même déchiffrement).
  // Ce swap est transparent pour tous les appelants.
  try {
    const { MMKV } = require('react-native-mmkv');
    const encStore = new MMKV({ id: 'patrimoi_v2', encryptionKey: key });
    encStore.set('__probe__', '1'); encStore.delete('__probe__');
    _store = encStore; // remplacement atomique du store
  } catch (e) {
    _captureError('mmkv_reopen_with_keychain_key_failed', e);
    // Ne pas écraser _store — garder ce qui fonctionnait avant
  }

  // ── 5. Migration PIN : format clair → hash:salt ────────────────────────────
  // Fait ici (boot) car c'est le seul moment où le PIN en clair est accessible
  // sans redemander le PIN à l'utilisateur. isPinLegacy() / verifyPin() gèrent
  // les deux formats pendant la transition sur les devices pas encore migrés.
  try {
    const { hashPin, isPinLegacy } = require('./pinHash');
    const PIN_SERVICE = 'patrimoi.pin';
    const pinCred = await KC.getGenericPassword({ service: PIN_SERVICE });
    if (pinCred?.password && isPinLegacy(pinCred.password)) {
      const { stored } = hashPin(pinCred.password);
      await KC.setGenericPassword('pin', stored, {
        service:    PIN_SERVICE,
        accessible: ACCESSIBLE,
      });
    }
  } catch (e) {
    // Non fatal : PIN reste lisible dans l'ancien format via verifyPin()
    if (!_isEntitlementError(e)) _captureError('pin_migration_error', e);
  }
}

// ── API publique (synchrone, inchangée) ──────────────────────────────────────

export const storage = {
  // ── String brut ─────────────────────────────────────────────
  getString: (key)       => _store.getString(key) ?? null,
  setString: (key, val)  => _store.set(key, String(val)),

  // ── JSON (auto-sérialise) ───────────────────────────────────
  get: (key) => {
    const raw = _store.getString(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  set: (key, val) => _store.set(key, JSON.stringify(val)),

  // ── Suppression ─────────────────────────────────────────────
  delete:    (key)       => _store.delete(key),
  deleteAll: (keys)      => keys.forEach(k => _store.delete(k)),

  // ── Vérification ────────────────────────────────────────────
  has: (key) => _store.contains(key),
};
