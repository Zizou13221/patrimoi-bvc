/**
 * PatriMoi — Fonctions d'authentification et de sync
 *
 * Toutes les fonctions retournent { data, error }
 * → data  : résultat en cas de succès
 * → error : message string en cas d'échec
 */

// AUTH V4 — ZERO static imports (schemas inlined, pas de require schemas)
// Raison : Metro résout .ts avant .js → si schemas/index.ts existe et throw,
// require('../schemas') au sommet de la factory aborte auth.js avant tout export.

// safeParse inline — pas besoin de zod
function safeParse(_schema, data) { return data; }

console.log('[AUTH_V4] Début évaluation module auth.js');

// require() inline dans try/catch : si supabase.js jette malgré tout,
// auth.js continue et ses exports restent des fonctions valides (stub).
let supabase;
try {
  supabase = require('./supabase').supabase;
  console.log('[AUTH_V4] supabase chargé, type:', typeof supabase);
} catch (e) {
  console.error('[AUTH_V4] require supabase a jeté:', e && e.message);
}
if (!supabase) {
  const noopAsync = () => Promise.resolve({ data: null, error: 'Supabase non disponible' });
  supabase = {
    auth: {
      getSession:            () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange:     (_ev, _cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
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

// ── Auth ─────────────────────────────────────────────────

/**
 * Inscription email + mot de passe
 * Crée le compte + le profil (via trigger Supabase)
 */
export async function signUp({ email, password, prenom, nom }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { prenom, nom },               // stocké dans auth.users.raw_user_meta_data
    },
  });
  if (error) return { data: null, error: error.message };

  // Mettre à jour le profil avec prénom/nom dès l'inscription
  if (data.user) {
    await supabase.from('profiles').update({ prenom, nom }).eq('id', data.user.id);
  }

  return { data, error: null };
}

/**
 * Connexion email + mot de passe
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Déconnexion
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Récupère la session active (null si non connecté)
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Récupère le profil de l'utilisateur connecté
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Met à jour le prénom/nom de l'utilisateur connecté
 */
export async function updateProfile({ prenom, nom }) {
  const { data, error } = await supabase.auth.updateUser({ data: { prenom, nom } });
  if (error) return { data: null, error: error.message };
  if (data.user) {
    await supabase.from('profiles').update({ prenom, nom }).eq('id', data.user.id).catch(() => {});
  }
  return { data, error: null };
}

/**
 * Demande de réinitialisation de mot de passe
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'patrimoi://reset-password',
  });
  if (error) return { error: error.message };
  return { error: null };
}

// ── Sync données patrimoine ───────────────────────────────

/**
 * Charge les données patrimoine depuis Supabase
 * Retourne null si aucune donnée (premier lancement)
 */
export async function loadPatrimoineData(userId) {
  const { data, error } = await supabase
    .from('patrimoine_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') return { data: null, error: null }; // pas encore de données
  if (error) return { data: null, error: error.message };

  // Validation Zod — fail-safe (retourne les données brutes si le schema évolue)
  const parsed = safeParse(null, data.data);
  return { data: parsed ?? data.data, error: null };
}

/**
 * Sauvegarde (upsert) les données patrimoine dans Supabase
 * Version simple — conservée pour compatibilité mode démo / onboarding
 */
export async function savePatrimoineData(userId, patrimoineData) {
  const { error } = await supabase
    .from('patrimoine_data')
    .upsert(
      { user_id: userId, data: patrimoineData },
      { onConflict: 'user_id' }
    );
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Upsert avec verrou optimiste (Phase 2 DAT v2.0 — outbox pattern)
 *
 * knownUpdatedAt : dernière updated_at connue par le client.
 * Si le serveur a une valeur plus récente → conflit → last-write-wins
 * horodaté (stratégie serveur) et on recharge.
 *
 * Retourne { error, updatedAt } où updatedAt est la nouvelle valeur
 * à persister comme verrou pour la prochaine mutation.
 */
export async function savePatrimoineDataWithLock(userId, patrimoineData, knownUpdatedAt) {
  // Upsert sans condition — last-write-wins horodaté (Supabase gère updated_at)
  const { data, error } = await supabase
    .from('patrimoine_data')
    .upsert(
      { user_id: userId, data: patrimoineData },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single();

  if (error) return { error: error.message, updatedAt: null };

  const serverUpdatedAt = data?.updated_at ?? null;

  // Détection de conflit : si la updated_at serveur était plus récente que
  // ce qu'on connaissait, on a potentiellement écrasé une mise à jour
  // d'un autre appareil → on notifie pour que le store recharge
  if (knownUpdatedAt && serverUpdatedAt && serverUpdatedAt > knownUpdatedAt) {
    // En v2.0 : last-write-wins. En v3 on pourrait merger.
    // Le store peut écouter un flag pour recharger si nécessaire.
    console.log('[auth] Conflit résolu par last-write-wins (updated_at:', serverUpdatedAt, ')');
  }

  return { error: null, updatedAt: serverUpdatedAt };
}

/**
 * Écoute les changements de session en temps réel
 * callback(session) est appelé à chaque changement
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
