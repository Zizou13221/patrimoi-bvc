#!/bin/bash
# PatriMoi — Fix Swift compatibility (Xcode 26)
# Double-clique pour lancer

APP_DIR="$HOME/PatriMoiApp"
PODFILE="$APP_DIR/ios/Podfile"

green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

echo "================================================"
echo "  PatriMoi — Fix Swift compatibility"
echo "================================================"
echo ""

# 1. Vérifier que PatriMoiApp existe
if [ ! -f "$PODFILE" ]; then
  echo "❌ $PODFILE introuvable."
  read -p "Appuie sur Entrée pour fermer..." && exit 1
fi

# 2. Ajouter le fix dans le Podfile si pas déjà présent
if grep -q "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES" "$PODFILE"; then
  green "✓ Fix déjà présent dans le Podfile"
else
  yellow "→ Ajout du fix Swift dans le Podfile..."
  # Remplacer le bloc post_install existant par notre version fixée
  # On ajoute avant la dernière ligne (end)
  python3 - "$PODFILE" << 'PYEOF'
import sys, re

path = sys.argv[1]
content = open(path).read()

fix = """
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
      config.build_settings['SWIFT_VERSION'] = '5.0'
      config.build_settings['SWIFT_SERIALIZE_DEBUGGING_OPTIONS'] = 'NO'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
    end
  end
end
"""

# Supprimer post_install existant si présent
content = re.sub(r'\npost_install do.*?^end\n', '\n', content, flags=re.DOTALL|re.MULTILINE)
# Ajouter notre fix à la fin
content = content.rstrip() + "\n" + fix

open(path, 'w').write(content)
print("Podfile mis à jour")
PYEOF
  green "✓ Podfile mis à jour"
fi

# 3. Nettoyer le build Xcode
yellow "→ Nettoyage du build Xcode..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-"* 2>/dev/null || true
green "✓ DerivedData nettoyé"

# 4. Re-pod install
yellow "→ Re-pod install (2-3 min)..."
cd "$APP_DIR/ios"
pod install
green "✓ Pods réinstallés"

echo ""
echo "================================================"
echo "  ✓ Fix appliqué !"
echo ""
echo "  Retourne dans Xcode et clique ▶ pour compiler."
echo "================================================"
echo ""
read -p "Appuie sur Entrée pour fermer..."
