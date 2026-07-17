#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
PODS_PBXPROJ="$APP/ios/Pods/Pods.xcodeproj/project.pbxproj"

echo "=== Fix Pods.xcodeproj: ALWAYS_EMBED = NO ==="

cp "$PODS_PBXPROJ" "$PODS_PBXPROJ.bak_always"
BEFORE=$(grep -c "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES" "$PODS_PBXPROJ" 2>/dev/null || echo 0)
echo "Occurrences YES avant: $BEFORE"

sed -i '' 's/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO/g' "$PODS_PBXPROJ"

AFTER=$(grep -c "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES" "$PODS_PBXPROJ" 2>/dev/null || echo 0)
echo "Occurrences YES après: $AFTER"
echo "✓ $(grep -c "ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO" "$PODS_PBXPROJ") occurrences changées en NO"

echo ""
echo "▸ Suppression DerivedData..."
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
echo "✓ DerivedData supprimé"

echo ""
echo "=== TERMINE — lance le build dans Xcode ==="
open "$APP/ios/PatriMoiApp.xcworkspace"
