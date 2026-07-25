#!/bin/bash
# fix_bundle_template2.command
# Correction : le pbxproj utilise rfc1034identifier (pas rfc822identifier)

PBXPROJ="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
  echo "❌ Fichier non trouvé : $PBXPROJ"; exit 1
fi

echo "📋 Backup..."
cp "$PBXPROJ" "${PBXPROJ}.bak3_$(date +%Y%m%d_%H%M%S)"

echo "🔧 Remplacement avec pattern rfc1034identifier..."
# Pattern correct : $(PRODUCT_NAME:rfc1034identifier)
sed -i '' 's|org\.reactjs\.native\.example\.\$(PRODUCT_NAME:rfc1034identifier)|ma.patrimoi.app|g' "$PBXPROJ"
sed -i '' 's|org\.reactjs\.native\.example\.\${PRODUCT_NAME:rfc1034identifier}|ma.patrimoi.app|g' "$PBXPROJ"
# Forme littérale au cas où
sed -i '' 's|org\.reactjs\.native\.example\.PatriMoiApp|ma.patrimoi.app|g' "$PBXPROJ"

echo ""
echo "✅ Vérification :"
grep "PRODUCT_BUNDLE_IDENTIFIER" "$PBXPROJ" | sed 's/^[ \t]*/   /'
COUNT=$(grep -c "ma\.patrimoi\.app" "$PBXPROJ" 2>/dev/null || true)
echo "   $COUNT occurrences de ma.patrimoi.app"
STILL_OLD=$(grep -c "org\.reactjs\.native" "$PBXPROJ" 2>/dev/null || true)
if [ "$STILL_OLD" -gt 0 ]; then
  echo "   ⚠️  Encore $STILL_OLD ancien(s) Bundle ID restant(s)"
  grep "org\.reactjs\.native" "$PBXPROJ" | sed 's/^[ \t]*/   /'
else
  echo "   ✓ Aucun ancien Bundle ID restant — tout est ma.patrimoi.app"
fi
echo ""
echo "➡️  Recharge le projet Xcode : ferme la fenêtre et rouvre ~/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
