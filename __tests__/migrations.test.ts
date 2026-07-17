/**
 * PatriMoi — Tests unitaires migrations.ts
 * Phase 5 DAT v2.0
 */

import { migrateData, CURRENT_SCHEMA_VERSION } from '../src/utils/migrations';
import type { PatrimoineData } from '../src/types';

const validV1: PatrimoineData = {
  schemaVersion: 1,
  liquidites: { dh: 5000, devises: [] },
  banque: [], carnet: [], pea: [],
  ct: { actions: [], opcvm: [] },
  immobilier: [], transport: [], or: [],
  prixOr: 0, lastUpdate: '2026-07-10',
};

describe('migrateData', () => {
  it('retourne les données inchangées si déjà à la version courante', () => {
    const result = migrateData(validV1);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.liquidites.dh).toBe(5000);
  });

  it('migre v0 → v1 : initialise tous les champs manquants', () => {
    const v0 = { liquidites: { dh: 1000, devises: [] }, prixOr: 600, lastUpdate: '2026-01-01' };
    const result = migrateData(v0);
    expect(result.schemaVersion).toBe(1);
    expect(result.banque).toEqual([]);
    expect(result.carnet).toEqual([]);
    expect(result.pea).toEqual([]);
    expect(result.ct).toEqual({ actions: [], opcvm: [] });
    expect(result.immobilier).toEqual([]);
    expect(result.transport).toEqual([]);
    expect(result.or).toEqual([]);
  });

  it('préserve les données existantes lors de la migration', () => {
    const v0 = {
      liquidites: { dh: 9999, devises: [{ code: 'EUR', nom: 'Euro', quantite: 100, taux: 10.8, variation: 0 }] },
      banque: [{ banque: 'CIH', solde: 5000, compte: 'courant' }],
      prixOr: 650, lastUpdate: '2026-07-01',
    };
    const result = migrateData(v0);
    expect(result.liquidites.dh).toBe(9999);
    expect(result.liquidites.devises).toHaveLength(1);
    expect(result.banque).toHaveLength(1);
  });

  it('retourne les données brutes si null/undefined', () => {
    expect(migrateData(null)).toBeNull();
    expect(migrateData(undefined)).toBeUndefined();
  });

  it('retourne les données brutes si ce n\'est pas un objet', () => {
    expect(migrateData('string')).toBe('string');
    expect(migrateData(42)).toBe(42);
  });

  it('ne modifie pas un objet déjà à jour', () => {
    const data = { ...validV1, liquidites: { dh: 7777, devises: [] } };
    const result = migrateData(data);
    expect(result.liquidites.dh).toBe(7777);
  });
});
