#!/bin/bash
# PatriMoi — Fix Swift v3 — applique le fix au projet principal aussi
APP_DIR="$HOME/PatriMoiApp"
PODFILE="$APP_DIR/ios/Podfile"

echo "================================================"
echo "  PatriMoi — Fix Swift v3"
echo "================================================"
echo ""

cp "$PODFILE" "$PODFILE.bak3"
echo "✓ Backup : Podfile.bak3"

python3 << 'PYEOF'
import re, sys

path = '/Users/z.othmane/PatriMoiApp/ios/Podfile'
content = open(path).read()

# Supprimer tous les blocs post_install existants
cleaned = re.sub(r'\npost_install do \|installer\|.*?^end\n', '\n', content, flags=re.DOTALL|re.MULTILINE)
cleaned = cleaned.rstrip()

fix = """

post_install do |installer|
  react_native_post_install(installer, :mac_catalyst_enabled => false)

  # Fix Swift compatibility linker errors (Xcode 26)
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
      config.build_settings['SWIFT_VERSION'] = '5.0'
      config.build_settings['SWIFT_SERIALIZE_DEBUGGING_OPTIONS'] = 'NO'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
    end
  end

  # Fix au niveau du projet principal (PatriMoiApp.xcodeproj)
  installer.aggregate_targets.each do |agg_target|
    agg_target.user_project.targets.each do |native_target|
      native_target.build_configurations.each do |config|
        config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
        config.build_settings['SWIFT_SERIALIZE_DEBUGGING_OPTIONS'] = 'NO'
      end
    end
    agg_target.user_project.save
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
echo "  ✓ Fix v3 appliqué !"
echo "  1. Retourne dans Xcode"
echo "  2. Product → Clean Build Folder (⇧⌘K)"
echo "  3. Clique ▶"
echo "================================================"
read -p "Entrée pour fermer..."
