#!/bin/bash
# PatriMoi — Installation icône app iOS
SRC=~/Claude/Projects/PatriMoi/AppIcon.appiconset

echo "🔍 Recherche du dossier AppIcon.appiconset dans ~/PatriMoiApp/ios..."
DST=$(find ~/PatriMoiApp/ios -name "AppIcon.appiconset" -type d 2>/dev/null | head -1)

if [ -z "$DST" ]; then
  echo "❌ AppIcon.appiconset introuvable dans ~/PatriMoiApp/ios"
  echo "   Vérifie que le projet Xcode est bien à ~/PatriMoiApp/"
  exit 1
fi

echo "📁 Destination : $DST"
echo ""

# Copier tous les fichiers PNG
for f in icon_1024.png icon_180.png icon_120.png icon_87.png icon_80.png \
          icon_60.png icon_58.png icon_40.png icon_29.png icon_20.png; do
  cp "$SRC/$f" "$DST/$f" && echo "✓ $f"
done

# Copier Contents.json
cp "$SRC/Contents.json" "$DST/Contents.json" && echo "✓ Contents.json"

echo ""
echo "✅ Icônes installées dans :"
echo "   $DST"
echo ""
echo "👉 Prochaine étape :"
echo "   1. Ouvre Xcode → Product → Clean Build Folder (⇧⌘K)"
echo "   2. Puis Build & Run (⌘R)"
echo "   Ou depuis le terminal : cd ~/PatriMoiApp && npx react-native run-ios"
