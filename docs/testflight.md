# PatriMoi — Guide TestFlight

> Guide complet pour soumettre un build sur TestFlight depuis la machine de développement.
> Architecture deux-repos : sources dans `~/Claude/Projects/PatriMoi`, build Xcode dans `~/PatriMoiApp`.

---

## Architecture Fastlane

```
ios/
├── Gemfile          # fastlane ~2.225, cocoapods ~1.15
└── fastlane/
    ├── Appfile      # bundle ID, apple_id, team_id
    ├── Fastfile     # lanes : beta, certs, verify
    └── Matchfile    # stockage certs git (MATCH_GIT_URL)
```

Fastlane est dans le repo **source** (`~/Claude/Projects/PatriMoi/ios/`).
Le build Xcode se fait depuis **`~/PatriMoiApp/`** (workspace et xcodeproj).
Les deux repos doivent être synchronisés via `apply_modifs.command` avant tout build.

---

## Prérequis one-time

### 1. Variables d'environnement

Créer `~/Claude/Projects/PatriMoi/ios/.env.local` (non commité) :

```bash
# Apple Developer
APPLE_ID=zineddine.othmane1@gmail.com
TEAM_ID=XXXXXXXXXX          # 10 chars, dans developer.apple.com → Membership
ITC_TEAM_ID=XXXXXXXXXX      # identique au TEAM_ID si compte individuel

# App Store Connect API Key (recommandé — évite la 2FA interactive)
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APP_STORE_CONNECT_KEY_CONTENT=LS0tLS1CRUdJTi...  # base64 du fichier .p8

# Match (certificats git)
MATCH_GIT_URL=git@github.com:TON_USER/patrimoi-certs.git
MATCH_PASSWORD=mot_de_passe_chiffrement_certs
```

> ⚠️ Ajouter `.env.local` au `.gitignore` si pas déjà fait.

### 2. App Store Connect API Key

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Users and Access → Keys
2. Créer une clé avec rôle **App Manager**
3. Télécharger le `.p8` (une seule fois)
4. Encoder en base64 : `base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\n'`
5. Coller dans `APP_STORE_CONNECT_KEY_CONTENT`

### 3. Match — initialisation du repo de certs

```bash
# Créer un repo privé sur GitHub : patrimoi-certs
# Puis :
cd ~/Claude/Projects/PatriMoi/ios
bundle exec fastlane match init  # renseigne le git_url
bundle exec fastlane match appstore  # génère + stocke les certs
```

### 4. App dans App Store Connect

- Créer l'app : [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → +
- Bundle ID : `ma.patrimoi.app`
- SKU : `patrimoi-ios-v1`
- Langue principale : Français (France)

---

## Numéros de version — état actuel

| Champ | Valeur actuelle | Cible App Store |
|-------|----------------|-----------------|
| CFBundleShortVersionString (marketing) | **1.2** | **1.2** |
| CFBundleVersion (build number) | à vérifier | incrémenté auto par Fastlane |
| package.json version | 1.0.0 | (non utilisé par iOS, peut rester) |

> Pour vérifier/modifier : ouvrir `~/PatriMoiApp/PatriMoiApp.xcodeproj` → cible PatriMoiApp → General → Identity.

**Règle build number :**
Fastlane récupère automatiquement `latest_testflight_build_number + 1` depuis App Store Connect.
Pas besoin d'incrémenter à la main.

---

## Soumettre un build TestFlight

### Workflow standard

```bash
# 1. Sync sources → Xcode
cd ~/Claude/Projects/PatriMoi
bash apply_modifs.command

# 2. Lancer Fastlane depuis ios/
cd ~/Claude/Projects/PatriMoi/ios
bundle exec fastlane beta
```

Fastlane fait dans l'ordre :
1. Sync certs via `match appstore`
2. Récupère le dernier build number + 1 depuis App Store Connect
3. Compile en Release (gym / xcodebuild)
4. Upload sur TestFlight (`pilot`, sans soumettre à review)
5. Tague le commit git `build/NNN` et pousse le tag

### Build local sans upload (vérification rapide)

```bash
cd ~/Claude/Projects/PatriMoi/ios
bundle exec fastlane verify
```

---

## Checklist avant chaque build TestFlight

### Code
- [ ] `apply_modifs.command` exécuté (sources → `~/PatriMoiApp`)
- [ ] `metro reset` si changement de deps natives
- [ ] Aucun `console.log` sensible (données financières) en prod
- [ ] `__DEV__` guards sur tous les logs de debug

### Xcode (`~/PatriMoiApp`)
- [ ] Scheme sélectionné : **PatriMoiApp** (pas Debug)
- [ ] Configuration : **Release**
- [ ] Bitcode : désactivé (RN 0.75 incompatible)
- [ ] Code signing : **Automatic**, team sélectionné

### App Store Connect
- [ ] App créée avec bundle ID `ma.patrimoi.app`
- [ ] Privacy Policy URL renseignée : `https://patrimoi.ma/privacy`
- [ ] Au moins un testeur interne ajouté

---

## Troubleshooting fréquent

| Erreur | Cause | Fix |
|--------|-------|-----|
| `No profiles for 'ma.patrimoi.app' were found` | match n'a pas de cert | `bundle exec fastlane certs` |
| `Code signing is required for product type` | mauvais export method | vérifier `export_method: "app-store"` dans gym |
| `Could not find latest build number` | API key non configurée | vérifier les 3 vars `APP_STORE_CONNECT_*` |
| `xcrun: error: SDK "iphoneos" cannot be located` | Xcode CLI tools | `sudo xcode-select --switch /Applications/Xcode.app` |
| `changelog_from_git_commits failed` | repo git non trouvé | vérifier `path: "../"` dans Fastfile |
| Build upload timeout | réseau lent | ajouter `skip_waiting_for_build_processing: true` (déjà en place) |

---

## Env vars résumé

```
APPLE_ID                        ← apple developer account email
TEAM_ID                         ← 10-char developer team ID
ITC_TEAM_ID                     ← iTunes Connect team ID
APP_STORE_CONNECT_KEY_ID        ← clé API App Store Connect
APP_STORE_CONNECT_ISSUER_ID     ← issuer UUID
APP_STORE_CONNECT_KEY_CONTENT   ← contenu .p8 en base64
MATCH_GIT_URL                   ← repo git privé pour les certs
MATCH_PASSWORD                  ← mot de passe chiffrement match
```
