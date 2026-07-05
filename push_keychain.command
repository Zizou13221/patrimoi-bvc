#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
echo "→ Tentative push via keychain macOS..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Zizou21213/patrimoi-bvc.git
git push -u origin main 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Pushé ! https://github.com/Zizou21213/patrimoi-bvc"
else
  echo "⚠ Échoué — lance push_now.command et entre ton token."
fi
read -p "Entrée..."
