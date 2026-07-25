# App Privacy — Réponses Apple App Store Connect

> Fichier de référence pour remplir la section **App Privacy** dans App Store Connect.
> Chemin : App Store Connect → Mon App → Confidentialité de l'App

---

## Question 1 — Collecte de données

**"Do you collect data from this app?"**
→ **Yes**

---

## Question 2 — Data types collectées

### ✅ Contact Info
| Champ | Collecté | Lié à l'identité | Tracking |
|-------|----------|-------------------|---------|
| Email address | ✅ Oui | ✅ Oui | ❌ Non |
| Name (prénom/nom) | ✅ Oui (optionnel) | ✅ Oui | ❌ Non |

**Usage sélectionner** : App Functionality  
**Justification** : L'email est requis pour la création de compte et l'authentification. Le nom est optionnel et affiché dans l'interface.

---

### ✅ Financial Info
| Champ | Collecté | Lié à l'identité | Tracking |
|-------|----------|-------------------|---------|
| Other financial info | ✅ Oui | ✅ Oui | ❌ Non |

**Détail** : données de patrimoine saisies par l'utilisateur (immobilier, comptes bancaires, épargne, bourse BVC, or, transport, carnet d'épargne, liquidités).  
**Usage sélectionner** : App Functionality  
**Justification** : Finalité exclusive de l'app — calcul et visualisation du patrimoine. Jamais partagées avec des tiers à des fins commerciales.

> ⚠️ NE PAS sélectionner "Payment Info" — PatriMoi ne collecte pas de données de carte bancaire. La facturation PatriMoi+ passe par Apple In-App Purchase (géré par Apple, hors scope).

---

### ✅ User Content
| Champ | Collecté | Lié à l'identité | Tracking |
|-------|----------|-------------------|---------|
| Other user content | ✅ Oui | ✅ Oui | ❌ Non |

**Détail** : snapshots journaliers de la valeur totale du patrimoine (historique).  
**Usage sélectionner** : App Functionality

---

### ✅ Identifiers
| Champ | Collecté | Lié à l'identité | Tracking |
|-------|----------|-------------------|---------|
| User ID | ✅ Oui | ✅ Oui | ❌ Non |

**Détail** : UUID Supabase généré à l'inscription.  
**Usage sélectionner** : App Functionality  
**Justification** : Utilisé pour isoler les données de chaque utilisateur (Row Level Security).

---

### ✅ Diagnostics
| Champ | Collecté | Lié à l'identité | Tracking |
|-------|----------|-------------------|---------|
| Crash data | ✅ Oui | ⚠️ Voir note | ❌ Non |
| Performance data | ❌ Non | — | — |

**Note** : Sentry reçoit le User ID en contexte des crash reports (pour faciliter le debug). Cocher **"Linked to Identity"**.  
**Usage sélectionner** : App Functionality (amélioration de l'app)

---

### ❌ Non collectés — cocher "No" pour tout le reste

| Catégorie Apple | Statut |
|----------------|--------|
| Health & Fitness | ❌ Non collecté |
| Location | ❌ Non collecté |
| Sensitive Info | ❌ Non collecté |
| Contacts | ❌ Non collecté |
| Photos or Videos | ❌ Non collecté |
| Audio Data | ❌ Non collecté |
| Gameplay Content | ❌ Non collecté |
| Browsing History | ❌ Non collecté |
| Search History | ❌ Non collecté |
| Other Data | ❌ Non collecté |

---

## Question 3 — Data Used to Track You

**"Does this app use data to track users across apps and websites?"**
→ **No**

Pas de SDK publicitaire, pas d'IDFA, pas de pixel de tracking.

---

## Résumé — Nutrition Label attendue

```
Data Used to Track You      → None
Data Linked to You          → Contact Info
                              Financial Info
                              User Content
                              Identifiers
                              Diagnostics
Data Not Linked to You      → None
```

---

## Notes pour la mise à jour

- Si In-App Purchase PatriMoi+ est implémenté via StoreKit natif → Apple gère le billing, pas besoin d'ajouter "Purchase History".
- Si Sentry est configuré en mode anonyme (sans user ID) → passer Crash Data à "Not Linked to You".
- Cette section doit être mise à jour à chaque nouvel SDK ou service tiers ajouté à l'app.
