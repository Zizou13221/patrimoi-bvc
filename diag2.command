#!/bin/bash
APP="$HOME/PatriMoiApp"
PODS_PBXPROJ="$APP/ios/Pods/Pods.xcodeproj/project.pbxproj"

echo "=== Diagnostic boost_privacy ==="
echo ""

echo "--- ALWAYS_EMBED dans Pods.xcodeproj/project.pbxproj ---"
grep -n "ALWAYS_EMBED" "$PODS_PBXPROJ" | head -30
echo ""

echo "--- Toutes les xcconfigs de boost ---"
ls "$APP/ios/Pods/Target Support Files/boost/" 2>/dev/null || echo "Pas de dossier boost"
echo ""

echo "--- xcconfig boost debug ---"
cat "$APP/ios/Pods/Target Support Files/boost/boost.debug.xcconfig" 2>/dev/null | head -20
echo ""

echo "--- xcconfig boost_privacy (si existe) ---"
find "$APP/ios/Pods/Target Support Files" -name "*boost_privacy*" 2>/dev/null
echo ""

echo "--- ALWAYS_EMBED dans TOUS les xcconfig ---"
grep -rn "ALWAYS_EMBED" "$APP/ios/Pods/" 2>/dev/null | grep -v ".bak" | head -30
echo ""

echo "=== FIN ==="
