#!/bin/bash
set -e
REPO="patrimoi-bvc"
GH_USER="Zizou21213"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== PatriMoi BVC — Setup GitHub ==="
cd "$DIR"

# Nettoyer repo git partiel
rm -rf .git

# Git init + commit
git init -b main
git config user.email "zineddine.othmane1@gmail.com"
git config user.name "Zineddine Othmane"
git add PatriMoi_Native.jsx bvc_cours.json bvc_batch/ .github/ setup_github.command setup_github.sh
git commit -m "feat: PatriMoi v1.2 — BVC batch GitHub Actions"

# Token GitHub
read -sp "Token GitHub (github.com/settings/tokens, scope 'repo') : " GH_TOKEN
echo ""

# Créer le repo
echo "→ Création du repo..."
curl -s -X POST \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"PatriMoi — BVC data batch\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓' if 'html_url' in d else '⚠ ' + d.get('message','erreur'))"

# Push
git remote add origin "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO.git"
git push -u origin main

echo ""
echo "✅ Repo pushé !"
echo ""
echo "👉 BVC_COURS_URL à coller dans PatriMoi_Native.jsx :"
echo "   https://raw.githubusercontent.com/$GH_USER/$REPO/main/bvc_cours.json"
echo ""
read -p "Appuie sur Entrée pour fermer..."
