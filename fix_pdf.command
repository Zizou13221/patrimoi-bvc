#!/bin/bash
# fix_pdf.command — trouve et corrige TOUS les RNPDFExport.m que Xcode pourrait compiler
set -e

SRC=~/Claude/Projects/PatriMoi/ios_native/RNPDFExport.m
PBXPROJ=~/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj

echo "================================================"
echo " FIX AN_015 — RNPDFExport.m"
echo "================================================"
echo ""

# 1. Montrer ce que le pbxproj référence
echo "── RÉFÉRENCES DANS project.pbxproj ──────────────"
grep "RNPDFExport" "$PBXPROJ" 2>/dev/null || echo "(aucune ligne trouvée)"
echo ""

# 2. Trouver TOUS les RNPDFExport.m sur le disque
echo "── TOUS LES RNPDFExport.m TROUVÉS ──────────────"
FOUND=$(find ~/PatriMoiApp ~/Claude/Projects/PatriMoi ~/Library/Developer/Xcode/DerivedData -name "RNPDFExport.m" 2>/dev/null)
if [ -z "$FOUND" ]; then
  echo "(aucun fichier trouvé)"
else
  echo "$FOUND"
fi
echo ""

# 3. Montrer la ligne 3 de chaque copie trouvée (pour identifier laquelle est l'ancienne)
echo "── LIGNE 3 DE CHAQUE COPIE (avant fix) ─────────"
echo "$FOUND" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "  $f"
  echo "  → $(sed -n '3p' "$f" 2>/dev/null)"
  echo ""
done

# 4. Remplacer TOUTES les copies par la nouvelle version
echo "── REMPLACEMENT ─────────────────────────────────"
echo "$FOUND" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  cp "$SRC" "$f" && echo "  ✓ Remplacé : $f"
done
# S'assurer que la destination standard est aussi à jour
mkdir -p ~/PatriMoiApp/ios/PatriMoiApp
cp "$SRC" ~/PatriMoiApp/ios/PatriMoiApp/RNPDFExport.m && echo "  ✓ Remplacé : ~/PatriMoiApp/ios/PatriMoiApp/RNPDFExport.m"
echo ""

# 5. Vérification
echo "── VÉRIFICATION (ligne 3 après fix) ────────────"
find ~/PatriMoiApp ~/Claude/Projects/PatriMoi -name "RNPDFExport.m" 2>/dev/null | while IFS= read -r f; do
  echo "  $f → $(sed -n '3p' "$f")"
done
echo ""

echo "================================================"
echo " ✓ Fait ! Dans Xcode :"
echo "   1. Product → Clean Build Folder  (⇧⌘K)"
echo "   2. Build                          (⌘B)"
echo "================================================"
