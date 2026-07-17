-- ============================================================
-- PatriMoi — Migration 006 : Rate Limiting
-- Phase 1 DAT v2.0 — Sécurité
--
-- Table rate_limits : fenêtre glissante par user_id ou IP
-- Fonction check_rate_limit() : appelée depuis l'Edge Function
-- Nettoyage automatique des entrées > 1h via pg_cron
-- ============================================================

-- ── Table rate_limits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          BIGSERIAL    PRIMARY KEY,
  identifier  TEXT         NOT NULL,          -- user_id ou IP
  endpoint    TEXT         NOT NULL,          -- ex: 'market-data-proxy'
  hit_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint
  ON public.rate_limits (identifier, endpoint, hit_at DESC);

-- Pas de RLS — accès uniquement via service_role (Edge Function)
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

-- ── Fonction check_rate_limit ─────────────────────────────────
-- Retourne TRUE si la limite est dépassée, FALSE sinon.
-- Paramètres : identifier, endpoint, max_hits, window_seconds
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier    TEXT,
  p_endpoint      TEXT,
  p_max_hits      INT  DEFAULT 60,    -- 60 appels par fenêtre
  p_window_sec    INT  DEFAULT 60     -- fenêtre de 60 secondes
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  -- Compter les hits dans la fenêtre glissante
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND endpoint   = p_endpoint
    AND hit_at     > NOW() - (p_window_sec || ' seconds')::INTERVAL;

  IF v_count >= p_max_hits THEN
    RETURN TRUE;  -- limite dépassée
  END IF;

  -- Enregistrer ce nouveau hit
  INSERT INTO public.rate_limits (identifier, endpoint)
  VALUES (p_identifier, p_endpoint);

  RETURN FALSE;  -- dans les limites
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;

-- ── Nettoyage automatique (pg_cron — toutes les heures) ───────
SELECT cron.schedule(
  'patrimoi-rate-limits-cleanup',
  '0 * * * *',
  $$DELETE FROM public.rate_limits WHERE hit_at < NOW() - INTERVAL '1 hour'$$
);
