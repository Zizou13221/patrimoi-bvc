/**
 * PatriMoi — Error Logger
 *
 * Envoie les erreurs JS non gérées vers la table Supabase `error_logs`.
 * Toujours fail-silencieux : ne doit JAMAIS crasher l'app.
 *
 * Table attendue (voir supabase/migrations/error_logs.sql) :
 *   id, user_id, message, stack, context, app_version, created_at
 */

const APP_VERSION = '1.6';

/**
 * @param {object} params
 * @param {string} params.message  - Error.message (tronqué à 500 chars)
 * @param {string} [params.stack]  - Error.stack (tronqué à 3000 chars)
 * @param {string} [params.context] - Onglet ou section qui a crashé (ex: 'actifs')
 */
export async function logError({ message, stack, context = 'unknown' }) {
  try {
    // Lazy require — même pattern que auth.js pour éviter les imports circulaires
    const { supabase }            = require('./supabase');
    const { usePatrimoineStore }  = require('../store/patrimoineStore');
    const user = usePatrimoineStore.getState().user;

    await supabase.from('error_logs').insert({
      user_id:     user?.id ?? null,
      message:     (message ?? 'Erreur inconnue').slice(0, 500),
      stack:       (stack ?? '').slice(0, 3000),
      context:     context.slice(0, 100),
      app_version: APP_VERSION,
    });
  } catch {
    // fail silently — le logger ne doit jamais crasher l'app
  }
}
