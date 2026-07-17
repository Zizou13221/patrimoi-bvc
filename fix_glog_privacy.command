#!/bin/bash
set -e

PODFILE="$HOME/PatriMoiApp/ios/Podfile"
echo "=== Fix glog_privacy build error ==="

python3 - "$PODFILE" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

if 'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' in content:
    print('Podfile: ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES deja present')
    sys.exit(0)

# Add ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO for _privacy bundle targets
fix = (
    '  installer.pods_project.targets.each do |target|\n'
    '    if target.name.end_with?("_privacy")\n'
    '      target.build_configurations.each do |config|\n'
    '        config.build_settings["ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES"] = "NO"\n'
    '      end\n'
    '    end\n'
    '  end\n'
)

# Insert before the last 'end' in the file
idx = content.rfind('\nend')
new_content = content[:idx] + '\n' + fix + content[idx:]
with open(path, 'w') as f:
    f.write(new_content)
print('Podfile: ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO ajoute pour targets _privacy')
PYEOF

echo "▸ Pod install..."
cd "$HOME/PatriMoiApp/ios"
pod install 2>&1 | tail -5

echo ""
echo "=== Suppression DerivedData... ==="
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE — Relance le build dans Xcode ==="
open "$HOME/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
