#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
cd "$APP"

echo "=== PatriMoi — Fix complet ==="

# 0. Supprimer DerivedData PatriMoiApp (force clean build)
echo "▸ Nettoyage DerivedData..."
DD=$(find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -name "PatriMoiApp-*" -type d 2>/dev/null | head -1)
if [ -n "$DD" ]; then
  rm -rf "$DD"
  echo "✓ DerivedData supprimé: $DD"
else
  echo "✓ DerivedData déjà propre"
fi

# 1. Installer les dépendances npm (pod install sera fait après fix Podfile, en step 7)
echo "▸ Installation des dépendances npm..."
npm install react-native-url-polyfill --silent
npm install react-native-html-to-pdf --silent
npm install zustand --silent
npm install @react-native-community/push-notification-ios --silent
npm install react-native-biometrics --silent
npm install react-native-mmkv --silent
npm install react-native-keychain --silent
npm install react-native-prevent-screenshot --silent
npm install zod --silent
npm install --save-dev typescript @types/react @types/react-native --silent
# Phase 4 — React Navigation v7
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack --silent
npm install react-native-screens react-native-safe-area-context --silent
# Phase 6 — Sentry React Native
npm install @sentry/react-native --silent

# 2. Patcher index.js — ajouter le polyfill en tout premier
INDEX="$APP/index.js"
if ! grep -q "react-native-url-polyfill" "$INDEX"; then
  # Insérer l'import tout en haut du fichier
  TMPFILE=$(mktemp)
  echo "import 'react-native-url-polyfill/auto';" > "$TMPFILE"
  cat "$INDEX" >> "$TMPFILE"
  mv "$TMPFILE" "$INDEX"
  echo "✓ index.js patché"
else
  echo "✓ index.js déjà patché"
fi

# 3. Copier supabase.js corrigé depuis le workspace
SRC="$HOME/Claude/Projects/PatriMoi/src/utils/supabase.js"
DST="$APP/src/utils/supabase.js"
if [ -f "$SRC" ]; then
  # Retirer le doublon d'import dans supabase.js (le polyfill est déjà dans index.js)
  grep -v "react-native-url-polyfill" "$SRC" > "$DST"
  echo "✓ supabase.js copié"
fi

# 4. Copier tous les fichiers source modifiés depuis le workspace (.js .jsx .ts .tsx)
for f in $(find "$HOME/Claude/Projects/PatriMoi/src" -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx"); do
  RELATIVE="${f#$HOME/Claude/Projects/PatriMoi/}"
  DEST="$APP/$RELATIVE"
  mkdir -p "$(dirname "$DEST")"
  cp "$f" "$DEST"
done
echo "✓ Sources synchronisées"

# 4e. Copier tsconfig.json vers PatriMoiApp
if [ -f "$HOME/Claude/Projects/PatriMoi/tsconfig.json" ]; then
  cp "$HOME/Claude/Projects/PatriMoi/tsconfig.json" "$APP/tsconfig.json"
  echo "✓ tsconfig.json synchronisé"
fi

# 4b. Copier __tests__/ + __mocks__/ vers PatriMoiApp
if [ -d "$HOME/Claude/Projects/PatriMoi/__tests__" ]; then
  mkdir -p "$APP/__tests__"
  cp -r "$HOME/Claude/Projects/PatriMoi/__tests__/." "$APP/__tests__/"
  echo "✓ Tests synchronisés"
fi
if [ -d "$HOME/Claude/Projects/PatriMoi/__mocks__" ]; then
  mkdir -p "$APP/__mocks__"
  cp -r "$HOME/Claude/Projects/PatriMoi/__mocks__/." "$APP/__mocks__/"
  echo "✓ Mocks synchronisés"
fi

# 4c. Copier .github/workflows/ vers PatriMoiApp (CI)
if [ -d "$HOME/Claude/Projects/PatriMoi/.github" ]; then
  mkdir -p "$APP/.github/workflows"
  cp -r "$HOME/Claude/Projects/PatriMoi/.github/." "$APP/.github/"
  echo "✓ GitHub Actions synchronisé"
fi

# 4d. Copier jsconfig.json + jest.config.js vers PatriMoiApp
if [ -f "$HOME/Claude/Projects/PatriMoi/jsconfig.json" ]; then
  cp "$HOME/Claude/Projects/PatriMoi/jsconfig.json" "$APP/jsconfig.json"
fi
if [ -f "$HOME/Claude/Projects/PatriMoi/jest.config.js" ]; then
  cp "$HOME/Claude/Projects/PatriMoi/jest.config.js" "$APP/jest.config.js"
  echo "✓ jest.config.js synchronisé"
fi
# 4g. Copier backend Supabase complet vers PatriMoiApp
if [ -d "$HOME/Claude/Projects/PatriMoi/backend/supabase" ]; then
  mkdir -p "$APP/backend/supabase/migrations"
  mkdir -p "$APP/backend/supabase/tests"
  cp -r "$HOME/Claude/Projects/PatriMoi/backend/supabase/migrations/." "$APP/backend/supabase/migrations/"
  cp -r "$HOME/Claude/Projects/PatriMoi/backend/supabase/tests/." "$APP/backend/supabase/tests/"
  echo "✓ Migrations + tests SQL synchronisés"
fi

# 4h. Copier .maestro/ (flows E2E) vers PatriMoiApp
if [ -d "$HOME/Claude/Projects/PatriMoi/.maestro" ]; then
  mkdir -p "$APP/.maestro"
  cp -r "$HOME/Claude/Projects/PatriMoi/.maestro/." "$APP/.maestro/"
  echo "✓ Flows Maestro synchronisés"
fi

# 4i. Copier docs/ vers PatriMoiApp
if [ -d "$HOME/Claude/Projects/PatriMoi/docs" ]; then
  mkdir -p "$APP/docs"
  cp -r "$HOME/Claude/Projects/PatriMoi/docs/." "$APP/docs/"
  echo "✓ Documentation synchronisée"
fi

# 4f. Copier Fastfile + Gemfile vers PatriMoiApp/ios/fastlane/
if [ -d "$HOME/Claude/Projects/PatriMoi/ios/fastlane" ]; then
  mkdir -p "$APP/ios/fastlane"
  cp -r "$HOME/Claude/Projects/PatriMoi/ios/fastlane/." "$APP/ios/fastlane/"
  echo "✓ Fastlane synchronisé"
fi
if [ -f "$HOME/Claude/Projects/PatriMoi/ios/Gemfile" ]; then
  cp "$HOME/Claude/Projects/PatriMoi/ios/Gemfile" "$APP/ios/Gemfile"
  echo "✓ Gemfile synchronisé"
fi

# 5. Copier les fichiers racine .jsx modifiés (avec fix permissions)
for f in "$HOME/Claude/Projects/PatriMoi/"*.jsx "$HOME/Claude/Projects/PatriMoi/"*.js; do
  [ -f "$f" ] || continue
  FNAME=$(basename "$f")
  # Ne pas écraser index.js (déjà patché) ni les configs Node
  [[ "$FNAME" == "index.js" ]] && continue
  [[ "$FNAME" == "metro.config.js" ]] && continue
  DEST="$APP/$FNAME"
  # Fix permissions si le fichier existe en lecture seule
  [ -f "$DEST" ] && chmod 644 "$DEST" 2>/dev/null || true
  cp "$f" "$DEST"
done
echo "✓ Fichiers racine synchronisés"

# 6. Fix Podfile avec Python: supprimer doublons + ajouter CODE_SIGNING_ALLOWED
echo "▸ Fix Podfile..."
python3 - "$HOME/PatriMoiApp/ios/Podfile" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Compter les blocs post_install
count = content.count('post_install do')
if count > 1:
    # Garder seulement le premier bloc post_install (supprimer les suivants)
    # Trouver et supprimer les blocs post_install en double
    parts = re.split(r'\npost_install do ', content)
    # Reconstruire avec seulement le premier
    first_part = parts[0]
    first_pi = parts[1]
    # Trouver la fin du premier bloc (le 'end' correspondant)
    depth = 1
    pos = 0
    lines = first_pi.split('\n')
    end_line = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'\b(do|if|unless|case|def|class|module|begin)\b', stripped) or stripped.endswith(' do') or stripped.endswith(' do |installer|'):
            depth += 1
        elif stripped == 'end':
            depth -= 1
            if depth == 0:
                end_line = i
                break
    kept_block = '\npost_install do ' + '\n'.join(lines[:end_line+1])
    new_content = first_part + kept_block + '\n'
    with open(path, 'w') as f:
        f.write(new_content)
    print(f'Podfile: {count-1} bloc(s) post_install en double supprimes')
    content = new_content

# Ajouter CODE_SIGNING_ALLOWED si absent
if 'CODE_SIGNING_ALLOWED' not in content:
    fix = (
        '  installer.pods_project.targets.each do |target|\n'
        '    target.build_configurations.each do |config|\n'
        '      config.build_settings["CODE_SIGNING_ALLOWED[sdk=iphonesimulator*]"] = "NO"\n'
        '    end\n'
        '  end\n'
    )
    # Inserer avant le dernier 'end' du premier post_install
    idx = content.rfind('\nend')
    new_content = content[:idx] + '\n' + fix + content[idx:]
    with open(path, 'w') as f:
        f.write(new_content)
    print('Podfile: CODE_SIGNING_ALLOWED ajoute')
else:
    print('Podfile: CODE_SIGNING_ALLOWED deja present')
PYEOF

# 7. Pod install avec le Podfile corrige
if [ -d "$APP/ios" ]; then
  echo "▸ Pod install..."
  cd "$APP/ios" && pod install 2>&1 | grep -E '(complete|error|warning:|TERMINE)' | head -10 && cd "$APP" || cd "$APP"
fi

# 8. Patch ALWAYS_EMBED après pod install (survit au pod install)
echo "▸ Fix ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES..."
PODS_PBXPROJ="$APP/ios/Pods/Pods.xcodeproj/project.pbxproj"
if [ -f "$PODS_PBXPROJ" ]; then
  sed -i '' 's/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES/ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = NO/g' "$PODS_PBXPROJ"
  echo "✓ ALWAYS_EMBED patché dans Pods.xcodeproj"
else
  echo "⚠ Pods.xcodeproj introuvable — pod install d'abord"
fi

echo ""
echo "=== Tout est corrigé ! ==="
echo "▸ Ouverture du workspace dans Xcode..."
open "$HOME/PatriMoiApp/ios/PatriMoiApp.xcworkspace"
echo "→ Dans Xcode: clique ▶ Run pour lancer le build"
