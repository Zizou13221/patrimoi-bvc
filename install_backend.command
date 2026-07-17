#!/bin/bash
# PatriMoi — Installation backend Supabase
# Double-cliquer pour lancer

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================"
echo "  PatriMoi — Installation backend"
echo "================================================"
echo ""

# 1. Créer package.json si absent
if [ ! -f "package.json" ]; then
  echo "→ Initialisation du projet npm..."
  npm init -y > /dev/null
  # Mettre à jour le nom
  sed -i '' 's/"name": "PatriMoi"/"name": "patrimoi"/' package.json 2>/dev/null || true
  echo "  ✓ package.json créé"
fi

# 2. Installer @supabase/supabase-js
echo "→ Installation de @supabase/supabase-js..."
npm install @supabase/supabase-js
echo "  ✓ Supabase SDK installé"

# 3. Ouvrir Supabase dans Chrome
echo ""
echo "→ Ouverture de Supabase dans Chrome..."
open -a "Google Chrome" "https://supabase.com/dashboard/new"

echo ""
echo "================================================"
echo "  ✓ Installation terminée !"
echo ""
echo "  Étapes suivantes dans Chrome :"
echo "  1. Crée un projet → nom: patrimoi"
echo "  2. Settings → API → copie URL + anon key"
echo "  3. SQL Editor → colle backend/supabase/schema.sql"
echo "  4. Reviens ici — je créerai le .env pour toi"
echo "================================================"
echo ""
read -p "Appuie sur Entrée quand tu as les clés Supabase..."
echo ""
read -p "SUPABASE_URL (ex: https://xxxx.supabase.co) : " SUPA_URL
read -p "SUPABASE_ANON_KEY (eyJ...) : " SUPA_KEY

# 4. Créer le .env
cat > "$DIR/.env" << EOF
SUPABASE_URL=$SUPA_URL
SUPABASE_ANON_KEY=$SUPA_KEY
EOF

echo ""
echo "  ✓ Fichier .env créé !"
echo ""
echo "  Tu peux maintenant lancer l'app avec Xcode."
echo "================================================"
