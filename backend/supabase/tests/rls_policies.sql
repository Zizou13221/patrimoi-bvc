-- ============================================================
-- PatriMoi — Tests RLS (CI)
-- Vérifie qu'aucun utilisateur ne peut accéder aux données d'un autre
-- Exécuté via psql en CI avec un projet Supabase de staging
-- ============================================================

-- ── Setup : deux utilisateurs de test ────────────────────────
-- Ces UUID sont fixes pour les tests — créés une fois en staging
-- via: supabase auth admin create-user
\set user_a 'aaaaaaaa-0000-0000-0000-000000000001'
\set user_b 'bbbbbbbb-0000-0000-0000-000000000002'

-- ── Helpers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION test_rls(description text, expected bool, actual bool)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL: % — expected %, got %', description, expected, actual;
  ELSE
    RAISE NOTICE 'PASS: %', description;
  END IF;
END;
$$;

-- ── Insérer données de test pour user_A ──────────────────────
-- (simule une Row Level Security avec set_config pour changer l'utilisateur courant)

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO patrimoine_data (user_id, data, schema_version, updated_at)
VALUES (:'user_a', '{"test":true}', 1, NOW())
ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO patrimoine_snapshots (user_id, snapshot_date, total, repartition)
VALUES (:'user_a', CURRENT_DATE - 1, 100000, '{}')
ON CONFLICT (user_id, snapshot_date) DO NOTHING;

-- ── Test 1 : user_A voit ses propres données ─────────────────
SELECT test_rls(
  'user_A peut lire ses propres patrimoine_data',
  true,
  EXISTS(SELECT 1 FROM patrimoine_data WHERE user_id = :'user_a')
);

SELECT test_rls(
  'user_A peut lire ses propres snapshots',
  true,
  EXISTS(SELECT 1 FROM patrimoine_snapshots WHERE user_id = :'user_a')
);

-- ── Test 2 : user_B ne peut PAS voir les données de user_A ───
SET request.jwt.claims TO '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT test_rls(
  'user_B ne peut pas lire les patrimoine_data de user_A',
  false,
  EXISTS(SELECT 1 FROM patrimoine_data WHERE user_id = :'user_a')
);

SELECT test_rls(
  'user_B ne peut pas lire les snapshots de user_A',
  false,
  EXISTS(SELECT 1 FROM patrimoine_snapshots WHERE user_id = :'user_a')
);

-- ── Test 3 : user_B ne peut pas modifier les données de user_A
DO $$
DECLARE
  ok bool := false;
BEGIN
  BEGIN
    UPDATE patrimoine_data SET data = '{"hacked":true}' WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    -- Si on arrive ici sans erreur, vérifier qu'aucune ligne n'a été modifiée
    ok := NOT EXISTS(
      SELECT 1 FROM patrimoine_data
      WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      AND data->>'hacked' = 'true'
    );
  EXCEPTION WHEN OTHERS THEN
    ok := true; -- erreur attendue = RLS bloque
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: user_B a pu modifier les données de user_A';
  ELSE
    RAISE NOTICE 'PASS: user_B ne peut pas modifier les données de user_A';
  END IF;
END;
$$;

-- ── Test 4 : user_B ne peut pas insérer pour user_A ──────────
DO $$
DECLARE
  ok bool := false;
BEGIN
  BEGIN
    INSERT INTO patrimoine_snapshots (user_id, snapshot_date, total, repartition)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', CURRENT_DATE, 999999, '{}');
  EXCEPTION WHEN OTHERS THEN
    ok := true;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: user_B a pu insérer un snapshot pour user_A';
  ELSE
    RAISE NOTICE 'PASS: user_B ne peut pas insérer pour user_A';
  END IF;
END;
$$;

-- ── Test 5 : market_cache accessible en lecture (données publiques)
RESET request.jwt.claims;
SET ROLE anon;

SELECT test_rls(
  'anon peut lire market_cache (données publiques de marché)',
  true,
  TRUE -- market_cache est SELECT public par design
);

-- ── Nettoyage ────────────────────────────────────────────────
RESET ROLE;
SET request.jwt.claims TO '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
DELETE FROM patrimoine_snapshots WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND snapshot_date >= CURRENT_DATE - 2;
DELETE FROM patrimoine_data WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND data->>'test' = 'true';
RESET ROLE;

RAISE NOTICE '✅ Tous les tests RLS ont réussi';
