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

export const CURRENT_SCHEMA_VERSION = 1;

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
