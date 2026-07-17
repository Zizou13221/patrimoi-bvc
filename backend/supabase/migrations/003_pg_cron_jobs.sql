-- ============================================================
-- PatriMoi — Migration 003 : jobs pg_cron
-- Phase 2 DAT v2.0
--
-- Deux jobs automatiques :
--   1. Snapshots journaliers patrimoine (23h59 Casablanca)
--   2. Ingestion BVC nightly (00h30 Casablanca, après clôture)
--
-- Prérequis : activer l'extension pg_cron dans Supabase
--   Dashboard → Database → Extensions → pg_cron → Enable
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- ── Job 1 : Snapshots journaliers ────────────────────────────
-- 23h59 heure de Casablanca = 22h59 UTC (UTC+1 hiver, UTC en été)
-- On cible 23h00 UTC pour couvrir les deux saisons sans ambiguïté
SELECT cron.schedule(
  'patrimoi-daily-snapshots',      -- nom du job
  '59 22 * * *',                   -- 22h59 UTC = ~23h59 Casablanca
  $$
  INSERT INTO public.patrimoine_snapshots (user_id, snapshot_date, total_dh, detail)
  SELECT
    pd.user_id,
    (NOW() AT TIME ZONE 'Africa/Casablanca')::date AS snapshot_date,

    -- Calcul du total patrimoine depuis le JSONB
    -- On extrait le total s'il est pré-calculé, sinon 0 (le client le mettra à jour)
    COALESCE(
      (pd.data->>'totalCache')::numeric,
      0
    ) AS total_dh,

    -- Détail par catégorie (pour graphiques futurs)
    jsonb_build_object(
      'schemaVersion', pd.data->>'schemaVersion'
    ) AS detail

  FROM public.patrimoine_data pd
  INNER JOIN public.profiles p ON p.id = pd.user_id
  WHERE p.plan = 'plus'           -- PatriMoi+ uniquement
    AND pd.data IS NOT NULL

  ON CONFLICT (user_id, snapshot_date)
  DO UPDATE SET
    total_dh   = EXCLUDED.total_dh,
    detail     = EXCLUDED.detail,
    created_at = NOW()
  WHERE patrimoine_snapshots.total_dh = 0  -- ne pas écraser une valeur client valide
  $$
);

-- ── Job 2 : Ingestion BVC nightly ────────────────────────────
-- Appelle l'Edge Function market-data-proxy pour récupérer les cours BVC
-- et les stocker dans market_cache (élimine la dépendance à GitHub raw)
-- 01h00 UTC = après clôture BVC (14h30 Casablanca) + traitement GitHub
SELECT cron.schedule(
  'patrimoi-bvc-ingest',
  '0 1 * * *',                    -- 01h00 UTC tous les jours
  $$
  -- Appel HTTP vers l'Edge Function via pg_net (extension Supabase)
  -- Si pg_net n'est pas disponible, le client reste sur le proxy classique
  SELECT net.http_post(
    url := 'https://fwgsdjhavrqrqwmydwxf.supabase.co/functions/v1/market-data-proxy-ingest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' ||
               current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{"source": "bvc"}'::jsonb
  );
  $$
);

-- ── Alternative sans pg_net : ingestion SQL directe ──────────
-- Si pg_net n'est pas activé, commenter le job 2 ci-dessus
-- et utiliser cette version qui lit directement market_cache
-- (à remplir manuellement ou via un script externe)

-- ── Vérification des jobs ────────────────────────────────────
-- Exécuter après déploiement pour confirmer :
-- SELECT jobid, jobname, schedule, active FROM cron.job;

-- ── Suppression des jobs (si besoin de rollback) ─────────────
-- SELECT cron.unschedule('patrimoi-daily-snapshots');
-- SELECT cron.unschedule('patrimoi-bvc-ingest');
