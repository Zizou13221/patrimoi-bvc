#!/bin/bash
echo "=== RESET COMPLET METRO ==="

echo "1. Arrêt de Metro (port 8081)..."
kill $(lsof -t -i:8081) 2>/dev/null
sleep 1

echo "2. Nettoyage Watchman..."
watchman watch-del-all 2>/dev/null || true

echo "3. Nettoyage caches Metro/Babel/Haste..."
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/haste-map-* 2>/dev/null
rm -rf /tmp/jest-* 2>/dev/null
rm -rf ~/Library/Caches/com.facebook.ReactNativeBuild 2>/dev/null

echo "4. Nettoyage cache node (PatriMoiApp)..."
cd ~/PatriMoiApp
rm -rf .metro-cache 2>/dev/null

echo "5. Vérification schemas/index.ts (doit être absent)..."
if [ -f "src/schemas/index.ts" ]; then
  echo "   DANGER: index.ts trouvé! Suppression..."
  rm -f src/schemas/index.ts src/schemas/index.tsx
  echo "   ✓ Supprimé"
else
  echo "   ✓ OK (index.ts absent)"
fi

echo ""
echo "6. Démarrage Metro avec --reset-cache..."
echo "   → Après démarrage: dans le simulateur, faire Cmd+R pour forcer reload"
echo ""
cd ~/PatriMoiApp && npx react-native start --reset-cache
