# PatriMoi — App Privacy Labels (App Store Connect)

## URL Privacy Policy à renseigner dans App Store Connect

```
https://<ton-username>.github.io/PatriMoi/privacy-policy.html
```

> **Setup GitHub Pages :** Aller dans ton repo GitHub → Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, Folder: `/docs` → Save.
> La privacy policy sera accessible à l'URL ci-dessus dans quelques minutes.

---

## App Privacy Labels à remplir dans App Store Connect

> App Store Connect → ton app → App Privacy

---

### ❓ Votre application collecte-t-elle des données ?

**OUI**

---

### Types de données collectées

#### ✅ Data Used to Track You
**Aucune** — cocher "We do not track users"

---

#### ✅ Data Linked to You

| Type de donnée | Catégorie App Store | Utilisation | Tracking ? |
|---|---|---|---|
| Adresse email | **Contact Info → Email Address** | Account Management | Non |
| Prénom / Nom | **Contact Info → Name** | App Functionality | Non |
| Patrimoine (actifs, montants) | **Financial Info → Other Financial Info** | App Functionality | Non |
| Historique snapshots | **Financial Info → Other Financial Info** | App Functionality | Non |
| Budget & dépenses | **Financial Info → Other Financial Info** | App Functionality | Non |
| Identifiant utilisateur Supabase | **Identifiers → User ID** | App Functionality | Non |

---

#### ✅ Data Not Linked to You

| Type de donnée | Catégorie App Store | Utilisation |
|---|---|---|
| Journaux d'erreurs (anonymisés) | **Diagnostics → Crash Data** | App Functionality |

---

### Récapitulatif des sélections dans l'interface App Store Connect

```
App Privacy → Data types collected:

[x] Contact Info
    [x] Name            → App Functionality → Linked to you → Not used for tracking
    [x] Email Address   → App Functionality → Linked to you → Not used for tracking

[x] Financial Info
    [x] Other Financial Info
        → App Functionality
        → Linked to you
        → Not used for tracking

[x] Identifiers
    [x] User ID
        → App Functionality
        → Linked to you
        → Not used for tracking

[x] Diagnostics
    [x] Crash Data
        → App Functionality
        → Not linked to you
        → Not used for tracking

[ ] Health & Fitness    → NE PAS COCHER
[ ] Location            → NE PAS COCHER
[ ] Browsing History    → NE PAS COCHER
[ ] Search History      → NE PAS COCHER
[ ] Purchases           → NE PAS COCHER (Apple gère les IAP de son côté)
[ ] Sensitive Info      → NE PAS COCHER
[ ] Contacts            → NE PAS COCHER
[ ] Photos / Videos     → NE PAS COCHER
```

---

### Note importante : PatriMoi+ (IAP)

Les achats in-app (PatriMoi+ 49 DH/mois) sont gérés exclusivement par Apple via StoreKit. PatriMoi ne collecte ni ne stocke aucune information de paiement. Ne pas cocher "Purchases" dans les App Privacy Labels — Apple le gère côté App Store.

---

## Checklist complète avant soumission App Store

- [ ] Privacy Policy URL renseignée dans App Store Connect (champ "Privacy Policy URL")
- [ ] Privacy Policy URL renseignée dans les CGU de l'app (PageAuth.jsx line ~213)
- [ ] App Privacy Labels remplis (section ci-dessus)
- [ ] GitHub Pages activé sur le repo (branche main, dossier /docs)
- [ ] Vérifier que `https://<username>.github.io/PatriMoi/privacy-policy.html` est accessible publiquement
- [ ] Tester le lien sur mobile avant soumission
