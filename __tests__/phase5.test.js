/**
 * PatriMoi — Tests Phase 5 DAT v1.6
 * - Migration schemaVersion
 * - mergeHistory + upsertSnapshot
 * - Cas limites calcul
 */

import { migrateData, CURRENT_SCHEMA_VERSION } from '../src/utils/migrations';
import { mergeHistory, upsertSnapshot } from '../src/utils/history';
import {
  calcLiquide, calcBanque, calcCarnet, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcTransport, totalPatrimoine, totalCout,
} from '../src/utils/calc';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_DATA = {
  liquidites: { dh: 1000, devises: [] },
  banque: [], carnet: [], pea: [], ct: { actions: [], opcvm: [] },
  immobilier: [], transport: [], or: [], prixOr: 0,
};

// ── Migration ─────────────────────────────────────────────────────────────────

// MIG-01
test('migrateData — ajoute schemaVersion:1 si absent', () => {
  const result = migrateData({ ...BASE_DATA });
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
});

// MIG-02
test('migrateData — ne modifie pas les données si déjà à la version courante', () => {
  const data = { ...BASE_DATA, schemaVersion: CURRENT_SCHEMA_VERSION, banque: [{ solde: 42 }] };
  const result = migrateData(data);
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.banque).toEqual([{ solde: 42 }]); // données préservées
});

// MIG-03
test('migrateData — normalise les champs manquants', () => {
  const partial = { liquidites: { dh: 500 } }; // pas de devises
  const result = migrateData(partial);
  expect(result.liquidites.devises).toEqual([]);
  expect(result.banque).toEqual([]);
  expect(result.prixOr).toBe(0);
});

// MIG-04
test('migrateData — préserve les valeurs existantes', () => {
  const data = { ...BASE_DATA, banque: [{ solde: 9999 }] };
  const result = migrateData(data);
  expect(result.banque).toEqual([{ solde: 9999 }]);
});

// MIG-05
test('migrateData — retourne null si appelé avec null', () => {
  expect(migrateData(null)).toBe(null);
});

// ── mergeHistory ──────────────────────────────────────────────────────────────

// HIST-01
test('mergeHistory — fusionne sans doublon', () => {
  const local  = [{ date: '2024-01-01', val: 100 }, { date: '2024-01-02', val: 200 }];
  const remote = [{ date: '2024-01-03', val: 300 }];
  const merged = mergeHistory(local, remote);
  expect(merged).toHaveLength(3);
  expect(merged[2].date).toBe('2024-01-03');
});

// HIST-02
test('mergeHistory — remote écrase local sur même date', () => {
  const local  = [{ date: '2024-01-01', val: 100 }];
  const remote = [{ date: '2024-01-01', val: 999 }];
  const merged = mergeHistory(local, remote);
  expect(merged).toHaveLength(1);
  expect(merged[0].val).toBe(999); // remote prioritaire
});

// HIST-03
test('mergeHistory — trié par date ASC', () => {
  const local  = [{ date: '2024-03-01', val: 300 }];
  const remote = [{ date: '2024-01-01', val: 100 }, { date: '2024-02-01', val: 200 }];
  const merged = mergeHistory(local, remote);
  expect(merged.map(h => h.date)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
});

// HIST-04
test('mergeHistory — respecte maxEntries', () => {
  const local  = Array.from({ length: 5 }, (_, i) => ({ date: `2024-01-0${i+1}`, val: i }));
  const remote = [];
  const merged = mergeHistory(local, remote, 3);
  expect(merged).toHaveLength(3);
  expect(merged[0].date).toBe('2024-01-03'); // les 3 plus récents
});

// HIST-05
test('mergeHistory — tableaux vides', () => {
  expect(mergeHistory([], [])).toEqual([]);
});

// ── upsertSnapshot ────────────────────────────────────────────────────────────

// SNAP-01
test('upsertSnapshot — ajoute un nouveau snapshot', () => {
  const hist = [{ date: '2024-01-01', val: 100 }];
  const next = upsertSnapshot(hist, '2024-01-02', 200);
  expect(next).toHaveLength(2);
  expect(next[1]).toEqual({ date: '2024-01-02', val: 200 });
});

// SNAP-02
test('upsertSnapshot — met à jour une date existante', () => {
  const hist = [{ date: '2024-01-01', val: 100 }];
  const next = upsertSnapshot(hist, '2024-01-01', 999);
  expect(next).toHaveLength(1);
  expect(next[0].val).toBe(999);
});

// ── Cas limites calcul ────────────────────────────────────────────────────────

// CALC-01
test('calcLiquide — devises nulles ignorées', () => {
  const liq = { dh: 1000, devises: [{ quantite: null, taux: 10 }] };
  // null * 10 = 0
  expect(calcLiquide(liq)).toBe(1000);
});

// CALC-02
test('calcPEA — liste vide retourne 0', () => {
  expect(calcPEA([])).toBe(0);
  expect(calcPEACout([])).toBe(0);
});

// CALC-03
test('calcCT — ct vide retourne 0', () => {
  expect(calcCT({ actions: [], opcvm: [] })).toBe(0);
  expect(calcCTCout({ actions: [], opcvm: [] })).toBe(0);
});

// CALC-04
test('calcOr — quantite 0 retourne 0', () => {
  expect(calcOr([{ quantite: 0, prixOffert: 0 }], 700)).toBe(0);
});

// CALC-05
test('totalPatrimoine — patrimoine vide retourne 0', () => {
  const empty = {
    liquidites: { dh: 0, devises: [] },
    banque: [], carnet: [], pea: [], ct: { actions: [], opcvm: [] },
    immobilier: [], transport: [], or: [], prixOr: 0,
  };
  expect(totalPatrimoine(empty)).toBe(0);
});

// CALC-06
test('calcTransport — méthode estimatif vs offre', () => {
  const estim = [{ meth: 'estimatif', valEstim: 50000, prixOffert: null }];
  const offre = [{ meth: 'offre', valEstim: 50000, prixOffert: 60000 }];
  expect(calcTransport(estim)).toBe(50000);
  expect(calcTransport(offre)).toBe(60000);
});
