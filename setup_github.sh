#!/bin/bash
# PatriMoi BVC — Setup GitHub repo
# Lance ce script une seule fois depuis le dossier PatriMoi

set -e
REPO="patrimoi-bvc"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== PatriMoi BVC — Setup GitHub ==="
echo ""

# 1. Git init + premier commit
cd "$DIR"
git init -b main
git config user.email "zineddine.othmane1@gmail.com"
git config user.name "Zineddine Othmane"
git add PatriMoi_Native.jsx bvc_cours.json bvc_batch/ .github/
git commit -m "feat: PatriMoi v1.2 — BVC batch GitHub Actions"

# 2. Créer le repo via GitHub CLI (si installé) ou API
if command -v gh &>/dev/null; then
  echo "→ Création du repo via gh CLI..."
  gh repo create "$REPO" --public --source=. --remote=origin --push
  REPO_URL=$(gh repo view "$REPO" --json url -q .url)
else
  echo "→ gh CLI non trouvé. Création via API GitHub..."
  echo ""
  read -p "Ton GitHub username : " GH_USER
  read -sp "Ton GitHub token (Settings > Developer settings > PAT) : " GH_TOKEN
  echo ""

  curl -s -X POST \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"private\":false}" | grep -q '"full_name"' \
    && echo "✓ Repo créé" || echo "⚠ Repo déjà existant ou erreur"

  git remote add origin "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO.git"
  git push -u origin main
  REPO_URL="https://github.com/$GH_USER/$REPO"
fi

echo ""
echo "✅ Repo pushé : $REPO_URL"
echo ""
echo "→ URL à coller dans PatriMoi_Native.jsx (BVC_COURS_URL) :"
echo "   https://raw.githubusercontent.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/main/bvc_cours.json"
