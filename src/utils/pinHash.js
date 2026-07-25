/**
 * PatriMoi — PIN hashing (defense-in-depth)
 *
 * Un PIN 6 chiffres stocké en clair dans le Keychain est lisible via un
 * dump Keychain sur appareil jailbreaké. Ce module ajoute un sel aléatoire
 * + SHA-256 pour que le dump ne révèle pas directement le PIN.
 *
 * Contraintes :
 *  - Zéro dépendance native — compatible Hermes (RN 0.75.4)
 *  - crypto.getRandomValues disponible depuis RN 0.74 / Hermes 0.13
 *  - Format stocké : "<sha256_hex>:<salt_hex>"  (64 + 1 + 32 = 97 chars)
 *  - Migration transparente : si la valeur stockée ne contient pas ':'
 *    c'est un PIN en clair (ancienne version) — le code de migration le
 *    re-hache à la première vérification réussie.
 *
 * IMPORTANT : zero static imports — ce fichier n'importe rien de natif.
 */

// ── SHA-256 pur JS (domaine public — Geraint Luff, 2012) ─────────────────────
// Accepte uniquement des chaînes ASCII (suffisant pour un PIN numérique).
function _sha256(ascii) {
  function rightRotate(v, n) { return (v >>> n) | (v << (32 - n)); }
  const pow = Math.pow;
  const M   = pow(2, 32);
  let hash = _sha256._h;
  let k    = _sha256._k;

  if (!hash) {
    hash = _sha256._h = [];
    k    = _sha256._k = [];
    const composite = {};
    for (let c = 2, cnt = 0; cnt < 64; c++) {
      if (!composite[c]) {
        for (let i = 0; i < 313; i += c) composite[i] = c;
        hash[cnt]  = (pow(c, 0.5)     * M) | 0;
        k[cnt++]   = (pow(c, 1 / 3)   * M) | 0;
      }
    }
  }

  hash = hash.slice(0, 8); // working copy
  let msg = ascii + '\x80';
  while (msg.length % 64 !== 56) msg += '\x00';

  const words = [];
  for (let i = 0; i < msg.length; i++) {
    words[i >> 2] |= msg.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }
  const bitLen = ascii.length * 8;
  words.push(Math.floor(bitLen / M), bitLen >>> 0);

  for (let j = 0; j < words.length;) {
    const w       = words.slice(j, (j += 16));
    const oldHash = hash.slice();

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] | 0;
      const w2  = w[i - 2]  | 0;
      w[i] = i < 16 ? (w[i] | 0) : (
        (w[i - 16] | 0)
        + ((rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) | 0)
        + (w[i - 7] | 0)
        + ((rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) | 0)
      ) | 0;

      const e     = hash[4];
      const a     = hash[0];
      const S1    = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch    = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + w[i]) | 0;
      const S0    = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj   = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, ...hash];
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    hash = hash.slice(0, 8);
  }

  return hash.reduce((s, h) => s + ('00000000' + (h >>> 0).toString(16)).slice(-8), '');
}

// ── Génération de sel ─────────────────────────────────────────────────────────
function _randomSalt() {
  try {
    // crypto.getRandomValues disponible depuis Hermes 0.13 / RN 0.74
    const buf = new Uint8Array(16);
    // eslint-disable-next-line no-undef
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback Hermes < 0.74 — acceptable : un sel n'a pas besoin d'être secret,
    // seulement unique ; Math.random() suffit ici.
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
  }
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Hache un PIN avec un sel.
 * @param {string} pin   — ex. "123456"
 * @param {string} [salt] — sel hex 32 chars ; généré automatiquement si absent
 * @returns {{ hash: string, salt: string, stored: string }}
 *   stored = "<hash_hex>:<salt_hex>" (format persisté dans le Keychain)
 */
export function hashPin(pin, salt) {
  const s    = salt ?? _randomSalt();
  const hash = _sha256(pin + s);
  return { hash, salt: s, stored: `${hash}:${s}` };
}

/**
 * Vérifie un PIN contre la valeur stockée (format "<hash>:<salt>").
 * Utilise une comparaison à temps constant pour éviter les timing attacks.
 *
 * Gère aussi les anciens PINs en clair (sans ':') — retourne true si égal,
 * sans re-hacher (la migration est à la charge de l'appelant).
 *
 * @param {string} pin      — PIN saisi par l'utilisateur
 * @param {string} stored   — valeur lue depuis le Keychain
 * @returns {{ ok: boolean, needsMigration: boolean }}
 */
export function verifyPin(pin, stored) {
  if (!stored) return { ok: false, needsMigration: false };

  // Format ancien — PIN en clair (6 chiffres)
  if (!stored.includes(':')) {
    // Comparaison à temps constant même pour les anciens PINs
    const ok = _constantTimeEqual(pin, stored);
    return { ok, needsMigration: ok }; // si bon PIN → l'appelant doit migrer
  }

  // Format nouveau — "<sha256_hex>:<salt_hex>"
  const colonIdx = stored.indexOf(':');
  const storedHash = stored.slice(0, colonIdx);
  const salt       = stored.slice(colonIdx + 1);

  const { hash } = hashPin(pin, salt);
  return { ok: _constantTimeEqual(hash, storedHash), needsMigration: false };
}

/**
 * Détecte si une valeur Keychain est un ancien PIN en clair
 * (utile pour afficher un avertissement ou déclencher une migration).
 */
export function isPinLegacy(stored) {
  return !!stored && !stored.includes(':');
}

// ── Interne ───────────────────────────────────────────────────────────────────

function _constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Pad la plus courte pour éviter l'early-exit sur la longueur
  const maxLen = Math.max(a.length, b.length);
  const A = a.padEnd(maxLen, '\0');
  const B = b.padEnd(maxLen, '\0');
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= A.charCodeAt(i) ^ B.charCodeAt(i);
  }
  return diff === 0;
}
