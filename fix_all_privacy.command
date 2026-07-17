#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
echo "=== Fix TOUS les _privacy targets ==="

# 1. Patcher TOUS les xcconfig de Pods (pas juste Pods-PatriMoiApp)
echo "▸ Patch xcconfig..."
find "$APP/ios/Pods/Target Support Files" -name "*.xcconfig" | while read f; do
  if grep -q "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES" "$f" 2>/dev/null; then
    sed -i '' 's/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO/g' "$f"
    echo "  Patché: $(basename "$(dirname "$f")")/$(basename "$f")"
  fi
done

# 2. Réécrire le Podfile post_install proprement
python3 - "$APP/ios/Podfile" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Supprimer TOUT le contenu du post_install do block et le réécrire proprement
# Trouver le bloc post_install
match = re.search(r'\npost_install do \|installer\|(.*?)(?=\nend\s*$)', content, re.DOTALL)
if not match:
    print("Podfile: bloc post_install introuvable")
    sys.exit(1)

new_post_install = '''
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'NO'
      config.build_settings['CODE_SIGNING_ALLOWED[sdk=iphonesimulator*]'] = 'NO'
    end
  end
end'''

# Remplacer le contenu avant le bloc post_install + le bloc
prefix = content[:match.start()]
new_content = prefix + new_post_install + '\n'

with open(path, 'w') as f:
    f.write(new_content)
print('Podfile: post_install réécrit (ALWAYS_EMBED=NO + CODE_SIGNING pour tous les targets)')
PYEOF

# 3. Pod install
echo "▸ Pod install..."
cd "$APP/ios"
pod install 2>&1 | grep -E "(complete|error|\[!]|warning:)" | head -15
cd "$APP"

# 4. Supprimer DerivedData
echo "▸ Suppression DerivedData..."
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE ==="
open "$APP/ios/PatriMoiApp.xcworkspace"
