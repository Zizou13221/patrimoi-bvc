#!/bin/bash
set -e

PODS_PBXPROJ="$HOME/PatriMoiApp/ios/Pods/Pods.xcodeproj/project.pbxproj"
echo "=== Fix glog_privacy dans Pods.xcodeproj ==="

if [ ! -f "$PODS_PBXPROJ" ]; then
  echo "ERREUR: $PODS_PBXPROJ introuvable"
  exit 1
fi

cp "$PODS_PBXPROJ" "$PODS_PBXPROJ.bak_glogfix"
echo "✓ Backup créé"

ruby - "$PODS_PBXPROJ" << 'RUBY'
content = File.read(ARGV[0])

# Find all buildSettings blocks for glog_privacy targets
# and add ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO
count = 0
new_content = content.gsub(/(buildSettings = \{[^}]*?PRODUCT_NAME = glog_privacy[^}]*?\})/m) do |block|
  count += 1
  if block.include?('ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES')
    block.gsub(/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = [^;]+;/, 'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO;')
  else
    block.sub('buildSettings = {', "buildSettings = {\n\t\t\t\tALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO;")
  end
end

puts "Modifié #{count} blocs buildSettings pour glog_privacy"
File.write(ARGV[0], new_content)
RUBY

echo ""
echo "▸ Suppression DerivedData..."
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE — relance le build dans Xcode ==="
open "$HOME/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
