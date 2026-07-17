#!/bin/bash
echo "=== NUKE TOTAL METRO + CACHES ==="

echo "1. Arrêt Metro..."
kill $(lsof -t -i:8081) 2>/dev/null; sleep 1
kill $(lsof -t -i:8082) 2>/dev/null

echo "2. Touch des fichiers modifiés (force Metro à re-transformer)..."
touch ~/PatriMoiApp/src/utils/auth.js
touch ~/PatriMoiApp/src/utils/supabase.js
touch ~/PatriMoiApp/src/utils/keychainStorage.js
touch ~/PatriMoiApp/src/schemas/index.js
echo "   ✓ mtime mis à jour"

echo "3. Watchman reset..."
watchman watch-del-all 2>/dev/null || true
watchman watch ~/PatriMoiApp 2>/dev/null || true

echo "4. Suppression caches /tmp..."
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/jest-* 2>/dev/null

echo "5. Suppression cache Library..."
rm -rf ~/Library/Caches/com.facebook.ReactNativeBuild 2>/dev/null
rm -rf ~/Library/Caches/react-native 2>/dev/null

echo "6. Suppression node_modules/.cache (babel, metro, etc.)..."
rm -rf ~/PatriMoiApp/node_modules/.cache 2>/dev/null
echo "   ✓ node_modules/.cache supprimé"

echo "7. Vérification finale auth.js V4..."
grep -c "AUTH_V4" ~/PatriMoiApp/src/utils/auth.js && echo "   ✓ AUTH_V4 confirmé dans PatriMoiApp" || echo "   ERREUR: AUTH_V4 absent!"

echo ""
echo "=== LANCEMENT METRO ==="
echo "→ Après 'Dev server ready' : dans le simulateur faire Cmd+D → Reload"
echo ""
cd ~/PatriMoiApp && npx react-native start --reset-cache
