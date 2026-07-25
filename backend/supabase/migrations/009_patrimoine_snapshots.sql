-- ============================================================
-- Migration 009 — Table patrimoine_snapshots (R7 P1)
-- ============================================================
--
-- Extrait l'historique du jsonb patrimoine_data._history
-- vers une table dédiée patrimoine_snapshots.
--
-- Avantages :
--   • Payload sync divisé par un ordre de grandeur
--     (plus de 400 snapshots ré-uploadés à chaque mutation)
--   • Historique illimité (plus de limite à 13 mois)
--   • Candidat PatriMoi+ : historique illimité comme feature premium
--
-- Deploy : coller dans le SQL Editor Supabase
-- ============================================================

-- ── 1. Créer la table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patrimoine_snapshots (
  user_id    uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date           NOT NULL,
  val        numeric(20, 2) NOT NULL,
  created_at timestamptz    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.patrimoine_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own snapshots"
  ON public.patrimoine_snapshots
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Index (lectures par user sur plage de dates) ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
  ON public.patrimoine_snapshots (user_id, date);

-- ── 4. Migration one-shot — copier _history existant ─────────────────────────
-- On insère les snapshots depuis le jsonb _history de chaque utilisateur.
-- ON CONFLICT DO NOTHING = idempotent si la migration est rejouée.
INSERT INTO public.patrimoine_snapshots (user_id, date, val)
SELECT
  pd.user_id,
  (entry ->> 'date')::date       AS date,
  (entry ->> 'val')::numeric     AS val
FROM
  public.patrimoine_data pd,
  jsonb_array_elements(pd.data -> '_history') AS entry
WHERE
  pd.data ? '_history'
  AND jsonb_array_length(pd.data -> '_history') > 0
  AND (entry ->> 'date') IS NOT NULL
  AND (entry ->> 'val')  IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;

-- ── 5. Purger _history du jsonb (maintenant dans sa propre table) ─────────────
-- La clé _history est supprimée de patrimoine_data.data.
-- Les données sont déjà copiées ci-dessus.
UPDATE public.patrimoine_data
SET data = data - '_history'
WHERE data ? '_history';

-- ── 6. Commentaires ───────────────────────────────────────────────────────────
COMMENT ON TABLE public.patrimoine_snapshots IS
  'Snapshots journaliers de valeur totale du patrimoine. '
  'Un seul upsert par jour par user (clé : user_id + date). '
  'Remplace _history embarqué dans patrimoine_data.data (migration 009).';

COMMENT ON COLUMN public.patrimoine_snapshots.val IS
  'Valeur totale du patrimoine en DH à la date du snapshot.';
