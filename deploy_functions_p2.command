#!/bin/bash
# ============================================================
# PatriMoi — Deploy Edge Functions Phase 2 (DAT v2.0)
# Double-cliquer pour exécuter dans Terminal
# ============================================================

set -e
cd "$(dirname "$0")/backend"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   PatriMoi — Deploy Edge Functions Phase 2  ║"
echo "╚══════════════════════════════════════════════╝"
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
  read -p "Appuie sur Entrée pour fermer..."
  exit 1
fi

echo "✅  CLI : $SUPABASE ($($SUPABASE --version))"
echo ""

# ── market-data-proxy ────────────────────────────────────────
echo "▶  Déploiement : market-data-proxy..."
if $SUPABASE functions deploy market-data-proxy 2>&1; then
  echo "   ✅ OK"
else
  echo "   ⚠️  Erreur — voir message ci-dessus"
fi
echo ""

# ── market-data-proxy-ingest ─────────────────────────────────
echo "▶  Déploiement : market-data-proxy-ingest..."
if $SUPABASE functions deploy market-data-proxy-ingest 2>&1; then
  echo "   ✅ OK"
else
  echo "   ⚠️  Erreur — voir message ci-dessus"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  Edge Functions déployées !"
echo ""
echo "Prochaine étape (Phase 1) :"
echo "  1. Migration 006 : supabase db query --linked --file backend/supabase/migrations/006_rate_limits.sql"
echo "  2. fix_all.command pour sync JS vers PatriMoiApp"
echo ""
read -p "Appuie sur Entrée pour fermer..."
