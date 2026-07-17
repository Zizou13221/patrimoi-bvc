#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
WORKSPACE="$HOME/Claude/Projects/PatriMoi"

echo "=== Fix Podfile — supprimer double post_install ==="

# Backup
cp "$APP/ios/Podfile" "$APP/ios/Podfile.bak2"
echo "✓ Backup: Podfile.bak2"

# Copier le Podfile corrigé
cp "$WORKSPACE/Podfile_fixed.rb" "$APP/ios/Podfile"
echo "✓ Podfile corrigé copié"

# Reinstaller les pods
echo ""
echo "▸ Installation des pods iOS..."
cd "$APP/ios"
pod install 2>&1 | tail -30

echo ""
echo "=== TERMINE ==="
echo "Maintenant dans Xcode:"
echo "  1. Product → Clean Build Folder (Cmd+Shift+K)"
echo "  2. Run (Cmd+R)"
