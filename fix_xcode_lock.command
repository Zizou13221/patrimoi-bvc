#!/bin/bash
echo "=== FIX XCODE LOCK ==="

echo "1. Arrêt des process Xcode/build en cours..."
pkill -f "XCBBuildService" 2>/dev/null
pkill -f "xcodebuild" 2>/dev/null
pkill -f "com.apple.dt.Xcode" 2>/dev/null
sleep 2

echo "2. Suppression du build.db verrouillé..."
DB="$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-aooligjluklzhnegykuvnmztozxz/Build/Intermediates.noindex/XCBuildData/build.db"
rm -f "$DB" && echo "   ✓ build.db supprimé" || echo "   Déjà supprimé ou introuvable"

echo "3. Clean Derived Data complet pour PatriMoiApp..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-aooligjluklzhnegykuvnmztozxz"
echo "   ✓ DerivedData PatriMoiApp supprimé"

echo ""
echo "=== FAIT ==="
echo "→ Ouvre Xcode, fais Shift+Cmd+K (Clean Build Folder) puis Cmd+R"
echo ""
read -p "Appuie sur Entrée pour fermer..."
