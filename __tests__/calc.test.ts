/**
 * PatriMoi — Tests unitaires calc.ts
 * Phase 5 DAT v2.0
 */

import {
  calcLiquide,
  calcBanque,
  calcCarnet,
  calcPEA, calcPEACout,
  calcCT, calcCTCout,
  calcImmo, valImmo,
  calcTransport, valTransport,
  calcOr, valOr,
  totalPatrimoine, totalCout,
} from '../src/utils/calc';

import type { PatrimoineData } from '../src/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const liq = {
  dh: 10_000,
  devises: [
    { code: 'EUR', nom: 'Euro', quantite: 500, taux: 10.8, variation: 0 },
    { code: 'USD', nom: 'Dollar', quantite: 200, taux: 9.9, variation: 0 },
  ],
};

const banque = [
  { banque: 'CIH', solde: 5_000, compte: 'courant' },
  { banque: 'Attijari', solde: 3_000, compte: 'epargne' },
];

const carnet = [
  { banque: 'CIH', solde: 20_000, taux: 2.25 },
];

const pea = [
  { ticker: 'IAM', nom: 'Maroc Telecom', pru: 90, cours: 100, qty: 50 },
  { ticker: 'BCP', nom: 'BCP', pru: 280, cours: 260, qty: 10 },
];

const ct = {
  actions: [{ ticker: 'ATW', nom: 'Attijariwafa', pru: 480, cours: 500, qty: 5 }],
  opcvm:   [{ code: 'FCP1', nom: 'OPCVM Test', vl: 120, vl_achat: 110, parts: 100, type: 'actions' }],
};

const immobilier = [
  { id: 1, nom: 'Appart Casablanca', type: 'appartement', ville: 'Casablanca', surface: 80,
    unite: 'm²', prixAchat: 700_000, datAchat: '2020-01-01', prixM2: 10_000,
    prixOffert: null, meth: 'estimatif' as const },
  { id: 2, nom: 'Maison Marrakech', type: 'maison', ville: 'Marrakech', surface: 150,
    unite: 'm²', prixAchat: 1_200_000, datAchat: '2018-06-01', prixM2: 8_000,
    prixOffert: 1_350_000, meth: 'offert' as const },
];

const transport = [
  { id: 1, nom: 'Dacia Logan', type: 'voiture', annee: 2019, immat: '12345-A-1',
    prixAchat: 130_000, dateAchat: '2019-03-01', valEstim: 80_000, prixOffert: null, meth: 'estimatif' as const },
];

const or = [
  { id: 1, nom: 'Lingot 10g', quantite: 10, unite: 'g', prixAchat: 5_000, prixOffert: null },
];
const prixOr = 650; // DH/g

const fullData: PatrimoineData = {
  liquidites: liq, banque, carnet, pea, ct, immobilier, transport, or, prixOr,
  lastUpdate: '2026-07-10',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('calcLiquide', () => {
  it('additionne DH + devises converties', () => {
    // 10000 + 500*10.8 + 200*9.9 = 10000 + 5400 + 1980 = 17380
    expect(calcLiquide(liq)).toBeCloseTo(17_380);
  });
  it('retourne DH seul si aucune devise', () => {
    expect(calcLiquide({ dh: 5_000, devises: [] })).toBe(5_000);
  });
});

describe('calcBanque', () => {
  it('somme les soldes', () => expect(calcBanque(banque)).toBe(8_000));
  it('retourne 0 si vide', () => expect(calcBanque([])).toBe(0));
});

describe('calcCarnet', () => {
  it('somme les soldes carnet', () => expect(calcCarnet(carnet)).toBe(20_000));
});

describe('calcPEA / calcPEACout', () => {
  it('valorisation PEA au cours actuel', () => {
    // 100*50 + 260*10 = 5000 + 2600 = 7600
    expect(calcPEA(pea)).toBe(7_600);
  });
  it('coût PEA au PRU', () => {
    // 90*50 + 280*10 = 4500 + 2800 = 7300
    expect(calcPEACout(pea)).toBe(7_300);
  });
});

describe('calcCT / calcCTCout', () => {
  it('valorisation CT (actions + OPCVM)', () => {
    // 500*5 + 120*100 = 2500 + 12000 = 14500
    expect(calcCT(ct)).toBe(14_500);
  });
  it('coût CT (pru actions + vl_achat OPCVM)', () => {
    // 480*5 + 110*100 = 2400 + 11000 = 13400
    expect(calcCTCout(ct)).toBe(13_400);
  });
});

describe('valImmo / calcImmo', () => {
  it('méthode estimatif = prixM2 × surface', () => {
    expect(valImmo(immobilier[0])).toBe(800_000); // 10000 * 80
  });
  it('méthode offert = prixOffert', () => {
    expect(valImmo(immobilier[1])).toBe(1_350_000);
  });
  it('calcImmo somme les biens', () => {
    expect(calcImmo(immobilier)).toBe(800_000 + 1_350_000);
  });
});

describe('valTransport / calcTransport', () => {
  it('méthode estimatif = valEstim', () => {
    expect(valTransport(transport[0])).toBe(80_000);
  });
});

describe('valOr / calcOr', () => {
  it('valeur or = quantite × prix', () => {
    expect(valOr(or[0], prixOr)).toBe(6_500); // max(10*650, 0)
  });
  it('préfère prixOffert si supérieur', () => {
    const orOffert = { ...or[0], prixOffert: 8_000 };
    expect(valOr(orOffert, prixOr)).toBe(8_000);
  });
});

describe('totalPatrimoine', () => {
  it('somme tous les actifs', () => {
    const total = totalPatrimoine(fullData);
    const expected = calcLiquide(liq) + calcBanque(banque) + calcCarnet(carnet)
      + calcPEA(pea) + calcCT(ct) + calcImmo(immobilier)
      + calcTransport(transport) + calcOr(or, prixOr);
    expect(total).toBeCloseTo(expected);
  });
});

describe('totalCout', () => {
  it('somme les coûts d'acquisition', () => {
    const cout = totalCout(fullData);
    // PEA: 7300 + CT: 13400 + immo: 700000+1200000 + transport: 130000 + or: 5000
    expect(cout).toBe(7_300 + 13_400 + 700_000 + 1_200_000 + 130_000 + 5_000);
  });
});
