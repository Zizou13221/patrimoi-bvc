#!/bin/bash
# PatriMoi — Install Supabase CLI + déploiement market-data-proxy

set -e
PROJECT_ID="fwgsdjhavrqrqwmydwxf"

echo "=== PatriMoi — Proxy Edge Function ==="

# Installer supabase CLI si absent
if ! command -v supabase &> /dev/null; then
  echo "▸ Installation Supabase CLI..."
  brew install supabase/tap/supabase
fi

echo "✓ Supabase CLI: $(supabase --version)"

# Login si nécessaire
echo "▸ Vérification session Supabase..."
supabase login --no-browser 2>/dev/null || true

# Déploiement — copie la fonction dans la structure attendue par la CLI
echo "▸ Déploiement market-data-proxy..."
DEPLOY_DIR=$(mktemp -d)
mkdir -p "$DEPLOY_DIR/supabase/functions/market-data-proxy"
cp "$HOME/Claude/Projects/PatriMoi/backend/supabase/functions/market-data-proxy/index.ts" \
   "$DEPLOY_DIR/supabase/functions/market-data-proxy/index.ts"
cd "$DEPLOY_DIR"
supabase functions deploy market-data-proxy \
  --project-ref "$PROJECT_ID" \
  --no-verify-jwt
rm -rf "$DEPLOY_DIR"

echo ""
echo "✓ Déployé ! Tests rapides :"
echo ""
curl -s "https://${PROJECT_ID}.supabase.co/functions/v1/market-data-proxy?source=or" | python3 -m json.tool 2>/dev/null || echo "(or)"
echo ""
curl -s "https://${PROJECT_ID}.supabase.co/functions/v1/market-data-proxy?source=bvc" | python3 -c "import sys,json; d=json.load(sys.stdin); print('BVC OK —', len(d.get('cours',{})), 'tickers')" 2>/dev/null || echo "(bvc)"
echo ""
echo "=== DONE ==="
