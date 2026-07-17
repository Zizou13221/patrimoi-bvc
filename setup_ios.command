#!/bin/bash
# PatriMoi — Setup iOS complet
# Double-clique sur ce fichier dans le Finder pour lancer
# ─────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="PatriMoiApp"
APP_DIR="$HOME/$APP_NAME"

green()  { echo -e "\033[32m$1\033[0m"; }
red()    { echo -e "\033[31m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

echo ""
echo "================================================"
echo "  PatriMoi — Setup iOS"
echo "================================================"
echo ""

# ── 1. Xcode ─────────────────────────────────────────────
if ! xcode-select -p &>/dev/null 2>&1; then
  red "❌ Xcode n'est pas installé."
  echo "   → Installe Xcode depuis l'App Store (gratuit), puis relance ce script."
  read -p "   Appuie sur Entrée pour fermer..." && exit 1
fi
green "✓ Xcode : $(xcode-select -p)"

# Forcer xcode-select sur l'app Xcode complète (pas les Command Line Tools seuls)
if [ -d "/Applications/Xcode.app" ]; then
  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
  green "✓ xcode-select → Xcode.app"
fi

# Accepter la licence Xcode si besoin
sudo xcodebuild -license accept 2>/dev/null || true

# ── 2. Node.js ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
  red "❌ Node.js manquant."
  echo "   → Va sur https://nodejs.org et installe la version LTS."
  read -p "   Appuie sur Entrée pour fermer..." && exit 1
fi
green "✓ Node.js : $(node --version)"

# ── 3. Homebrew ──────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  yellow "→ Installation de Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Ajouter brew au PATH (Apple Silicon)
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi
green "✓ Homebrew : $(brew --version | head -1)"

# ── 4. CocoaPods ─────────────────────────────────────────
if ! command -v pod &>/dev/null; then
  yellow "→ Installation de CocoaPods..."
  brew install cocoapods
fi
green "✓ CocoaPods : $(pod --version)"

# ── 5. Init projet React Native ──────────────────────────
if [ -d "$APP_DIR" ]; then
  yellow "→ $APP_DIR existe déjà — mise à jour des sources uniquement."
else
  yellow "→ Création du projet React Native..."
  cd "$HOME"
  npx @react-native-community/cli@latest init "$APP_NAME" \
    --version 0.75.4 \
    --skip-install
  green "✓ Projet React Native créé dans $APP_DIR"
fi

# ── 6. Copier les sources PatriMoi ───────────────────────
yellow "→ Copie des sources PatriMoi..."
# Supprimer les anciens fichiers et prendre les droits
sudo rm -rf "$APP_DIR/src" "$APP_DIR/App.jsx" "$APP_DIR/bvc_cours.json"
sudo chown -R "$(whoami)" "$APP_DIR"
cp -r "$SCRIPT_DIR/src" "$APP_DIR/"
cp "$SCRIPT_DIR/PatriMoi_Native.jsx" "$APP_DIR/App.jsx"
[ -f "$SCRIPT_DIR/bvc_cours.json" ] && cp "$SCRIPT_DIR/bvc_cours.json" "$APP_DIR/bvc_cours.json"
green "✓ Sources copiées"

# ── 7. Dépendances npm ───────────────────────────────────
yellow "→ Installation des packages npm..."
cd "$APP_DIR"
npm install \
  @supabase/supabase-js \
  @react-native-async-storage/async-storage
green "✓ Packages installés"

# ── 8. Pods iOS ──────────────────────────────────────────
yellow "→ Installation des pods iOS (peut prendre 2-3 min)..."
cd "$APP_DIR/ios"
pod install
green "✓ Pods installés"

echo ""
echo "================================================"
echo "  ✓ Tout est prêt !"
echo ""
echo "  Pour tester sur ton iPhone :"
echo "  1. Branche ton iPhone en USB"
echo "  2. Lance Xcode qui va s'ouvrir automatiquement"
echo "  3. En haut à gauche, sélectionne ton iPhone"
echo "  4. Clique ▶ (Run) — l'app se lance !"
echo ""
echo "  Si Xcode demande un 'Development Team' :"
echo "  → Signing & Capabilities → Team → ton Apple ID"
echo "================================================"
echo ""

# Ouvrir Xcode automatiquement
open "$APP_DIR/ios/$APP_NAME.xcworkspace"
