#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
echo "=== Fix ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES ==="

# 1. Patcher les xcconfig files directement
XCCONFIG_DIR="$APP/ios/Pods/Target Support Files/Pods-PatriMoiApp"
for f in "$XCCONFIG_DIR"/*.xcconfig; do
  if [ -f "$f" ]; then
    sed -i '' 's/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO/g' "$f"
    echo "✓ Patché: $(basename "$f")"
  fi
done

# 2. Patcher le Podfile: changer YES en NO pour aggregate targets
python3 - "$APP/ios/Podfile" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Changer ALWAYS_EMBED YES en NO dans le Podfile
new_content = content.replace(
    "config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'",
    "config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'NO'"
)

if new_content != content:
    with open(path, 'w') as f:
        f.write(new_content)
    print('Podfile: ALWAYS_EMBED changé YES → NO')
else:
    print('Podfile: pas de YES trouvé (déjà NO ou absent)')
PYEOF

# 3. Supprimer DerivedData
echo "▸ Suppression DerivedData..."
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE — relance le build dans Xcode ==="
open "$APP/ios/PatriMoiApp.xcworkspace"
