/**
 * PatriMoi — Fonctions d'authentification et de sync
 *
 * Toutes les fonctions retournent { data, error }
 * → data  : résultat en cas de succès
 * → error : message string en cas d'échec
 */

import { supabase } from './supabase';

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
  return { data: data.data, error: null };
}

/**
 * Sauvegarde (upsert) les données patrimoine dans Supabase
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
 * Écoute les changements de session en temps réel
 * callback(session) est appelé à chaque changement
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
