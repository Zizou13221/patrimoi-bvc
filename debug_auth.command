#!/bin/bash
echo "=== DIAGNOSTIC AUTH.JS ==="
echo ""

echo "1. Contenu auth.js dans PatriMoiApp (lignes 1-20):"
echo "---"
head -20 ~/PatriMoiApp/src/utils/auth.js 2>/dev/null || echo "ERREUR: fichier introuvable à ~/PatriMoiApp/src/utils/auth.js"
echo "---"
echo ""

echo "2. Recherche AUTH_V4 dans PatriMoiApp:"
grep -n "AUTH_V4" ~/PatriMoiApp/src/utils/auth.js 2>/dev/null || echo "AUTH_V4 ABSENT — fichier non mis à jour!"
echo ""

echo "3. Recherche AUTH_V4 dans le workspace:"
grep -n "AUTH_V4" ~/Claude/Projects/PatriMoi/src/utils/auth.js 2>/dev/null || echo "AUTH_V4 absent du workspace aussi??"
echo ""

echo "4. Vérification schemas/index.ts (doit être ABSENT):"
ls ~/PatriMoiApp/src/schemas/ 2>/dev/null || echo "Dossier schemas introuvable"
echo ""

echo "5. Vérification imports statiques restants dans auth.js:"
grep "^import " ~/PatriMoiApp/src/utils/auth.js 2>/dev/null | head -5
echo ""

echo "6. Recherche d'autres copies d'auth.js sur le système:"
find ~ -name "auth.js" -path "*/utils/auth.js" 2>/dev/null | grep -v node_modules | grep -v ".cache"
echo ""

echo "=== FIN DIAGNOSTIC ==="
read -p "Appuie sur Entrée pour fermer..."
