-- ============================================================
-- PatriMoi — Migration 004 : éclater l'historique JSONB
-- Phase 2 DAT v2.0 — script one-shot
--
-- Ce script migre le tableau history[] existant dans patrimoine_data.data
-- vers la table relationnelle patrimoine_snapshots.
--
-- IMPORTANT : exécuter APRÈS la migration 001 (patrimoine_snapshots existe)
-- IMPORTANT : exécuter une seule fois en production
-- IMPORTANT : tester d'abord sur staging
--
-- Après exécution réussie :
--   1. Mettre à jour CURRENT_SCHEMA_VERSION à 3 dans migrations.js
--   2. Ajouter une migration client qui "gèle" le champ history (lecture seule)
--   3. NE PAS supprimer le champ history du JSONB immédiatement → schemaVersion 3
--      le marque comme obsolète; suppression physique en schemaVersion 4
-- ============================================================

BEGIN;

-- ── Étape 1 : Éclater l'historique ───────────────────────────
-- Chaque entrée du tableau history[] devient une ligne dans patrimoine_snapshots
INSERT INTO public.patrimoine_snapshots (user_id, snapshot_date, total_dh, detail)
SELECT
  pd.user_id,
  -- La date est stockée sous forme string 'YYYY-MM-DD' dans le JSONB
  (entry->>'date')::date                          AS snapshot_date,
  COALESCE((entry->>'val')::numeric, 0)           AS total_dh,
  '{}'::jsonb                                     AS detail
FROM
  public.patrimoine_data pd,
  jsonb_array_elements(pd.data->'history') AS entry
WHERE
  pd.data->'history' IS NOT NULL
  AND jsonb_typeof(pd.data->'history') = 'array'
  AND entry->>'date' IS NOT NULL
  AND entry->>'val'  IS NOT NULL
  -- Filtre les entrées invalides
  AND (entry->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
ON CONFLICT (user_id, snapshot_date)
DO UPDATE SET
  total_dh = EXCLUDED.total_dh
  -- Ne pas mettre à jour si la valeur existe déjà (pg_cron a pu créer un snapshot plus récent)
  WHERE patrimoine_snapshots.total_dh = 0;

-- ── Étape 2 : Compter les lignes migrées (pour vérification) ─
DO $$
DECLARE
  migrated_count INTEGER;
  users_count    INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.patrimoine_snapshots;
  SELECT COUNT(DISTINCT user_id) INTO users_count FROM public.patrimoine_snapshots;
  RAISE NOTICE 'Migration terminée : % snapshots pour % utilisateurs', migrated_count, users_count;
END $$;

-- ── Étape 3 : Marquer le champ history comme migré ───────────
-- On ajoute un flag historyMigrated au JSONB pour éviter une double migration
-- Le champ history[] reste en lecture seule jusqu'à schemaVersion 4
UPDATE public.patrimoine_data
SET data = data || '{"historyMigrated": true}'::jsonb
WHERE data->'history' IS NOT NULL
  AND jsonb_typeof(data->'history') = 'array'
  AND (data->>'historyMigrated') IS NULL;

COMMIT;

-- ── Vérification post-migration ───────────────────────────────
-- Exécuter séparément pour valider :
/*
SELECT
  u.email,
  COUNT(ps.id) AS snapshots_migrés,
  MIN(ps.snapshot_date) AS premier,
  MAX(ps.snapshot_date) AS dernier,
  MAX(ps.total_dh)      AS max_val
FROM public.patrimoine_snapshots ps
JOIN auth.users u ON u.id = ps.user_id
GROUP BY u.email
ORDER BY snapshots_migrés DESC;
*/

-- ── Rollback si besoin ────────────────────────────────────────
-- Pour annuler la migration (avant la mise à jour de schemaVersion) :
/*
BEGIN;
DELETE FROM public.patrimoine_snapshots;
UPDATE public.patrimoine_data
SET data = data - 'historyMigrated';
COMMIT;
*/
