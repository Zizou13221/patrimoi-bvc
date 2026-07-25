-- ============================================================
-- PatriMoi — Migration 011 : stats_admin restreint service_role
-- ============================================================
--
-- Contexte : schema.sql initial accordait SELECT sur stats_admin au rôle
-- `authenticated`, ce qui permettait à n'importe quel utilisateur connecté
-- de lire les métriques agrégées (DAU, MAU, etc.).
-- Migration 007 a corrigé cela pour les installations via migrations.
-- Cette migration 011 est idempotente et consolide l'état pour tout
-- environnement où schema.sql aurait été ré-appliqué manuellement.
--
-- Après cette migration :
--   • anon        → aucun accès
--   • authenticated → aucun accès  (utilisateurs de l'app)
--   • service_role  → SELECT       (backend admin uniquement)
-- ============================================================

-- Révoquer tous les accès existants (idempotent)
REVOKE ALL PRIVILEGES ON public.stats_admin FROM anon;
REVOKE ALL PRIVILEGES ON public.stats_admin FROM authenticated;

-- Accorder uniquement au rôle service_role (backend admin)
GRANT SELECT ON public.stats_admin TO service_role;

-- Vérification (commentée — à exécuter manuellement pour confirmer)
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'stats_admin';
-- Résultat attendu : une seule ligne avec grantee='service_role', privilege_type='SELECT'
