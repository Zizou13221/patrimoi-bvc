-- ============================================================
-- PatriMoi — Migration 007 : stats_admin enrichi (Phase 6 DAT v2.0)
-- Vue administrative sans donnée patrimoniale individuelle (RGPD)
-- ============================================================

-- ── Vue stats globales ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW stats_admin AS
WITH
-- Rétention : utilisateurs actifs par fenêtre temporelle
retention AS (
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE updated_at >= NOW() - INTERVAL '1 day')   AS dau,
    COUNT(DISTINCT user_id) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')  AS wau,
    COUNT(DISTINCT user_id) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 days') AS mau,
    COUNT(DISTINCT user_id)                                                           AS total_users
  FROM patrimoine_data
),

-- Fréquence de sync : distribution des syncs sur 7 jours
sync_freq AS (
  SELECT
    PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY syncs_7d) AS median_syncs_7d,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY syncs_7d) AS p95_syncs_7d,
    AVG(syncs_7d)                                           AS avg_syncs_7d
  FROM (
    SELECT
      user_id,
      COUNT(*) AS syncs_7d
    FROM patrimoine_snapshots
    WHERE snapshot_date >= NOW() - INTERVAL '7 days'
    GROUP BY user_id
  ) s
),

-- BVC : fraîcheur du cache marché
bvc_health AS (
  SELECT
    MAX(fetched_at)                                                  AS last_bvc_update,
    NOW() - MAX(fetched_at)                                          AS bvc_age,
    (NOW() - MAX(fetched_at)) > INTERVAL '35 minutes'               AS bvc_stale,
    COUNT(*) FILTER (WHERE fetched_at >= NOW() - INTERVAL '24 hours') AS bvc_fetches_24h
  FROM market_cache
  WHERE source = 'bvc'
),

-- Snapshots : couverture et régularité
snapshot_coverage AS (
  SELECT
    COUNT(DISTINCT user_id)                                                              AS users_with_snapshots,
    COUNT(DISTINCT user_id) FILTER (WHERE snapshot_date = CURRENT_DATE - 1)            AS users_snapshot_yesterday,
    COUNT(*)                                                                              AS total_snapshots,
    MIN(snapshot_date)                                                                    AS oldest_snapshot
  FROM patrimoine_snapshots
)

SELECT
  -- Rétention
  r.dau,
  r.wau,
  r.mau,
  r.total_users,
  ROUND(r.dau::numeric / NULLIF(r.mau, 0) * 100, 1) AS dau_mau_ratio_pct,

  -- Sync
  ROUND(sf.median_syncs_7d::numeric, 1) AS median_syncs_7d,
  ROUND(sf.avg_syncs_7d::numeric, 1)    AS avg_syncs_7d,
  ROUND(sf.p95_syncs_7d::numeric, 1)    AS p95_syncs_7d,

  -- BVC
  bh.last_bvc_update,
  EXTRACT(EPOCH FROM bh.bvc_age) / 60   AS bvc_age_minutes,
  bh.bvc_stale,
  bh.bvc_fetches_24h,

  -- Snapshots
  sc.users_with_snapshots,
  sc.users_snapshot_yesterday,
  sc.total_snapshots,
  sc.oldest_snapshot,

  -- Timestamp
  NOW() AS generated_at

FROM retention r, sync_freq sf, bvc_health bh, snapshot_coverage sc;

-- Accès admin uniquement (via service role, pas anon)
REVOKE ALL ON stats_admin FROM anon, authenticated;
GRANT SELECT ON stats_admin TO service_role;

-- ── Commentaire ──────────────────────────────────────────────────────────────
COMMENT ON VIEW stats_admin IS
  'PatriMoi — Métriques opérationnelles agrégées. Aucune donnée patrimoniale individuelle. RGPD-safe.';
