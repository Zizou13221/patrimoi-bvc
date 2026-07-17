/**
 * PatriMoi — Migrations schéma typées (Phase 3 DAT v2.0)
 * Remplace migrations.js.
 */

import type { PatrimoineData } from '../types';

export const CURRENT_SCHEMA_VERSION = 1;

type MigrationFn = (data: Partial<PatrimoineData>) => PatrimoineData;

const MIGRATIONS: MigrationFn[] = [
  // v0 → v1 : ajout schemaVersion + normalisation champs optionnels
  (data) => ({
    schemaVersion: 1,
    liquidites: {
      dh:      data.liquidites?.dh      ?? 0,
      devises: data.liquidites?.devises ?? [],
    },
    banque:     data.banque     ?? [],
    carnet:     data.carnet     ?? [],
    pea:        data.pea        ?? [],
    ct:         data.ct         ?? { actions: [], opcvm: [] },
    immobilier: data.immobilier ?? [],
    transport:  data.transport  ?? [],
    or:         data.or         ?? [],
    prixOr:     data.prixOr     ?? 0,
    lastUpdate: data.lastUpdate ?? '',
  }),
];

export function migrateData(data: unknown): PatrimoineData {
  if (!data || typeof data !== 'object') return data as PatrimoineData;

  let current = { ...(data as Partial<PatrimoineData>) };
  const fromVersion = current.schemaVersion ?? 0;

  if (fromVersion >= CURRENT_SCHEMA_VERSION) return current as PatrimoineData;

  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) {
      current = MIGRATIONS[v](current);
      if (__DEV__) console.log(`[PatriMoi] Migration v${v} → v${v + 1}`);
    }
  }

  return current as PatrimoineData;
}
