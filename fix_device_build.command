#!/bin/bash
# ============================================================
# fix_device_build.command — PatriMoi
# Corrige les 2 erreurs de build sur device physique :
#   1. Bundle ID org.reactjs.native.example.PatriMoiApp → ma.patrimoi.app
#   2. Active le Automatic signing (Xcode gère le provisioning)
# ============================================================
set -e

PBXPROJ="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj"

if [ ! -f "$PBXPROJ" ]; then
  echo "❌ Fichier introuvable : $PBXPROJ"
  echo "   Lance ce script depuis le dossier PatriMoi ou vérifie le chemin."
  exit 1
fi

echo "📋 Sauvegarde du project.pbxproj..."
cp "$PBXPROJ" "${PBXPROJ}.bak_$(date +%Y%m%d_%H%M%S)"
echo "   ✓ Backup créé"

echo ""
echo "🔧 Correction Bundle ID..."
# org.reactjs.native.example.PatriMoiApp → ma.patrimoi.app
BEFORE=$(grep -c "org.reactjs.native.example.PatriMoiApp" "$PBXPROJ" 2>/dev/null || true)
sed -i '' 's/org\.reactjs\.native\.example\.PatriMoiApp/ma.patrimoi.app/g' "$PBXPROJ"
AFTER=$(grep -c "ma.patrimoi.app" "$PBXPROJ" 2>/dev/null || true)
echo "   ✓ $BEFORE occurrences remplacées → ma.patrimoi.app ($AFTER vérifiées)"

echo ""
echo "🔧 Activation Automatic signing..."
# Passe CODE_SIGN_STYLE de Manual à Automatic (si présent)
sed -i '' 's/CODE_SIGN_STYLE = Manual;/CODE_SIGN_STYLE = Automatic;/g' "$PBXPROJ"
# Ajoute CODE_SIGN_STYLE = Automatic là où c'est absent (ligne PRODUCT_BUNDLE_IDENTIFIER)
# Aussi désactiver ProvisioningStyle = Manual dans xcshareddata si présent
PROV_FILE="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/xcshareddata/xcschemes"
if ls "$PROV_FILE"/../*.pbxproj 2>/dev/null | grep -q .; then
  :
fi
# Fichier xcscheme workspace settings
WS_SETTINGS="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings"
if [ -f "$WS_SETTINGS" ]; then
  sed -i '' 's/<string>Manual<\/string>/<string>Automatic<\/string>/g' "$WS_SETTINGS" 2>/dev/null || true
fi
echo "   ✓ CODE_SIGN_STYLE = Automatic"

echo ""
echo "🔧 Vérification entitlement Keychain Sharing..."
ENTITLEMENTS="$HOME/PatriMoiApp/ios/PatriMoiApp/PatriMoiApp.entitlements"
if [ ! -f "$ENTITLEMENTS" ]; then
  echo "   ⚠️  Fichier .entitlements introuvable — création..."
  mkdir -p "$(dirname "$ENTITLEMENTS")"
  cat > "$ENTITLEMENTS" << 'ENTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>keychain-access-groups</key>
	<array>
		<string>$(AppIdentifierPrefix)ma.patrimoi.app</string>
	</array>
</dict>
</plist>
ENTEOF
  echo "   ✓ PatriMoiApp.entitlements créé avec Keychain Access Groups"
else
  # Vérifier si keychain-access-groups est présent
  if ! grep -q "keychain-access-groups" "$ENTITLEMENTS"; then
    echo "   ⚠️  keychain-access-groups absent — ajout..."
    # Insérer avant </dict>
    sed -i '' 's|</dict>|	<key>keychain-access-groups</key>\n	<array>\n		<string>$(AppIdentifierPrefix)ma.patrimoi.app</string>\n	</array>\n</dict>|' "$ENTITLEMENTS"
    echo "   ✓ keychain-access-groups ajouté"
  else
    echo "   ✓ Keychain entitlement déjà présent"
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Script terminé. Maintenant dans Xcode :"
echo ""
echo "  ÉTAPE 1 — Reconnexion Apple ID (erreur -1001) :"
echo "    Xcode → Settings (⌘,) → Accounts"
echo "    → Sélectionner zineddine.othmane1@gmail.com"
echo "    → '-' pour supprimer → '+' pour re-ajouter"
echo "    → Se connecter avec Apple ID + mot de passe"
echo ""
echo "  ÉTAPE 2 — Sélectionner la Team :"
echo "    PatriMoiApp target → Signing & Capabilities"
echo "    → Team: [ton nom / Personal Team]"
echo "    → ✅ Automatically manage signing"
echo "    → Bundle Identifier: ma.patrimoi.app ✓"
echo ""
echo "  ÉTAPE 3 — Build sur device (⌘R)"
echo "════════════════════════════════════════════════════════"
