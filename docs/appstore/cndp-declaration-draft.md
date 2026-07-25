# CNDP — Brouillon de déclaration / demande d'autorisation

> **Loi 09-08** relative à la protection des personnes physiques à l'égard du traitement
> des données à caractère personnel (Maroc).
>
> Ce document est un brouillon de travail. Il doit être complété avec les informations
> légales de l'entité responsable et soumis à la CNDP via le portail :
> [https://www.cndp.ma](https://www.cndp.ma)

---

## ⚠️ Déclaration ou autorisation ?

La loi 09-08 distingue deux régimes :

| Régime | Quand | Délai |
|--------|-------|-------|
| **Déclaration** | Traitement courant ne touchant pas de données sensibles | Immédiat (accusé de réception) |
| **Autorisation préalable** | Données sensibles, interconnexion de fichiers, transferts hors Maroc | 2 à 3 mois |

**PatriMoi est soumis au régime de l'autorisation préalable** pour deux raisons :
1. **Données financières** = données à caractère personnel relatives à la situation économique et financière (art. 1 et art. 23 de la loi 09-08) — traitement soumis à autorisation.
2. **Transfert hors Maroc** : les données sont hébergées sur Supabase (infrastructure UE). Tout transfert de données personnelles vers un pays tiers doit être autorisé par la CNDP (art. 43 et 44).

---

## Formulaire — Demande d'autorisation

### I. Identité du responsable du traitement

| Champ | Valeur |
|-------|--------|
| Dénomination sociale | <!-- NOM_ENTITE_LEGALE --> |
| Forme juridique | <!-- SARL / SARLS / Auto-entrepreneur --> |
| RC / ICE | <!-- NUMERO_RC --> |
| Adresse du siège | <!-- ADRESSE_COMPLETE --> |
| Représentant légal | <!-- NOM_PRENOM_GERANT --> |
| Qualité | Gérant |
| Téléphone | <!-- TELEPHONE --> |
| E-mail | privacy@patrimoi.ma |

---

### II. Description du traitement

**Intitulé du traitement :**
Gestion et suivi du patrimoine personnel des utilisateurs de l'application mobile PatriMoi.

**Finalités du traitement :**
1. Permettre aux utilisateurs de saisir, visualiser et suivre l'évolution de leur patrimoine (immobilier, épargne, placements boursiers, or, liquidités, véhicules).
2. Fournir des conseils financiers personnalisés basés sur la composition du portefeuille.
3. Synchroniser les données entre les appareils de l'utilisateur via un serveur sécurisé.
4. Gérer l'abonnement PatriMoi+ (plan premium).
5. Détecter et corriger les dysfonctionnements techniques (rapports de plantage anonymisés).

**Les données ne sont pas utilisées à des fins commerciales, publicitaires ou de profilage tiers.**

---

### III. Catégories de données traitées

| Catégorie | Données | Obligatoire ? |
|-----------|---------|---------------|
| Données d'identification | Adresse e-mail, prénom, nom | E-mail obligatoire (auth) ; nom optionnel |
| Données financières | Valeurs immobilières, soldes bancaires, épargne, portefeuille boursier, quantité d'or, valeur véhicules, liquidités en DH et devises | Optionnel — saisi volontairement |
| Données de suivi | Snapshots journaliers de la valeur nette totale | Automatique si l'app est utilisée |
| Données techniques | Identifiant utilisateur (UUID), horodatage des modifications | Automatique |
| Données de diagnostic | Rapports de plantage anonymisés | Automatique (sans données financières) |

**Données sensibles :** Oui — données relatives à la situation économique et financière.

---

### IV. Catégories de personnes concernées

- Personnes physiques majeures résidant principalement au Maroc.
- Utilisateurs ayant créé un compte sur l'application PatriMoi.
- Aucune donnée relative à des mineurs n'est collectée.

---

### V. Destinataires des données

| Destinataire | Rôle | Localisation | Garanties |
|--------------|------|--------------|-----------|
| **Supabase Inc.** | Hébergeur base de données et service d'authentification | Union Européenne (Frankfurt, Allemagne) | Clauses contractuelles types UE (RGPD art. 46) + Data Processing Agreement signé |
| **Sentry (Functional Software Inc.)** | Collecte de rapports de plantage | États-Unis | Standard Contractual Clauses (SCCs) ; données anonymisées avant envoi |
| **Personnel autorisé PatriMoi** | Maintenance technique, support | Maroc | Accord de confidentialité interne |

**Aucune donnée n'est vendue, cédée ou communiquée à des tiers à des fins commerciales.**

---

### VI. Transferts hors du Maroc

**Oui** — les données sont transférées vers l'Union Européenne (Supabase, serveurs en Allemagne) et vers les États-Unis (Sentry, rapports de plantage uniquement).

**Garanties apportées :**
- Supabase : Data Processing Agreement conforme au RGPD, clauses contractuelles types approuvées par la Commission Européenne. L'UE offre un niveau de protection adéquat.
- Sentry : SCCs ; les données envoyées à Sentry ne contiennent aucune donnée financière de l'utilisateur (uniquement stack traces et métadonnées techniques).

---

### VII. Mesures de sécurité

| Mesure | Détail |
|--------|--------|
| Chiffrement local | AES-128 via MMKV, clé protégée par le Keychain iOS (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) |
| Chiffrement en transit | TLS 1.2+ pour toutes les communications réseau |
| Chiffrement au repos (serveur) | Chiffrement au niveau du disque (Supabase / AWS RDS) |
| Contrôle d'accès | Row Level Security PostgreSQL — chaque utilisateur n'accède qu'à ses propres données |
| Authentification | Email + mot de passe hashé (Supabase Auth / bcrypt) |
| PIN local | SHA-256 + sel aléatoire, stocké dans Keychain iOS (jamais en clair) |
| Isolation des accès admin | Vue `stats_admin` sans données personnelles, restreinte au rôle `service_role` |

---

### VIII. Durée de conservation

| Données | Durée |
|---------|-------|
| Compte et données patrimoine | Durée de vie du compte + 30 jours après suppression |
| Snapshots historique | Durée de vie du compte |
| Rapports de plantage (Sentry) | 90 jours (politique Sentry) |
| Logs techniques | 30 jours |

---

### IX. Droits des personnes concernées

Les utilisateurs peuvent exercer leurs droits (accès, rectification, opposition, suppression) :
- Via l'application : **Paramètres → Supprimer mon compte** (suppression complète et immédiate).
- Par e-mail : privacy@patrimoi.ma (réponse sous 30 jours).

---

### X. Sous-traitants

| Sous-traitant | Objet | Contrat DPA |
|---------------|-------|-------------|
| Supabase Inc. | Hébergement données et auth | Signé — [lien DPA Supabase](https://supabase.com/legal/dpa) |
| Functional Software Inc. (Sentry) | Rapports de plantage | Signé — [lien DPA Sentry](https://sentry.io/legal/dpa/) |

---

## Actions avant dépôt

- [ ] Compléter les champs `<!-- ... -->` avec les informations légales exactes
- [ ] Obtenir et conserver les DPA signés avec Supabase et Sentry
- [ ] Créer l'adresse e-mail `privacy@patrimoi.ma` et `support@patrimoi.ma`
- [ ] Vérifier si une inscription au registre du commerce est nécessaire avant dépôt CNDP
- [ ] Télécharger et remplir le formulaire officiel CNDP sur [cndp.ma/formulaires](https://www.cndp.ma)
- [ ] Joindre : statuts de la société, copie CNI du représentant légal, description technique de l'architecture
- [ ] Anticiper un délai de 2 à 3 mois pour l'obtention de l'autorisation

---

## Référence légale

- **Loi n° 09-08** du 18 février 2009 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel
- **Décret n° 2-09-165** du 25 juin 2009 pris pour l'application de la loi 09-08
- Art. 23 (données sensibles — situation économique et financière)
- Art. 43-44 (transferts hors Maroc)
- Art. 3 (définition du responsable du traitement)
