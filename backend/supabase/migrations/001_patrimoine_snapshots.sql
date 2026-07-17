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
