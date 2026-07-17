#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
WORKSPACE="$HOME/Claude/Projects/PatriMoi"

echo "=== Fix Podfile v3 — post_install dans target + config[:reactNativePath] ==="

# Backup
cp "$APP/ios/Podfile" "$APP/ios/Podfile.bak3"
echo "✓ Backup: Podfile.bak3"

# Copier le Podfile corrigé v2
cp "$WORKSPACE/Podfile_fixed2.rb" "$APP/ios/Podfile"
echo "✓ Podfile v2 copie"

# Sync workspace → PatriMoiApp (JS)
echo ""
echo "▸ Sync JS files..."
rsync -a --exclude='node_modules' --exclude='.git' --exclude='ios/Pods' \
  "$WORKSPACE/src/" "$APP/src/" 2>/dev/null || true

# Reinstaller les pods
echo ""
echo "▸ Installation des pods..."
cd "$APP/ios"
pod install 2>&1 | tail -15

echo ""
echo "=== TERMINE ==="
echo "Dans Xcode: Product → Run (Cmd+R)"
