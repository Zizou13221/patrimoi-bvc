#!/bin/bash
cd "$HOME/PatriMoiApp"
echo "Installing react-native-url-polyfill..."
npm install react-native-url-polyfill
echo ""
echo "Copie supabase.js mis à jour..."
cp "$HOME/Claude/Projects/PatriMoi/src/utils/supabase.js" "$HOME/PatriMoiApp/src/utils/supabase.js"
echo "✓ Done — recharge l'app dans le simulateur (⌘R)"
read -p "Entrée pour fermer..."
