/**
 * PatriMoi — Edge Function : patrimoine-stats
 *
 * Endpoint : GET /functions/v1/patrimoine-stats
 * Retourne des stats agrégées du patrimoine de l'utilisateur connecté.
 *
 * Réponse :
 *   {
 *     userId: string,
 *     totalActifs: number,        // nombre de catégories renseignées
 *     derniereMaj: string | null, // dernière updated_at depuis patrimoine_data
 *     hasData: boolean            // true si l'utilisateur a déjà sauvegardé des données
 *   }
 *
 * Deploy: supabase functions deploy patrimoine-stats
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helper : réponse JSON ─────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // ── 1. Authentification ────────────────────────────────────────────────────
  // On récupère le JWT depuis le header Authorization
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return json({ error: 'Token manquant' }, 401);
  }

  // Client Supabase avec le JWT de l'utilisateur
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // Vérifier que le token est valide et récupérer l'utilisateur
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: 'Non autorisé' }, 401);
  }

  // ── 2. Récupérer les données patrimoine depuis la DB ───────────────────────
  const { data, error } = await supabase
    .from('patrimoine_data')
    .select('data, updated_at')
    .eq('user_id', user.id)
    .single();

  // Pas encore de données = normal (premier lancement)
  if (error?.code === 'PGRST116') {
    return json({
      userId:      user.id,
      hasData:     false,
      totalActifs: 0,
      derniereMaj: null,
    });
  }

  if (error) {
    return json({ error: error.message }, 500);
  }

  // ── 3. Calculer les stats ──────────────────────────────────────────────────
  // On compte combien de catégories d'actifs ont au moins une entrée
  const patrimoineData = data?.data ?? {};

  const CATEGORIES = ['immobilier', 'pea', 'assuranceVie', 'crypto', 'cash', 'or', 'autres'];
  let totalActifs = 0;

  for (const cat of CATEGORIES) {
    const val = patrimoineData[cat];
    if (Array.isArray(val) && val.length > 0) totalActifs++;
    else if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Objet avec des sous-champs (ex: ct avec actions/obligations)
      const hasContent = Object.values(val).some(
        v => Array.isArray(v) ? v.length > 0 : Boolean(v)
      );
      if (hasContent) totalActifs++;
    }
  }

  // ── 4. Retourner la réponse ────────────────────────────────────────────────
  return json({
    userId:      user.id,
    hasData:     true,
    totalActifs,
    derniereMaj: data?.updated_at ?? null,
  });
});
