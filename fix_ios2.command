#!/bin/bash
# PatriMoi — Fix Swift (v2) — réécriture propre du Podfile
APP_DIR="$HOME/PatriMoiApp"
PODFILE="$APP_DIR/ios/Podfile"

echo "================================================"
echo "  PatriMoi — Fix Swift v2"
echo "================================================"

# Backup
cp "$PODFILE" "$PODFILE.bak"
echo "✓ Backup : $PODFILE.bak"

# Réécrire le Podfile avec Python — fusionner tous les post_install en un seul
python3 << PYEOF
import re

path = '$PODFILE'
content = open(path).read()

# Supprimer TOUS les blocs post_install existants
# (match greedy jusqu'au prochain ^end seul sur sa ligne)
cleaned = re.sub(
    r'\n+post_install do.*?(?=\n(?:require|platform|target|\Z))',
    '',
    content,
    flags=re.DOTALL
)

# S'assurer qu'il n'y a pas de "end" orphelin à la fin
cleaned = cleaned.rstrip()
# Supprimer le dernier "end" si c'est celui du post_install supprimé
# (le dernier "end" du fichier doit appartenir au target)

# Ajouter UN SEUL post_install propre à la fin
fix = """

post_install do |installer|
  react_native_post_install(installer, :mac_catalyst_enabled => false)
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

open(path, 'w').write(cleaned + fix)
print("Podfile réécrit OK")
PYEOF

echo ""
echo "→ Nettoyage DerivedData..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-"* 2>/dev/null || true

echo "→ pod install..."
cd "$APP_DIR/ios"
pod install

echo ""
echo "================================================"
echo "  ✓ Fix v2 appliqué !"
echo "  Retourne dans Xcode et clique ▶"
echo "================================================"
read -p "Entrée pour fermer..."
