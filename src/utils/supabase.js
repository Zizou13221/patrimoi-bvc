/**
 * PatriMoi — Client Supabase
 *
 * La clé `anon` est une clé PUBLIQUE (côté client) — c'est normal qu'elle
 * soit dans le code. La sécurité des données est assurée par les politiques
 * RLS côté Supabase (chaque utilisateur ne voit que ses propres données).
 *
 * Project : fwgsdjhavrqrqwmydwxf (West EU - Ireland)
 *
 * IMPORTANT : aucun import statique — tout en require() dans try/catch.
 *
 * Raison : avec Babel CJS transform (Old Architecture / Hermes), les `import`
 * sont compilés en `require()` qui s'exécutent au tout début du module factory,
 * avant n'importe quel try/catch. Si @supabase/supabase-js ou keychainStorage
 * jette pendant leur évaluation, supabase.js avorte et tous ses exports
 * restent `void 0`, propageant l'erreur en cascade vers auth.js.
 *
 * En utilisant require() inline dans un try/catch, on isole chaque dépendance
 * et le module factory se termine toujours avec un `supabase` valide.
 */

// ── 1. Polyfill URL (doit s'exécuter AVANT require('@supabase/supabase-js')) ──
(function patchURL() {
  try { if (new URL('https://a.b').protocol === 'https:') return; } catch (_) {}
  const parse = (s) => {
    const m = String(s).match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?/);
    if (!m) throw new TypeError('Invalid URL: ' + s);
    const [, proto, host, path, search = '', hash = ''] = m;
    return {
      protocol: `${proto}:`, host, hostname: host.split(':')[0],
      port: host.includes(':') ? host.split(':')[1] : '',
      pathname: path || '/', search, hash, href: s,
      origin: `${proto}://${host}`, username: '', password: '',
    };
  };
  const Orig = typeof URL !== 'undefined' ? URL : null;
  global.URL = class URL {
    constructor(url) { Object.assign(this, parse(url)); }
    toString()  { return this.href; }
    toJSON()    { return this.href; }
    get searchParams() { return new URLSearchParams(this.search.slice(1)); }
    static createObjectURL() { return Orig ? Orig.createObjectURL(...arguments) : ''; }
    static revokeObjectURL() {}
  };
})();

console.log('[SUPABASE_V3] Début évaluation module supabase.js');

// ── 2. Constantes ────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://fwgsdjhavrqrqwmydwxf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z3NkamhhdnJxcnF3bXlkd3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjg1MTIsImV4cCI6MjA5ODg0NDUxMn0.qAjD61kxDe374QCs90-k-rTQRWxpkPOD1tN7Ic8Vsvg';

// ── 3. Stub fallback ─────────────────────────────────────────────────────────
function makeSupabaseStub() {
  const noopAsync = () => Promise.resolve({ data: null, error: 'Supabase non initialisé' });
  const noopSub   = () => ({ data: { subscription: { unsubscribe: () => {} } } });
  return {
    auth: {
      getSession:            () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange:     (_ev, _cb) => noopSub(),
      signUp:                noopAsync,
      signInWithPassword:    noopAsync,
      signOut:               noopAsync,
      updateUser:            noopAsync,
      resetPasswordForEmail: noopAsync,
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: noopAsync }) }),
      upsert: () => ({ select: () => ({ single: noopAsync }) }),
      update: () => ({ eq: () => noopAsync() }),
    }),
  };
}

// ── 4. Init Supabase — tout dans try/catch ───────────────────────────────────
let supabase;
try {
  // require() inline = s'exécute après le polyfill URL ci-dessus
  const { keychainStorage } = require('./keychainStorage');
  const { createClient }    = require('@supabase/supabase-js');

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage:            keychainStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
  });

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[PatriMoi] Supabase initialisé avec succès');
  }
} catch (e) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[PatriMoi] Supabase init a échoué, stub actif:', e?.message);
  }
  supabase = makeSupabaseStub();
}

export { supabase };
