#!/bin/bash
# ============================================================
# PatriMoi — Migrations Phase 2 (DAT v2.0)
# Double-cliquer pour exécuter dans Terminal
# ============================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   PatriMoi — Migrations SQL Phase 2     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Trouver la CLI Supabase ──────────────────────────────────
SUPABASE=""
for path in \
  "$(which supabase 2>/dev/null)" \
  "/opt/homebrew/bin/supabase" \
  "/usr/local/bin/supabase" \
  "$HOME/.local/bin/supabase" \
  "$HOME/bin/supabase"; do
  if [ -x "$path" ]; then
    SUPABASE="$path"
    break
  fi
done

if [ -z "$SUPABASE" ]; then
  echo "❌  CLI Supabase introuvable."
  echo "    Installe-la avec : brew install supabase/tap/supabase"
  echo ""
  echo "    Ou colle manuellement le fichier suivant dans l'éditeur SQL Supabase :"
  echo "    $(pwd)/backend/supabase/migrations/ALL_MIGRATIONS.sql"
  echo ""
  read -p "Appuie sur Entrée pour ouvrir l'éditeur SQL Supabase dans Chrome..."
  open -a "Google Chrome" "https://supabase.com/dashboard/project/fwgsdjhavrqrqwmydwxf/sql/new"
  exit 1
fi

echo "✅  CLI trouvée : $SUPABASE"
echo "    Version : $($SUPABASE --version)"
echo ""

# ── Vérifier le projet lié ────────────────────────────────────
PROJECT_REF=$(cat supabase/.temp/linked-project.json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['ref'])" 2>/dev/null || echo "")

if [ -z "$PROJECT_REF" ]; then
  echo "⚠️   Projet non lié. Exécution de : supabase link"
  $SUPABASE link
fi

echo "📦  Projet : $PROJECT_REF"
echo ""

# ── Exécuter les migrations ──────────────────────────────────
run_migration() {
  local file="$1"
  local name="$2"
  echo "▶  $name..."
  if $SUPABASE db query --file "$file" 2>&1; then
    echo "   ✅ OK"
  else
    echo "   ⚠️  Erreur — voir message ci-dessus"
  fi
  echo ""
}

run_migration "backend/supabase/migrations/001_patrimoine_snapshots.sql" "001 — Table patrimoine_snapshots"
run_migration "backend/supabase/migrations/002_market_cache.sql" "002 — Table market_cache"
run_migration "backend/supabase/migrations/003_pg_cron_jobs.sql" "003 — Jobs pg_cron"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  Migrations 001-003 appliquées !"
echo ""
echo "⚠️  Migration 004 (historique JSONB → snapshots) :"
echo "   → À exécuter MANUELLEMENT après vérification des données."
echo "   → Fichier : backend/supabase/migrations/004_migrate_history.sql"
echo ""
echo "   Pour l'exécuter quand tu es prêt :"
echo "   $SUPABASE db query --file backend/supabase/migrations/004_migrate_history.sql"
echo ""
read -p "Appuie sur Entrée pour fermer..."
