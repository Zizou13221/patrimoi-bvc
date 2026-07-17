#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"

echo "=== Sync tests → PatriMoiApp ==="
mkdir -p "$APP/__tests__"
cp -r "$HOME/Claude/Projects/PatriMoi/__tests__/." "$APP/__tests__/"
cp "$HOME/Claude/Projects/PatriMoi/jsconfig.json" "$APP/jsconfig.json" 2>/dev/null || true
mkdir -p "$APP/.github/workflows"
cp -r "$HOME/Claude/Projects/PatriMoi/.github/." "$APP/.github/" 2>/dev/null || true
# Sync new utils (Phase 3-5)
for f in migrations.js history.js biometrics.js; do
  SRC="$HOME/Claude/Projects/PatriMoi/src/utils/$f"
  [ -f "$SRC" ] && cp "$SRC" "$APP/src/utils/$f" && echo "✓ $f"
done
echo "✓ Fichiers synchronisés"

echo ""
echo "=== npx jest --testPathPattern='__tests__/' ==="
cd "$APP"
npx jest --forceExit --testPathPattern="__tests__/" 2>&1
echo ""
echo "=== DONE ==="
