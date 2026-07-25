-- ============================================================
-- Migration 008 — RPC verrou optimiste (R3 P0)
-- ============================================================
--
-- Remplace les upserts "aveugles" par une fonction atomique qui :
--   1. Détecte si le serveur a des données plus récentes (conflit)
--   2. Écrit toujours (last-write-wins) pour éviter les boucles de retry
--   3. Signale le conflit au client dans la réponse
--
-- Utilisation côté client (supabase-js) :
--   supabase.rpc('save_patrimoine_data', {
--     p_user_id:          '<uuid>',
--     p_data:             { ... },
--     p_known_updated_at: '2026-07-19T10:00:00Z'   -- ou null
--   })
--   → { updated_at: '...', had_conflict: false }
--
-- Deploy : supabase db push  OU  coller dans le SQL Editor Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_patrimoine_data(
  p_user_id           uuid,
  p_data              jsonb,
  p_known_updated_at  timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_updated_at  timestamptz;
  v_new_updated_at   timestamptz := NOW();
  v_had_conflict     boolean     := false;
BEGIN
  -- ── Vérification d'identité (SECURITY DEFINER → vérifier explicitement) ──
  -- Empêche un utilisateur d'écrire sur les données d'un autre.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501',
            HINT    = 'p_user_id doit correspondre à auth.uid()';
  END IF;

  -- ── Lire l'horodatage serveur AVANT l'upsert ─────────────────────────────
  SELECT updated_at
    INTO v_prev_updated_at
    FROM patrimoine_data
   WHERE user_id = p_user_id;

  -- ── Détection de conflit ──────────────────────────────────────────────────
  -- Conflit = le serveur a une version plus récente que ce que le client
  -- connaissait au moment de l'enqueue.
  IF p_known_updated_at IS NOT NULL
     AND v_prev_updated_at IS NOT NULL
     AND v_prev_updated_at > p_known_updated_at
  THEN
    v_had_conflict := true;
  END IF;

  -- ── Upsert atomique (always write — last-write-wins) ─────────────────────
  -- On écrit toujours pour ne pas laisser la mutation bloquée dans l'outbox.
  -- Le conflit est signalé au client pour qu'il puisse recharger si nécessaire.
  INSERT INTO patrimoine_data (user_id, data, updated_at)
  VALUES (p_user_id, p_data, v_new_updated_at)
  ON CONFLICT (user_id)
  DO UPDATE SET
    data       = EXCLUDED.data,
    updated_at = EXCLUDED.updated_at;

  -- ── Réponse ───────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'updated_at',   v_new_updated_at,
    'had_conflict', v_had_conflict
  );
END;
$$;

-- Donner accès aux utilisateurs authentifiés (SECURITY DEFINER gère l'auth.uid())
GRANT EXECUTE ON FUNCTION public.save_patrimoine_data(uuid, jsonb, timestamptz)
  TO authenticated;

-- Retirer l'accès anonyme par précaution
REVOKE EXECUTE ON FUNCTION public.save_patrimoine_data(uuid, jsonb, timestamptz)
  FROM anon, public;

COMMENT ON FUNCTION public.save_patrimoine_data IS
  'Upsert patrimoineData avec détection de conflit optimiste. '
  'Toujours last-write-wins pour éviter les boucles de retry. '
  'Retourne { updated_at, had_conflict }.';
