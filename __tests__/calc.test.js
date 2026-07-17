/**
 * PatriMoi — Tests Jest (Phase 0)
 * Portage des 14 TNR de la section 9.1 du DAT v1.5
 * Exécution : cd ~/PatriMoiApp && npx jest
 */

import {
  calcLiquide,
  calcBanque,
  calcCarnet,
  calcPEA,
  calcPEACout,
  calcCT,
  calcCTCout,
  calcOr,
  calcImmo,
  calcTransport,
  totalPatrimoine,
  totalCout,
} from '../src/utils/calc';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const DATA = {
  liquidites: {
    dh: 10000,
    devises: [
      { quantite: 100, taux: 11 }, // 100 EUR × 11 = 1100
    ],
  },
  banque: [
    { solde: 20000 },
    { solde: 5000 },
  ],
  carnet: [
    { solde: 8000 },
  ],
  pea: [
    { ticker: 'ATW', cours: 500, qty: 10, pru: 400, dateAchat: null },
    { ticker: 'IAM', cours: 120, qty: 20, pru: 130, dateAchat: null },
  ],
  ct: {
    actions: [
      { ticker: 'BCP', cours: 300, qty: 5, pru: 280 },
    ],
    opcvm: [
      { vl: 200, parts: 10, vl_achat: 190 },
    ],
  },
  immobilier: [
    { meth: 'estimatif', prixM2: 10000, surface: 80, prixOffert: null, prixAchat: 700000 },
    { meth: 'offre', prixM2: 8000, surface: 60, prixOffert: 500000, prixAchat: 450000 },
  ],
  transport: [
    { meth: 'estimatif', valEstim: 120000, prixOffert: null, prixAchat: 150000 },
  ],
  or: [
    { quantite: 50, prixOffert: 0, prixAchat: 30000 },
  ],
  prixOr: 700, // 700 DH/g
};

// ── Tests ─────────────────────────────────────────────────────────────────────

// TNR-01
test('calcLiquide — cash + devises', () => {
  expect(calcLiquide(DATA.liquidites)).toBe(11100); // 10000 + 100×11
});

// TNR-02
test('calcBanque — somme des soldes', () => {
  expect(calcBanque(DATA.banque)).toBe(25000);
});

// TNR-03
test('calcCarnet — somme des carnets', () => {
  expect(calcCarnet(DATA.carnet)).toBe(8000);
});

// TNR-04
test('calcPEA — valeur de marché', () => {
  // ATW: 500×10=5000, IAM: 120×20=2400 → 7400
  expect(calcPEA(DATA.pea)).toBe(7400);
});

// TNR-05
test('calcPEACout — prix de revient', () => {
  // ATW: 400×10=4000, IAM: 130×20=2600 → 6600
  expect(calcPEACout(DATA.pea)).toBe(6600);
});

// TNR-06
test('calcCT — valeur CT (actions + opcvm)', () => {
  // BCP: 300×5=1500, OPCVM: 200×10=2000 → 3500
  expect(calcCT(DATA.ct)).toBe(3500);
});

// TNR-07
test('calcCTCout — coût CT', () => {
  // BCP: 280×5=1400, OPCVM: 190×10=1900 → 3300
  expect(calcCTCout(DATA.ct)).toBe(3300);
});

// TNR-08
test('calcImmo — méthode estimatif', () => {
  // 10000×80=800000
  const immoEstimatif = [{ meth: 'estimatif', prixM2: 10000, surface: 80, prixOffert: null }];
  expect(calcImmo(immoEstimatif)).toBe(800000);
});

// TNR-09
test('calcImmo — méthode offre', () => {
  // prixOffert=500000
  const immoOffre = [{ meth: 'offre', prixM2: 8000, surface: 60, prixOffert: 500000 }];
  expect(calcImmo(immoOffre)).toBe(500000);
});

// TNR-10
test('calcOr — quantite × prixOr', () => {
  // 50 × 700 = 35000, prixOffert=0 → max(35000, 0) = 35000
  expect(calcOr(DATA.or, DATA.prixOr)).toBe(35000);
});

// TNR-11
test('calcOr — prixOffert supérieur', () => {
  const orAvecOffre = [{ quantite: 50, prixOffert: 40000, prixAchat: 30000 }];
  // max(50×700=35000, 40000) = 40000
  expect(calcOr(orAvecOffre, 700)).toBe(40000);
});

// TNR-12
test('totalPatrimoine — somme de tous les actifs', () => {
  const total = totalPatrimoine(DATA);
  // liquide:11100 + banque:25000 + carnet:8000 + pea:7400 + ct:3500
  // + immo:(800000+500000)=1300000 + transport:120000 + or:35000
  // = 11100+25000+8000+7400+3500+1300000+120000+35000 = 1510000
  expect(total).toBe(1510000);
});

// TNR-13
test('totalCout — somme des coûts investis', () => {
  const cout = totalCout(DATA);
  // peaCout:6600 + ctCout:3300 + immo:(700000+450000)=1150000 + transport:150000 + or:30000
  // = 6600+3300+1150000+150000+30000 = 1339900
  expect(cout).toBe(1339900);
});

// TNR-14
test('calcLiquide — sans devises', () => {
  const liqSansDevises = { dh: 5000, devises: [] };
  expect(calcLiquide(liqSansDevises)).toBe(5000);
});
