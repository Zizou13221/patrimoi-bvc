#!/bin/bash
set -e

PODFILE="$HOME/PatriMoiApp/ios/Podfile"
echo "=== Fix glog_privacy: override ALWAYS_EMBED pour targets _privacy ==="

python3 - "$PODFILE" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

fix_marker = 'PRIVACY_BUNDLE_FIX_V2'

if fix_marker in content:
    print('Fix deja applique')
    sys.exit(0)

# Ajouter apres le bloc CODE_SIGNING_ALLOWED existant, avant le dernier 'end'
# On cherche la fin du bloc installer.pods_project.targets.each
fix = (
    f'  # {fix_marker}\n'
    '  installer.pods_project.targets.each do |target|\n'
    '    if target.name.end_with?("_privacy")\n'
    '      target.build_configurations.each do |config|\n'
    '        config.build_settings["ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES"] = "NO"\n'
    '      end\n'
    '    end\n'
    '  end\n'
)

idx = content.rfind('\nend')
new_content = content[:idx] + '\n' + fix + content[idx:]
with open(path, 'w') as f:
    f.write(new_content)
print('Fix applique: ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO pour targets _privacy')
PYEOF

echo "▸ Pod install..."
cd "$HOME/PatriMoiApp/ios"
pod install 2>&1 | grep -E "(complete|error|warning:|\[!])" | head -10

echo ""
echo "▸ Suppression DerivedData..."
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE — relance le build dans Xcode ==="
open "$HOME/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
