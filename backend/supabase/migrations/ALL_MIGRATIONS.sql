-- ============================================================
-- PatriMoi — Migration 001 : table patrimoine_snapshots
-- Phase 2 DAT v2.0 — externalisation de l'historique JSONB
--
-- Remplace le champ history[] dans le JSONB patrimoine_data.
-- Série temporelle relationnelle : 1 ligne = 1 snapshot journalier.
-- Avantages vs JSONB : illimité, indexé, requêtable, pg_cron-compatible.
-- ============================================================

-- ── Table principale ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patrimoine_snapshots (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE     NOT NULL,                        -- date locale Maroc (Africa/Casablanca)
  total_dh   NUMERIC(15,2) NOT NULL,                      -- valeur totale patrimoine en DH
  detail     JSONB       NOT NULL DEFAULT '{}'::jsonb,    -- détail par catégorie (optionnel, pour graphiques)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule ligne par (user, date) — upsert idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_user_date
  ON public.patrimoine_snapshots(user_id, snapshot_date);

-- Index pour récupérer l'historique d'un user trié par date
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date_desc
  ON public.patrimoine_snapshots(user_id, snapshot_date DESC);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.patrimoine_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: lecture propre"
  ON public.patrimoine_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "snapshots: insertion propre"
  ON public.patrimoine_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "snapshots: mise à jour propre"
  ON public.patrimoine_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "snapshots: suppression propre"
  ON public.patrimoine_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Policy spéciale : pg_cron tourne en tant que service_role
-- (contourne RLS côté service, pas besoin de policy supplémentaire)

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL ON public.patrimoine_snapshots TO authenticated;
GRANT ALL ON public.patrimoine_snapshots TO service_role;  -- pour pg_cron
GRANT USAGE, SELECT ON SEQUENCE public.patrimoine_snapshots_id_seq TO authenticated;

-- ── Commentaires ──────────────────────────────────────────────
COMMENT ON TABLE public.patrimoine_snapshots IS
  'Historique journalier du patrimoine total par utilisateur. Remplace le tableau history[] dans le JSONB patrimoine_data (schemaVersion 3).';

COMMENT ON COLUMN public.patrimoine_snapshots.detail IS
  'Détail optionnel par catégorie : {"liquidites": 50000, "pea": 120000, ...}. Utilisé pour les graphiques par catégorie dans PageDashboard.';



-- ============================================================
-- PatriMoi — Migration 002 : table market_cache
-- Phase 2 DAT v2.0 — cache centralisé des données de marché
--
-- Remplace la dépendance à raw.githubusercontent.com depuis le client.
-- Un job pg_cron ingère les cours BVC chaque soir → le client lit depuis
-- cette table (via l'Edge Function). Source unique, disponibilité garantie.
-- ============================================================

-- ── Table principale ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_cache (
  source      TEXT        PRIMARY KEY,    -- 'bvc' | 'or' | 'devises'
  payload     JSONB       NOT NULL,       -- données brutes (cours, prix, taux)
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at (réutilise la fonction existante)
CREATE OR REPLACE TRIGGER market_cache_updated_at
  BEFORE UPDATE ON public.market_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Row Level Security ────────────────────────────────────────
-- market_cache est public en lecture (cours de marché = données publiques)
-- Seul service_role (pg_cron, Edge Function) peut écrire
ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_cache: lecture publique"
  ON public.market_cache FOR SELECT
  TO authenticated, anon
  USING (true);

-- Pas de policy INSERT/UPDATE pour authenticated/anon → écriture réservée à service_role

-- ── Permissions ───────────────────────────────────────────────
GRANT SELECT ON public.market_cache TO authenticated, anon;
GRANT ALL    ON public.market_cache TO service_role;

-- ── Seed initial (évite un premier appel à vide) ─────────────
-- Sera écrasé par le premier job pg_cron
INSERT INTO public.market_cache (source, payload, fetched_at)
VALUES
  ('bvc',     '{"cours": {}, "updated": null}'::jsonb, NOW()),
  ('or',      '{"prixOr": null}'::jsonb,               NOW()),
  ('devises', '{}'::jsonb,                              NOW())
ON CONFLICT (source) DO NOTHING;

-- ── Commentaires ──────────────────────────────────────────────
COMMENT ON TABLE public.market_cache IS
  'Cache centralisé des données de marché (BVC, or, devises). Mis à jour par pg_cron et lu par l''Edge Function market-data-proxy. Élimine les appels directs depuis le client mobile.';

COMMENT ON COLUMN public.market_cache.payload IS
  'BVC: {"cours": {"ATW": {"cours": 714.80, "var_pct": 0.25}, ...}, "updated": "2026-07-10"}
Or:  {"prixOr": 4280}
Devises: {"USD": 10.22, "EUR": 10.81, "GBP": 12.65}';



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
