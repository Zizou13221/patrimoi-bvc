/**
 * PatriMoi — Edge Function : delete-user (R6 P0)
 *
 * Endpoint : POST /functions/v1/delete-user
 *
 * Supprime définitivement le compte de l'utilisateur connecté :
 *   1. Vérifie le JWT (utilisateur doit être authentifié)
 *   2. Supprime les données patrimoine dans `patrimoine_data`
 *   3. Supprime le profil dans `profiles`
 *   4. Supprime l'entrée Auth Supabase (via service_role)
 *
 * Deploy: supabase functions deploy delete-user
 *
 * Variables d'environnement requises (gérées automatiquement par Supabase) :
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405);
  }

  // ── 1. Extraire et vérifier le JWT ────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Non authentifié' }, 401);
  }

  const supabaseUrl        = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Client utilisateur — valide le JWT et récupère l'identité
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Session invalide ou expirée' }, 401);
  }

  const userId = user.id;

  // ── 2. Supprimer les données utilisateur (patrimoine_data + profiles) ─────
  // Client service_role — nécessaire pour opérations admin
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Supprimer les données patrimoine
  const { error: dataError } = await adminClient
    .from('patrimoine_data')
    .delete()
    .eq('user_id', userId);

  if (dataError) {
    console.error('[delete-user] Erreur suppression patrimoine_data:', dataError.message);
    // On continue quand même — l'utilisateur Auth sera supprimé
  }

  // Supprimer le profil (table profiles si elle existe)
  await adminClient
    .from('profiles')
    .delete()
    .eq('id', userId);

  // ── 3. Supprimer l'utilisateur Auth ──────────────────────────────────────
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('[delete-user] Erreur suppression Auth:', deleteError.message);
    return json({ error: 'Échec de la suppression du compte. Réessayez ou contactez le support.' }, 500);
  }

  console.log('[delete-user] Compte supprimé avec succès:', userId);
  return json({ success: true, message: 'Compte supprimé.' });
});
