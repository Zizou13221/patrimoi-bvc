#!/bin/bash
APP="$HOME/PatriMoiApp"
PODS_PBXPROJ="$APP/ios/Pods/Pods.xcodeproj/project.pbxproj"

echo "=== Diagnostic glog_privacy ==="
echo ""

echo "--- ALWAYS_EMBED dans Pods.xcodeproj ---"
grep -n "ALWAYS_EMBED\|glog_privacy" "$PODS_PBXPROJ" | head -30
echo ""

echo "--- xcconfig files pour glog_privacy ---"
ls "$APP/ios/Pods/Target Support Files/glog/"* 2>/dev/null || echo "Pas de répertoire glog"
echo ""

echo "--- Contenu xcconfig glog debug ---"
cat "$APP/ios/Pods/Target Support Files/glog/glog.debug.xcconfig" 2>/dev/null || echo "Fichier introuvable"
echo ""

echo "--- ALWAYS_EMBED dans tous les xcconfig ---"
grep -rn "ALWAYS_EMBED" "$APP/ios/Pods/Target Support Files/" 2>/dev/null | head -20
echo ""

echo "=== FIN DIAGNOSTIC ==="
