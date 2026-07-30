/**
 * PatriMoi — Edge Function : delete-account
 *
 * Flux :
 *   1. Vérifie le JWT (Authorization header) via supabase.auth.getUser()
 *   2. Supprime toutes les données app de l'utilisateur (patrimoine_data,
 *      patrimoine_snapshots, market_cache si lié à l'utilisateur)
 *   3. Supprime le compte auth via supabase.auth.admin.deleteUser()
 *      → nécessite SUPABASE_SERVICE_ROLE_KEY (jamais côté client)
 *
 * Déploiement :
 *   supabase functions deploy delete-account --project-ref fwgsdjhavrqrqwmydwxf
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Vérification JWT ─────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant ou invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client avec le JWT de l'utilisateur (accès restreint par RLS)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Récupère l'utilisateur authentifié depuis le JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log(`[delete-account] Suppression demandée pour user: ${userId}`)

    // ── 2. Client admin (service_role) ──────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── 3. Suppression des données app ──────────────────────────

    // patrimoine_data (données patrimoniales JSONB)
    const { error: dataErr } = await supabaseAdmin
      .from('patrimoine_data')
      .delete()
      .eq('user_id', userId)

    if (dataErr) {
      console.error('[delete-account] Erreur suppression patrimoine_data:', dataErr.message)
      // On continue — on veut quand même supprimer le compte auth
    }

    // patrimoine_snapshots (historique)
    const { error: snapErr } = await supabaseAdmin
      .from('patrimoine_snapshots')
      .delete()
      .eq('user_id', userId)

    if (snapErr) {
      console.error('[delete-account] Erreur suppression patrimoine_snapshots:', snapErr.message)
    }

    // profiles (si table existe)
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('[delete-account] profiles suppression:', error.message)
      })

    // ── 4. Suppression du compte auth ───────────────────────────
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteErr) {
      console.error('[delete-account] Erreur deleteUser:', deleteErr.message)
      return new Response(
        JSON.stringify({ error: `Erreur suppression compte : ${deleteErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-account] Compte supprimé avec succès : ${userId}`)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[delete-account] Erreur inattendue:', message)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
