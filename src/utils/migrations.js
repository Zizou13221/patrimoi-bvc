/**
 * PatriMoi — Versioning du schéma de données (Phase 3 DAT v1.6)
 *
 * Chaque entrée du tableau MIGRATIONS est une fonction pure :
 *   (data) => data'   (version n → version n+1)
 *
 * Au chargement, on applique automatiquement toutes les migrations
 * manquantes depuis la version actuelle jusqu'à CURRENT_SCHEMA_VERSION.
 *
 * Usage :
 *   import { migrateData, CURRENT_SCHEMA_VERSION } from './migrations';
 *   const migratedData = migrateData(rawData);
 */

export const CURRENT_SCHEMA_VERSION = 3;

// ── Liste ordonnée des migrations ─────────────────────────────────────────────
// migration[0] = passe de schemaVersion 0 (absent) → 1
const MIGRATIONS = [
  // v0 → v1 : ajout schemaVersion + normalisation des champs optionnels
  (data) => ({
    ...data,
    schemaVersion: 1,
    // S'assurer que les champs optionnels existent avec des valeurs par défaut
    liquidites: {
      dh:      data.liquidites?.dh ?? 0,
      devises: data.liquidites?.devises ?? [],
    },
    banque:      data.banque      ?? [],
    carnet:      data.carnet      ?? [],
    pea:         data.pea         ?? [],
    ct:          data.ct          ?? { actions: [], opcvm: [] },
    immobilier:  data.immobilier  ?? [],
    transport:   data.transport   ?? [],
    or:          data.or          ?? [],
    prixOr:      data.prixOr      ?? 0,
    lastUpdate:  data.lastUpdate  ?? '',
  }),

  // v1 → v2 : ajout des champs budget (opérations + cibles)
  (data) => ({
    ...data,
    schemaVersion: 2,
    operations:   data.operations   ?? [],
    budgetCibles: data.budgetCibles ?? {},
  }),

  // v2 → v3 : C1 versementsCumulesPEA, C2 dateOuverturePEA,
  //           C4 dettes, C3 cessions, C14 conseils_dismissed
  (data) => {
    // Estimation des versements cumulés PEA = somme des PRU × quantités
    // (approx fiable pour les comptes existants sans historique de versements)
    const estimVersements = (data.pea ?? []).reduce(
      (s, t) => s + (t.pru || 0) * (t.qty || 0), 0
    );
    return {
      ...data,
      schemaVersion: 3,
      // C1 — plafond PEA basé sur versements, pas la valorisation
      versementsCumulesPEA: data.versementsCumulesPEA ?? Math.round(estimVersements),
      // C2 — date d'ouverture du plan PEA (null = non renseignée)
      dateOuverturePEA: data.dateOuverturePEA ?? null,
      // C4 — Crédits & Dettes : [{ id, nom, type, preteur, montantInitial, soldeRestant, tauxAnnuel, mensualite, dateDebut }]
      dettes: data.dettes ?? [],
      // C3 — Cessions réalisées : [{ id, date, type, nom, montantCession, coutRevient, plRealise }]
      cessions: data.cessions ?? [],
      // C14 — Conseils ignorés par l'utilisateur : { [id]: true }
      conseils_dismissed: data.conseils_dismissed ?? {},
    };
  },
];

// ── Applique toutes les migrations manquantes ─────────────────────────────────
export function migrateData(data) {
  if (!data || typeof data !== 'object') return data;

  let current = { ...data };
  const fromVersion = current.schemaVersion ?? 0;

  if (fromVersion >= CURRENT_SCHEMA_VERSION) return current;

  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) {
      current = MIGRATIONS[v](current);
      if (__DEV__) {
        console.log(`[PatriMoi] Migration appliquée : v${v} → v${v + 1}`);
      }
    }
  }

  return current;
}
