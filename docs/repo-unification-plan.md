# Plan d'unification des repos PatriMoi

> **Statut** : VALIDÉ — 5 AMENDEMENTS APPLIQUÉS — PRÊT À EXÉCUTER
> **Point d'arrêt** : exécuter jusqu'à l'**Étape 7** (tests) incluse, puis attendre feu vert avant build Xcode.

---

## Situation actuelle (deux repos)

```
~/Claude/Projects/PatriMoi/   ← repo SOURCE (code JS, tests, CI, docs, backend)
~/PatriMoiApp/                ← repo BUILD (projet Xcode, node_modules, pods)
```

`apply_modifs.command` synchronise manuellement les fichiers modifiés de SOURCE → BUILD avant chaque build Xcode.

### Problèmes actuels

| # | Problème | Impact |
|---|----------|--------|
| P1 | Sync manuelle → oubli fréquent avant build | Build avec code périmé |
| P2 | `.ts` RN template shadowent nos `.js` (Metro résout `.ts` en premier) | Bug silencieux — module ignoré |
| P3 | `patrimoineStore.ts` doit être supprimé à chaque sync | Source d'erreur récurrente |
| P4 | Tests Jest dans PatriMoi, pas dans PatriMoiApp | CI valide du code jamais buildé |
| P5 | Historique git fragmenté entre deux repos | Tracabilité des bugs difficile |
| P6 | `tsconfig.json` `moduleResolution: "bundler"` incompatible Metro | Erreurs tsc intermittentes |
| P7 | `apply_modifs.command` maintient une liste blanche de fichiers à copier | Oubli d'un nouveau fichier → crash silencieux |

---

## Cible : repo unique

**Le repo cible est `~/PatriMoiApp`** (renommé/gardé), enrichi avec tout le contenu de `~/Claude/Projects/PatriMoi`.  
`~/PatriMoiApp` est la base car il contient le projet Xcode (non reconstructible facilement).

> ⚠️ **Perte d'historique git acceptée** : on ne merge pas l'historique des deux repos. Le tag `pre-unification` dans chacun servira de référence si besoin.

```
~/PatriMoiApp/              ← repo unique post-unification
├── ios/
│   ├── PatriMoiApp/        (Xcode project, déjà présent)
│   │   ├── PatriMoiApp.xcodeproj
│   │   ├── PatriMoiApp.xcworkspace
│   │   ├── Info.plist
│   │   ├── AppDelegate.mm
│   │   ├── RNPDFExport.h   (module natif custom)
│   │   └── RNPDFExport.m
│   └── fastlane/           ← COPIER depuis PatriMoi/ios/fastlane/
│       ├── Appfile
│       ├── Fastfile
│       └── Matchfile       ← NOUVEAU (créé en T5)
├── android/                (vide / non utilisé — iOS only)
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.jsx
│   │   └── shared.jsx
│   ├── constants/
│   │   ├── colors.js
│   │   └── data.js
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── navigationRef.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── PageActifs.jsx
│   │   ├── PageAPropos.jsx
│   │   ├── PageAuth.jsx
│   │   ├── PageConseils.jsx
│   │   ├── PageDashboard.jsx
│   │   ├── PageOnboarding.jsx
│   │   ├── PageParams.jsx
│   │   └── PageProverbe.jsx
│   ├── schemas/
│   │   └── index.js        (stub sans zod)
│   ├── store/
│   │   ├── patrimoineStore.js   ← version autonome (sans slices)
│   │   └── slices/
│   │       └── uiSlice.ts   ← vérifier si importé; si mort, supprimer
│   └── utils/
│       ├── api.js
│       ├── auth.js
│       ├── biometrics.js
│       ├── calc.js
│       ├── conseils.js
│       ├── env.js           ← NOUVEAU (T6)
│       ├── fmt.js
│       ├── history.js
│       ├── keychainStorage.js
│       ├── migrations.js
│       ├── pinHash.js       ← NOUVEAU (T2)
│       ├── sentry.js
│       ├── storage.js       ← modifié (T3, initStorage async)
│       ├── supabase.js
│       └── syncQueue.js
├── backend/
│   └── supabase/
│       ├── config.toml
│       ├── migrations/      (001 → 011)
│       ├── schema.sql
│       └── tests/
├── docs/
│   ├── appstore/            ← NOUVEAU (T4)
│   ├── testflight.md        ← NOUVEAU (T5)
│   ├── testflight-plan.md   ← NOUVEAU (T5)
│   └── repo-unification-plan.md (ce fichier)
├── .github/
│   └── workflows/
│       ├── ci.yml           ← copier depuis PatriMoi
│       └── release.yml      ← copier depuis PatriMoi
│       # ⚠️ Ne PAS copier bvc.yml et or.yml — ils restent dans patrimoi-bvc
│       #    repo dédié avec son propre runner.
├── __tests__/
│   ├── calc.test.js
│   ├── migrations.test.ts
│   ├── phase5.test.js
│   └── store.test.ts
├── __mocks__/
│   ├── async-storage.js
│   ├── env.js               ← CRÉER (voir section jest.config.js)
│   ├── keychain.js
│   ├── mmkv.js
│   └── prevent-screenshot.js
├── .maestro/
│   ├── 01_auth.yaml
│   ├── 02_ajout_actif.yaml
│   └── 03_mode_discret.yaml
├── AppIcon.appiconset/
├── PatriMoi_Native.jsx
├── index.js                 ← MERGER manuellement (ne pas écraser)
├── package.json             ← MERGER manuellement (ne pas écraser)
├── jest.config.js           ← MERGER manuellement (voir section dédiée)
├── tsconfig.json            ← MERGER manuellement (voir section dédiée)
├── metro.config.js          ← MERGER manuellement (voir section dédiée)
├── babel.config.js          ← MERGER manuellement ou créer si absent
├── .env                     ← copier depuis PatriMoi (APRÈS merge .gitignore + vérif git status)
├── .env.example             ← copier depuis PatriMoi
└── .gitignore               ← MERGER manuellement EN PRIORITÉ (Étape 3-bis)
```

---

## Fichiers exclus du rsync — à merger manuellement

Ces fichiers existent dans les deux repos avec des contenus différents.
Le rsync les **exclut** — merger manuellement APRÈS :

| Fichier | Pourquoi merger manuellement |
|---------|------------------------------|
| `package.json` | PatriMoiApp contient les deps natives iOS — écraser serait catastrophique |
| `package-lock.json` | Dérivé de package.json — regénérer après merger |
| `.gitignore` | Doit être mergé EN PREMIER avant tout git add (Étape 3-bis) |
| `jest.config.js` | Configs différentes entre les deux repos |
| `tsconfig.json` | Doit être adapté (moduleResolution, supprimer paths) |
| `metro.config.js` | Doit être vérifié/adapté |
| `babel.config.js` | Doit être vérifié ou créé si absent |
| `index.js` | Point d'entrée RN — doit être vérifié |
| `apply_modifs.command` | Archiver dans docs/, pas copier dans le repo |
| `Podfile_fixed*.rb` | Artefacts temporaires — exclure |
| `bvc.yml`, `or.yml` | Restent dans patrimoi-bvc avec runner dédié |
| `*.docx` | Artefacts Office — exclure |

---

## Fichiers à supprimer de PatriMoiApp (conflits .ts/.js)

Ces fichiers `.ts` du template RN shadowent nos `.js` — Metro résout `.ts` avant `.js`.
Après fusion, les supprimer une fois pour toutes.

```bash
# À supprimer dans ~/PatriMoiApp (après rsync) :
src/utils/auth.ts            → remplacé par auth.js
src/utils/supabase.ts        → remplacé par supabase.js
src/utils/api.ts             → remplacé par api.js
src/utils/storage.ts         → remplacé par storage.js
src/utils/keychainStorage.ts → remplacé par keychainStorage.js
src/utils/syncQueue.ts       → remplacé par syncQueue.js
src/utils/sentry.ts          → remplacé par sentry.js
src/utils/calc.ts            → migrer imports tests → supprimer
src/utils/fmt.ts             → remplacé par fmt.js
src/utils/history.ts         → remplacé par history.js
src/utils/migrations.ts      → migrer imports tests → supprimer
src/schemas/index.ts         → remplacé par index.js (stub sans zod)
src/store/patrimoineStore.ts → remplacé par patrimoineStore.js
PatriMoi_Native.ts           → remplacé par PatriMoi_Native.jsx
index.ts                     → remplacé par index.js
```

> **`uiSlice.ts`** : vérifier via `grep -r "uiSlice" src/ __tests__/`.
> Si aucun import → code mort → supprimer + retirer de `collectCoverageFrom` dans `jest.config.js`.

---

## Adaptations techniques

### 1. `tsconfig.json`

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true
    // Supprimer baseUrl et paths — Metro ne les honore pas
  }
}
```

---

### 2. `jest.config.js`

```js
collectCoverageFrom: [
  'src/utils/calc.js',
  'src/utils/migrations.js',
  // 'src/store/slices/*.ts',  ← retirer si uiSlice.ts est dead code
  'src/schemas/index.js',
],

moduleNameMapper: {
  // ... existant ...
  '../utils/env': '<rootDir>/__mocks__/env.js',
  './env':        '<rootDir>/__mocks__/env.js',
},
```

**Créer `__mocks__/env.js`** :
```js
module.exports = {
  SUPABASE_URL:      'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
};
```

---

### 3. `metro.config.js`

```js
const config = {
  resolver: {
    // TEMPORAIRE — js/jsx avant ts/tsx pour priorité à nos .js sur les .ts résiduels
    // du template pendant la phase de nettoyage.
    // Retirer après confirmation anti-shadowing (find/uniq -d vide).
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  },
};
```

---

### 4. `babel.config.js`

Si absent dans PatriMoiApp :
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};
```

---

### 5. `package.json` — merger les dépendances

Ajouter dans PatriMoiApp ce qui manque depuis PatriMoi (`devDependencies`, types TS, jest...).  
Ne PAS écraser les deps natives de PatriMoiApp. Ne PAS ré-introduire de token GitHub (`ghp_*`).

Après merger : `npm install` puis `pod install` (pas de changement pods si aucune native dep).

---

## Impact CI

Seuls `ci.yml` et `release.yml` entrent dans le repo unifié.  
`bvc.yml` et `or.yml` restent dans `patrimoi-bvc` (runner dédié).

```yaml
# ci.yml — ajouter env vars mock pour Jest
- name: Jest
  run: npm test -- --forceExit --passWithNoTests --ci
  env:
    CI: true
    SUPABASE_URL: https://test.supabase.co
    SUPABASE_ANON_KEY: test-key
```

---

## Procédure d'exécution

> ⏸️ **POINT D'ARRÊT après l'Étape 7** : attendre feu vert avant Étapes 8-9 (Xcode + commit).

---

### Étape 0 — Tags de sauvegarde

```bash
git -C ~/PatriMoiApp          tag pre-unification
git -C ~/Claude/Projects/PatriMoi tag pre-unification
```

---

### Étape 1 — rsync (fichiers non-conflictuels uniquement)

```bash
rsync -av \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=package.json \
  --exclude=package-lock.json \
  --exclude=.gitignore \
  --exclude=jest.config.js \
  --exclude=tsconfig.json \
  --exclude=metro.config.js \
  --exclude=babel.config.js \
  --exclude=index.js \
  --exclude='apply_modifs.command' \
  --exclude='Podfile_fixed*.rb' \
  --exclude='bvc.yml' \
  --exclude='or.yml' \
  --exclude='*.docx' \
  ~/Claude/Projects/PatriMoi/ ~/PatriMoiApp/
```

---

### Étape 2 — Merger les fichiers exclus manuellement

```
package.json   → priorité PatriMoiApp (deps natives) + ajout devDeps depuis PatriMoi
index.js       → vérifier point d'entrée RN (généralement identique)
babel.config.js → créer si absent dans PatriMoiApp
```

---

### Étape 3-bis — Merger .gitignore EN PREMIER, vérifier .env avant tout git add

```bash
# 1. Merger les deux .gitignore
cat ~/Claude/Projects/PatriMoi/.gitignore ~/PatriMoiApp/.gitignore \
  | sort -u > /tmp/gitignore_merged.txt
cp /tmp/gitignore_merged.txt ~/PatriMoiApp/.gitignore

# 2. Vérifier que .env n'apparaît PAS dans git status
cd ~/PatriMoiApp
git status --short | grep '\.env'
# Doit retourner vide. Si non → corriger .gitignore avant de continuer.

# 3. Seulement si .env absent de git status → copier
cp ~/Claude/Projects/PatriMoi/.env ~/PatriMoiApp/.env   # NE PAS git add ce fichier

# 4. Re-vérifier
git status --short | grep '\.env'
# Doit rester vide
```

---

### Étape 4 — Merger tsconfig.json, jest.config.js, metro.config.js

Appliquer les adaptations des sections ci-dessus.

---

### Étape 5 — Supprimer les .ts conflictuels

```bash
cd ~/PatriMoiApp

rm -f src/utils/auth.ts src/utils/supabase.ts src/utils/api.ts \
      src/utils/storage.ts src/utils/keychainStorage.ts \
      src/utils/syncQueue.ts src/utils/sentry.ts src/utils/fmt.ts \
      src/utils/history.ts src/schemas/index.ts \
      src/store/patrimoineStore.ts PatriMoi_Native.ts index.ts

# calc.ts et migrations.ts : migrer les imports test vers .js puis supprimer
grep -r "calc\.ts\|migrations\.ts" __tests__/
# Corriger les imports, puis :
rm -f src/utils/calc.ts src/utils/migrations.ts

# uiSlice.ts : vérifier si code mort
grep -r "uiSlice" src/ __tests__/ --include="*.js" --include="*.jsx" \
  --include="*.ts" --include="*.tsx" | grep -v "uiSlice\.ts:"
# Aucun résultat → supprimer uiSlice.ts + retirer de jest.config.js
```

---

### Étape 6 — Créer __mocks__/env.js + npm install

```bash
cd ~/PatriMoiApp

cat > __mocks__/env.js << 'EOF'
module.exports = {
  SUPABASE_URL:      'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
};
EOF

npm install
cd ios && pod install && cd ..
```

---

### Étape 7 — Vérifications ⏸️ STOP ICI — attendre feu vert

```bash
cd ~/PatriMoiApp

# A) Tests Jest
npm test -- --forceExit --passWithNoTests
# → 100% pass requis

# B) TypeScript
npx tsc --noEmit
# → erreurs non-bloquantes OK, bloquantes NON

# C) Check anti-shadowing — DOIT retourner VIDE
find src/ -name "*.ts" -o -name "*.tsx" | sed 's/\.tsx\?$//' | sort | uniq -d
# Si résultats → un .ts shadow encore un .js → blocker à corriger

# D) .env toujours ignoré
git status --short | grep '\.env'
# Doit rester vide

# E) Smoke test device avec données existantes (pas fresh install)
# Lancer sur device avec données patrimoine déjà présentes.
# Vérifier : dashboard, navigation, sync Supabase, PatriMoi+.
# Ce test valide la migration Keychain sur données réelles.
```

> ⏸️ **Envoyer les résultats A/B/C/D + confirmation smoke test E pour feu vert avant Étape 8.**

---

### Étape 8 — Build Xcode (après feu vert)

```bash
cd ~/PatriMoiApp/ios
bundle exec fastlane verify
# ou : ouvrir Xcode → Build (⌘B)
```

---

### Étape 9 — Commit + archivage

```bash
cd ~/PatriMoiApp
git add -A
git commit -m "chore: unification repos PatriMoi + PatriMoiApp"
git push

# Archiver le repo source :
# GitHub > dépôt PatriMoi source > Settings > Danger Zone > Archive this repository
# → devient patrimoi-legacy (read-only, historique conservé pour référence)
```

---

## Procédure de rollback

```bash
# Option A — rollback complet
git -C ~/PatriMoiApp reset --hard pre-unification
git -C ~/PatriMoiApp clean -fd

# Option B — continuer avec l'ancienne méthode (apply_modifs.command intact jusqu'à étape 9)

# Option C — si build Xcode cassé mais JS OK
cd ~/PatriMoiApp && pod install --repo-update
npx react-native start --reset-cache
```

---

## Critères de succès

- [ ] `npm test` passe à 100%
- [ ] `tsc --noEmit` sans erreurs bloquantes
- [ ] Anti-shadowing vide : `find src/ -name "*.ts" -o -name "*.tsx" | sed 's/\.tsx\?$//' | sort | uniq -d` → aucun résultat
- [ ] `.env` absent de `git status`
- [ ] `cd ios && bundle exec fastlane verify` compile en Debug sans erreur
- [ ] `apply_modifs.command` archivé dans `docs/` (plus à la racine)
- [ ] Smoke test device : app fonctionne avec données existantes (migration Keychain réelle)
- [ ] CI verte sur le premier push post-unification
- [ ] Build TestFlight réussi depuis le repo unifié
- [ ] Repo source archivé en lecture seule (patrimoi-legacy) sur GitHub
