-- ============================================================
-- Migration 010 — Purge données de marché dans patrimoine_data (R8)
-- ============================================================
--
-- Contexte :
--   Depuis R8, les données de marché (cours BVC, taux devises, prixOr,
--   variation, bvcUpdated) ne sont plus envoyées à Supabase. Elles sont
--   recalculées à chaque lancement depuis les APIs.
--
--   Cette migration purge les données de marché déjà stockées dans les
--   lignes existantes de patrimoine_data.data, pour aligner l'historique
--   avec le nouveau comportement.
--
-- Impact :
--   • Aucune perte de données utilisateur — seuls les champs recalculés
--     automatiquement (cours, taux, variation, bvcUpdated) sont supprimés.
--   • La colonne `prixOr` dans data est retirée (recalculée au boot).
--   • Les champs cours/taux/variation sur les items PEA, CT.actions
--     et liquidites.devises sont retirés via jsonb_agg.
--
-- Deploy : coller dans le SQL Editor Supabase
-- ============================================================

-- ── 1. Supprimer les champs racine de marché ──────────────────────────────────
-- prixOr et bvcUpdated sont recalculés depuis les APIs à chaque lancement.
UPDATE public.patrimoine_data
SET data = data
  - 'prixOr'
  - 'bvcUpdated'
  - 'lastUpdate'
WHERE
  data ? 'prixOr'
  OR data ? 'bvcUpdated'
  OR data ? 'lastUpdate';

-- ── 2. Purger cours des items PEA ──────────────────────────────────────────────
-- Chaque élément du tableau pea peut avoir un champ "cours" (cours BVC).
UPDATE public.patrimoine_data
SET data = jsonb_set(
  data,
  '{pea}',
  (
    SELECT COALESCE(jsonb_agg(item - 'cours'), '[]'::jsonb)
    FROM jsonb_array_elements(data -> 'pea') AS item
  )
)
WHERE
  data ? 'pea'
  AND jsonb_typeof(data -> 'pea') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(data -> 'pea') AS item
    WHERE item ? 'cours'
  );

-- ── 3. Purger cours des actions CT ────────────────────────────────────────────
UPDATE public.patrimoine_data
SET data = jsonb_set(
  data,
  '{ct,actions}',
  (
    SELECT COALESCE(jsonb_agg(item - 'cours'), '[]'::jsonb)
    FROM jsonb_array_elements(data -> 'ct' -> 'actions') AS item
  )
)
WHERE
  data -> 'ct' ? 'actions'
  AND jsonb_typeof(data -> 'ct' -> 'actions') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(data -> 'ct' -> 'actions') AS item
    WHERE item ? 'cours'
  );

-- ── 4. Purger taux et variation des devises ───────────────────────────────────
UPDATE public.patrimoine_data
SET data = jsonb_set(
  data,
  '{liquidites,devises}',
  (
    SELECT COALESCE(jsonb_agg(item - 'taux' - 'variation'), '[]'::jsonb)
    FROM jsonb_array_elements(data -> 'liquidites' -> 'devises') AS item
  )
)
WHERE
  data -> 'liquidites' ? 'devises'
  AND jsonb_typeof(data -> 'liquidites' -> 'devises') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(data -> 'liquidites' -> 'devises') AS item
    WHERE item ? 'taux' OR item ? 'variation'
  );

-- ── 5. Vérification (optionnelle, à exécuter après) ───────────────────────────
-- SELECT
--   COUNT(*) FILTER (WHERE data ? 'prixOr')     AS rows_with_prixOr,
--   COUNT(*) FILTER (WHERE data ? 'bvcUpdated') AS rows_with_bvcUpdated,
--   COUNT(*) FILTER (WHERE EXISTS (
--     SELECT 1 FROM jsonb_array_elements(data->'pea') e WHERE e ? 'cours'
--   )) AS pea_rows_with_cours
-- FROM public.patrimoine_data;
-- Tous les compteurs doivent être 0 après la migration.
