#!/bin/bash
# PatriMoi — Installation module PDF natif
DST=~/PatriMoiApp

echo "📦 Installation de react-native-html-to-pdf..."
cd "$DST" || { echo "❌ Dossier $DST introuvable"; exit 1; }

# Vérifier si déjà installé
if grep -q '"react-native-html-to-pdf"' package.json 2>/dev/null; then
  echo "✓ react-native-html-to-pdf déjà dans package.json"
else
  echo "→ Ajout dans package.json..."
  npm install react-native-html-to-pdf --save && echo "✓ npm install OK"
fi

# Pod install
echo ""
echo "🍎 Installation des pods iOS..."
cd ios && pod install && cd ..

echo ""
echo "✅ Module PDF installé !"
echo ""
echo "👉 Maintenant :"
echo "   1. Ferme le simulateur"
echo "   2. Dans Xcode : Product → Clean Build Folder (⇧⌘K)"
echo "   3. Build & Run (⌘R)"
