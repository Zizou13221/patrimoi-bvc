#!/bin/bash
# fix_bundle_template.command
# Le premier script a remplacé "org.reactjs.native.example.PatriMoiApp" (forme littérale)
# mais Xcode stocke aussi la forme template : $(PRODUCT_NAME:rfc822identifier)
# Ce script corrige les deux formes restantes.

PBXPROJ="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
  echo "❌ Fichier non trouvé : $PBXPROJ"; exit 1
fi

echo "📋 Backup..."
cp "$PBXPROJ" "${PBXPROJ}.bak2_$(date +%Y%m%d_%H%M%S)"

echo "🔧 Remplacement formes template..."
# Forme 1 : org.reactjs.native.example.$(PRODUCT_NAME:rfc822identifier)
sed -i '' 's|org\.reactjs\.native\.example\.\$(PRODUCT_NAME:rfc822identifier)|ma.patrimoi.app|g' "$PBXPROJ"
# Forme 2 : org.reactjs.native.example.${PRODUCT_NAME:rfc822identifier}  (au cas où)
sed -i '' 's|org\.reactjs\.native\.example\.\${PRODUCT_NAME:rfc822identifier}|ma.patrimoi.app|g' "$PBXPROJ"
# Forme 3 : littérale encore présente
sed -i '' 's|org\.reactjs\.native\.example\.PatriMoiApp|ma.patrimoi.app|g' "$PBXPROJ"
# Forme 4 : avec guillemets
sed -i '' 's|"org\.reactjs\.native\.example\.PatriMoiApp"|"ma.patrimoi.app"|g' "$PBXPROJ"

echo ""
echo "✅ Vérification :"
echo "   Bundle IDs trouvés :"
grep "PRODUCT_BUNDLE_IDENTIFIER" "$PBXPROJ" | sed 's/^[ \t]*/   /'
grep "ma\.patrimoi\.app" "$PBXPROJ" | wc -l | xargs -I{} echo "   {} occurrences de ma.patrimoi.app"
STILL_OLD=$(grep -c "org\.reactjs\.native" "$PBXPROJ" 2>/dev/null || true)
if [ "$STILL_OLD" -gt 0 ]; then
  echo "   ⚠️  Encore $STILL_OLD ligne(s) avec l'ancien Bundle ID :"
  grep "org\.reactjs\.native" "$PBXPROJ" | sed 's/^[ \t]*/   /'
else
  echo "   ✓ Aucun ancien Bundle ID restant"
fi

echo ""
echo "⚠️  Dans Xcode → ferme et rouvre le projet OU File → Close Workspace"
echo "   puis rouvre ~/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
