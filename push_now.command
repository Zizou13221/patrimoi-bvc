#!/bin/bash
REPO="patrimoi-bvc"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=== PatriMoi — Push GitHub ==="
TOKEN_FILE="$HOME/.patrimoi_token"
if [ -f "$TOKEN_FILE" ]; then
  GH_TOKEN=$(cat "$TOKEN_FILE")
  echo "→ Token chargé depuis ~/.patrimoi_token"
else
  read -sp "Token GitHub (ghp_...) : " GH_TOKEN
  echo ""
  echo "$GH_TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  echo "→ Token sauvegardé dans ~/.patrimoi_token"
fi

# Détecter le vrai username via l'API
echo "→ Détection du username..."
GH_USER=$(curl -s -H "Authorization: token $GH_TOKEN" https://api.github.com/user | python3 -c "import sys,json; print(json.load(sys.stdin).get('login',''))")

if [ -z "$GH_USER" ]; then
  echo "⚠ Token invalide ou sans accès API."
  read -p "Entrée pour fermer..."
  exit 1
fi

echo "✓ Username : $GH_USER"

# Créer le repo si besoin
echo "→ Vérification du repo..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/$GH_USER/$REPO)
if [ "$STATUS" = "404" ]; then
  curl -s -X POST -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"private\":false}" > /dev/null
  echo "✓ Repo créé"
else
  echo "✓ Repo existe"
fi

# Commit les changements locaux
git config user.email "zineddine.othmane1@gmail.com"
git config user.name "Zineddine Othmane"
git add -A
git diff --staged --quiet || git commit -m "chore: update $(date '+%Y-%m-%d %H:%M')"

# Push
echo "→ Push..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO.git"
if git push -u origin main 2>&1; then
  echo ""
  echo "✅ En ligne ! https://github.com/$GH_USER/$REPO"
  echo "BVC_COURS_URL : https://raw.githubusercontent.com/$GH_USER/$REPO/main/bvc_cours.json"
else
  echo "⚠ Push échoué."
fi
read -p "Entrée pour fermer..."
