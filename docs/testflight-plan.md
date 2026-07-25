# PatriMoi — Plan de test TestFlight (v1.2)

> À envoyer aux bêta-testeurs avec l'invitation TestFlight.
> Durée estimée : 30–45 min pour un testeur complet.

---

## Instructions d'accès

1. Installer l'app **TestFlight** depuis l'App Store (si pas déjà installée).
2. Accepter l'invitation reçue par e-mail.
3. Télécharger **PatriMoi (bêta)** depuis TestFlight.

---

## Profils de testeurs souhaités

| Profil | Nb testeurs | Focus |
|--------|-------------|-------|
| Utilisateur marocain, patrimoine immobilier | 2 | Saisie immo, calculs |
| Investisseur BVC actif | 2 | Portefeuille BVC, cours temps réel |
| Primo-utilisateur (jamais utilisé l'app) | 2 | UX onboarding, clarté |
| Testeur technique (dev ou QA) | 1 | Edge cases, crashes |

---

## Parcours de test prioritaires

### 🔴 P0 — Bloquants (à tester en premier)

#### P0.1 — Inscription et connexion
- [ ] Créer un compte avec un vrai email
- [ ] Vérifier la réception de l'email de confirmation
- [ ] Se connecter après confirmation
- [ ] Se déconnecter → se reconnecter → données intactes

#### P0.2 — Saisie et persistance des données
- [ ] Saisir des données dans au moins 3 catégories (ex : immobilier + banque + or)
- [ ] Fermer l'app complètement (swipe up depuis multitâche)
- [ ] Rouvrir l'app → vérifier que les données sont toujours là
- [ ] Désactiver le Wi-Fi → modifier une valeur → réactiver le Wi-Fi → attendre 30s → vérifier sync

#### P0.3 — Calcul du patrimoine total
- [ ] Saisir des montants précis et vérifier la somme affichée sur le Dashboard
- [ ] Modifier une valeur et vérifier que le total se met à jour immédiatement

---

### 🟠 P1 — Fonctionnalités clés

#### P1.1 — Catégories d'actifs
Tester chaque catégorie en ajoutant au moins un élément :
- [ ] **Liquidités** — DH + une devise étrangère (ex : USD)
- [ ] **Comptes bancaires** — ajouter 2 comptes
- [ ] **Carnet d'épargne** — avec taux et date de rappel
- [ ] **Immobilier** — méthode estimatif (prix/m²) et méthode offre
- [ ] **BVC** — ajouter une action (ex : HPS, ATW), vérifier que le cours se charge
- [ ] **Or** — avec quantité en grammes
- [ ] **Transport** — véhicule avec valeur
- [ ] **PEA/CTO** — ajouter une ligne avec PRU

#### P1.2 — Données de marché
- [ ] Ouvrir le Dashboard → vérifier que le prix de l'or s'affiche (loader puis valeur)
- [ ] Vérifier les cours BVC dans la catégorie BVC
- [ ] Passer en mode avion → ouvrir l'app → vérifier que les données locales s'affichent (pas de crash)
- [ ] Désactiver mode avion → vérifier que les cours se rafraîchissent

#### P1.3 — Historique et évolution
- [ ] Vérifier qu'un graphique d'évolution s'affiche sur le Dashboard
- [ ] Fermer l'app → attendre le lendemain (ou changer la date système) → rouvrir → vérifier un nouveau point d'historique

---

### 🟡 P2 — Sécurité et paramètres

#### P2.1 — PIN
- [ ] Paramètres → activer le PIN → saisir un code 6 chiffres
- [ ] Fermer l'app → rouvrir → vérifier que le PIN est demandé
- [ ] Saisir un mauvais PIN → vérifier le message d'erreur
- [ ] Saisir le bon PIN → vérifier l'accès
- [ ] Désactiver le PIN

#### P2.2 — Mode discret
- [ ] Activer le Mode Discret (Paramètres)
- [ ] Vérifier que les valeurs financières sont masquées
- [ ] Faire une capture d'écran → vérifier qu'elle est noire/floue

#### P2.3 — Mode démo
- [ ] Se déconnecter
- [ ] Écran de connexion → "Mode Démo"
- [ ] Naviguer dans les 6 onglets avec les données de démo
- [ ] Vérifier qu'aucune donnée réelle n'est visible

---

### 🔵 P3 — Edge cases

- [ ] Saisir une valeur très grande (ex : 10 000 000 DH) → vérifier l'affichage
- [ ] Saisir 0 dans tous les champs → vérifier l'affichage du Dashboard
- [ ] Changer la langue du téléphone en arabe → vérifier que l'app reste en français (comportement attendu)
- [ ] Utiliser l'app en Dark Mode → vérifier la lisibilité
- [ ] Laisser l'app en arrière-plan 10 minutes → revenir → vérifier que les cours BVC se rafraîchissent

---

## Bugs à signaler

Pour chaque bug, préciser :
1. Onglet / écran où le bug s'est produit
2. Étapes pour reproduire
3. Comportement observé vs attendu
4. Capture d'écran si possible
5. Modèle iPhone et version iOS

Envoyer les rapports à : **beta@patrimoi.ma** ou via le bouton "Shake to report" dans TestFlight.

---

## Fonctionnalités hors scope (ne pas tester)

- Paiement PatriMoi+ (non implémenté en v1.2)
- Notifications push (non implémentées en v1.2)
- Partage / export PDF (prévu v1.3)

---

## Données de test suggérées

Pour un scénario réaliste marocain :

| Catégorie | Exemple de saisie |
|-----------|------------------|
| Liquidités DH | 15 000 DH |
| Devise | 500 USD (taux ~10.2) |
| Compte bancaire | CIH : 45 000 DH / Attijariwafa : 80 000 DH |
| Carnet d'épargne | CEN Banque Populaire : 120 000 DH, taux 3% |
| Immobilier | Appartement Casablanca, 75m², 12 000 DH/m² |
| BVC | HPS : 5 titres PRU 5 200 DH / ATW : 20 titres PRU 580 DH |
| Or | 50g |
| Transport | Dacia Logan 2021 : 85 000 DH |

Patrimoine total attendu : ~1 500 000 DH (1.5M)

---

## Timeline

| Étape | Date cible |
|-------|-----------|
| Build TestFlight disponible | J+0 |
| Fin de la période de test | J+7 |
| Consolidation des retours | J+8 |
| Correctifs P0/P1 | J+9 → J+11 |
| Build App Store final | J+12 |
