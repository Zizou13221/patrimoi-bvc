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
