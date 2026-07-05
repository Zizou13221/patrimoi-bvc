/**
 * PatriMoi — React Native (iOS / Android)
 * Compatible Xcode  |  Version 1.2
 *
 * v1.1 — Persistance AsyncStorage, cours or temps réel, widget accueil,
 *         conseils personnalisés, bilan dashboard
 *
 * v1.2 — Cours BVC temps réel :
 *  - fetchBVC() : fetch JSON statique publié par GitHub Actions 2x/jour
 *  - applyBVCCours() : applique les cours frais sur PEA + Compte-Titre
 *  - Bouton "↻ BVC" sur le Dashboard avec indicateur ✓ / ⚠
 *  - Fallback silencieux : cours précédents conservés si fetch échoue
 *  - Script bvc_batch/bvc_batch.py + .github/workflows/bvc.yml inclus
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@patrimoi_data_v1';

// =========================================================
// PALETTE
// =========================================================
const C = {
  pri:   '#1A6B3A', priL: '#E8F5EE', priD: '#0F4B26',
  sec:   '#C8102E',
  acc:   '#F5A623', accL: '#FEF7DC',
  navy:  '#1E3C82', navyL:'#E1E8FA',
  teal:  '#008080', tealL:'#E0F4F4',
  gold:  '#B88E30', goldL:'#FFF8DC', goldD:'#785A14',
  gpos:  '#27AE60', rneg: '#E74C3C',
  g1:    '#F1F3F5', g2:   '#CED4DA', g3:   '#868E96',
  dark:  '#1C2833', bg:   '#F8FAFA', white:'#FFFFFF',
};

const { width: SCREEN_W } = Dimensions.get('window');
const APP_W = Math.min(440, SCREEN_W);

// =========================================================
// PROVERBES (10 / 366 — rotation par jour de l'annee)
// =========================================================
const PROVERBES = [
  { q:"L'argent est un bon serviteur mais un mauvais maitre.", a:"Francis Bacon", d:"Philosophe (1561-1626)", comment:"Laissez votre patrimoine travailler pour vous !" },
  { q:"Ne remettez pas a demain ce que vous pouvez investir aujourd'hui.", a:"Benjamin Franklin", d:"Fondateur et economiste (1706-1790)", comment:"Chaque jour sans investir, c'est un interet compose de perdu." },
  { q:"Le risque vient de ne pas savoir ce que vous faites.", a:"Warren Buffett", d:"Investisseur milliardaire (1930-)", comment:"Connaissez vos actifs. PatriMoi vous aide a y voir clair." },
  { q:"Achetez quand tout le monde vend, vendez quand tout le monde achete.", a:"Bernard Baruch", d:"Financier et conseiller (1870-1965)", comment:"La BVC aussi a ses moments de panique. Restez calme !" },
  { q:"Un investissement dans la connaissance rapporte le meilleur interet.", a:"Benjamin Franklin", d:"Fondateur et economiste (1706-1790)", comment:"Lisez, apprenez, et votre portefeuille vous remerciera." },
  { q:"La richesse, c'est savoir faire durer son argent.", a:"Proverbe marocain", d:"Sagesse populaire", comment:"Le dirham qui dort, c'est le dirham qui maigrit." },
  { q:"Le meilleur moment pour planter un arbre etait il y a 20 ans. Le second meilleur, c'est maintenant.", a:"Proverbe chinois", d:"Sagesse populaire", comment:"Commencez votre PEA aujourd'hui. Dans 5 ans, exoneration totale !" },
  { q:"Diversifiez vos investissements comme vous diversifiez vos repas.", a:"Peter Lynch", d:"Gestionnaire de fonds (1944-)", comment:"8 categories dans PatriMoi — exactement pour ca." },
  { q:"Ce n'est pas combien vous gagnez qui compte, c'est combien vous gardez.", a:"Robert Kiyosaki", d:"Auteur et entrepreneur (1947-)", comment:"Suivez chaque dirham. PatriMoi est la pour vous." },
  { q:"Epargner sans investir, c'est courir sur place.", a:"Anonyme", d:"Sagesse financiere", comment:"Faites travailler vos economies avec le Compte PEA." },
];

// =========================================================
// DONNEES INITIALES
// =========================================================
const INIT = {
  liquidites: {
    dh: 7500,
    devises: [
      { code:'USD', nom:'Dollar US',      quantite:1500, taux:10.22, variation:+0.12 },
      { code:'EUR', nom:'Euro',            quantite:1000, taux:10.81, variation:+0.05 },
      { code:'GBP', nom:'Livre Sterling',  quantite:200,  taux:12.65, variation:+0.21 },
      { code:'SAR', nom:'Riyal Saoudien',  quantite:1000, taux:2.72,  variation:-0.03 },
    ],
  },
  banque: [
    { banque:'CIH Bank',         solde:130000, compte:'Compte courant' },
    { banque:'Attijariwafa Bank', solde:85000,  compte:'Compte courant' },
  ],
  carnet: [
    { banque:'CIH Bank',        solde:30000, taux:3.0, rappel:{ montant:500,  freq:'Mensuel',     prochaine:'01/02/2025' } },
    { banque:'Banque Populaire', solde:15000, taux:2.5, rappel:{ montant:1000, freq:'Trimestriel', prochaine:'01/04/2025' } },
  ],
  pea: [
    { ticker:'ATW', nom:'Attijariwafa Bank',    pru:124.50, cours:128.20, qty:80  },
    { ticker:'BCP', nom:'Banque Centrale Pop.', pru:290.00, cours:312.50, qty:100 },
    { ticker:'ATL', nom:'Attijari Leasing',     pru:156.00, cours:162.40, qty:60  },
    { ticker:'IAM', nom:'Maroc Telecom',        pru:140.00, cours:136.80, qty:60  },
    { ticker:'CIH', nom:'CIH Bank',            pru:320.00, cours:345.00, qty:45  },
  ],
  ct: {
    actions: [
      { ticker:'MNG', nom:'Managem',        pru:265.00,  cours:290.00,  qty:20 },
      { ticker:'WAA', nom:'Wafa Assurance', pru:3800.00, cours:4100.00, qty:5  },
      { ticker:'HPS', nom:'HPS',            pru:5200.00, cours:4950.00, qty:3  },
    ],
    opcvm: [
      { code:'OPC1', nom:'BMCE Cap. Actions',   vl:1230, parts:5,  type:'Actions'     },
      { code:'OPC2', nom:'CDG Oblig. Court T.', vl:1050, parts:10, type:'Obligataire' },
      { code:'OPC3', nom:'Wafa Diversifie',     vl:2310, parts:3,  type:'Diversifie'  },
    ],
  },
  immobilier: [
    { id:1, nom:'Appartement Gueliz', type:'Bien bati', ville:'Marrakech',  surface:85,   unite:'m2', prixAchat:500000, datAchat:'2018', prixM2:8000, prixOffert:720000, meth:'offert'    },
    { id:2, nom:'Terrain Benslimane', type:'Terrain',   ville:'Benslimane', surface:2000, unite:'m2', prixAchat:230000, datAchat:'2020', prixM2:130,  prixOffert:null,   meth:'estimatif' },
  ],
  transport: [
    { id:1, nom:'Dacia Logan', type:'Voiture', annee:2019, immat:'A-123-456', prixAchat:120000, dateAchat:'2020', valEstim:92000, prixOffert:95000, meth:'offert' },
  ],
  or: [
    { id:1, nom:'Lingot 250g', quantite:250, unite:'g', prixAchat:185000, prixOffert:null },
    { id:2, nom:'Pieces 21K',  quantite:125, unite:'g', prixAchat:90000,  prixOffert:null },
  ],
  prixOr:     905,
  lastUpdate: '20/03/2025 09:30',
};

// =========================================================
// FONCTIONS DE CALCUL
// =========================================================
const calcLiquide   = (liq) => liq.dh + liq.devises.reduce((s,d) => s + d.quantite * d.taux, 0);
const calcBanque    = (arr) => arr.reduce((s,b) => s + b.solde, 0);
const calcCarnet    = (arr) => arr.reduce((s,c) => s + c.solde, 0);
const calcPEA       = (arr) => arr.reduce((s,t) => s + t.cours * t.qty, 0);
const calcPEACout   = (arr) => arr.reduce((s,t) => s + t.pru   * t.qty, 0);
const calcCT        = (ct)  => ct.actions.reduce((s,t) => s + t.cours * t.qty, 0) + ct.opcvm.reduce((s,o) => s + o.vl * o.parts, 0);
const calcCTCout    = (ct)  => ct.actions.reduce((s,t) => s + t.pru   * t.qty, 0) + ct.opcvm.reduce((s,o) => s + o.vl * o.parts * 0.95, 0);
const valImmo       = (b)   => b.meth === 'estimatif' ? b.prixM2 * b.surface : (b.prixOffert || b.prixM2 * b.surface);
const calcImmo      = (arr) => arr.reduce((s,b) => s + valImmo(b), 0);
const valTransport  = (t)   => t.meth === 'estimatif' ? t.valEstim : (t.prixOffert || t.valEstim);
const calcTransport = (arr) => arr.reduce((s,t) => s + valTransport(t), 0);
const valOr         = (o,px)=> Math.max(o.quantite * px, o.prixOffert || 0);
const calcOr        = (arr,px) => arr.reduce((s,o) => s + valOr(o,px), 0);

const totalPatrimoine = (d) =>
  calcLiquide(d.liquidites) + calcBanque(d.banque) + calcCarnet(d.carnet) +
  calcPEA(d.pea) + calcCT(d.ct) + calcImmo(d.immobilier) +
  calcTransport(d.transport) + calcOr(d.or, d.prixOr);

// =========================================================
// TNR — 25 tests unitaires (console uniquement)
// =========================================================
(function runTNR() {
  let ok = 0, ko = 0;
  const run = (name, fn, expected) => {
    try {
      const r = fn();
      if (JSON.stringify(r) === JSON.stringify(expected)) { ok++; }
      else { ko++; console.error('[TNR FAIL] ' + name + ': recu=' + JSON.stringify(r) + ', attendu=' + JSON.stringify(expected)); }
    } catch(e) { ko++; console.error('[TNR CRASH] ' + name + ': ' + e.message); }
  };
  run('calcLiquide vide',           () => calcLiquide({ dh:0, devises:[] }),                                          0);
  run('calcLiquide DH only',        () => calcLiquide({ dh:5000, devises:[] }),                                       5000);
  run('calcLiquide avec devise',    () => calcLiquide({ dh:1000, devises:[{quantite:100,taux:10,code:'USD',nom:'',variation:0}] }), 2000);
  run('calcBanque vide',            () => calcBanque([]),                                                              0);
  run('calcBanque 2 comptes',       () => calcBanque([{solde:100},{solde:200}]),                                       300);
  run('calcCarnet',                 () => calcCarnet([{solde:30000,taux:3},{solde:15000,taux:2.5}]),                   45000);
  run('calcPEA',                    () => calcPEA([{cours:120,qty:10},{cours:200,qty:5}]),                             2200);
  run('calcPEACout',                () => calcPEACout([{pru:100,qty:10}]),                                             1000);
  run('calcCT actions+opcvm',       () => calcCT({actions:[{cours:200,qty:5}],opcvm:[{vl:100,parts:3}]}),              1300);
  run('calcCTCout',                 () => calcCTCout({actions:[{pru:100,qty:10}],opcvm:[{vl:100,parts:5}]}),          Math.round(100*10 + 100*5*0.95));
  run('valImmo estimatif',          () => valImmo({meth:'estimatif',prixM2:8000,surface:85,prixOffert:null}),          680000);
  run('valImmo offert > estim',     () => valImmo({meth:'offert',prixM2:8000,surface:85,prixOffert:720000}),           720000);
  run('valImmo offert null estim',  () => valImmo({meth:'offert',prixM2:8000,surface:85,prixOffert:null}),             680000);
  run('valTransport estimatif',     () => valTransport({meth:'estimatif',valEstim:92000,prixOffert:95000}),            92000);
  run('valTransport offert',        () => valTransport({meth:'offert',valEstim:92000,prixOffert:95000}),               95000);
  run('valOr sans offert',          () => valOr({quantite:250,prixOffert:null},905),                                   226250);
  run('valOr avec offert > estim',  () => valOr({quantite:100,prixOffert:100000},905),                                100000);
  run('valOr sans offert 0',        () => valOr({quantite:100,prixOffert:0},905),                                      90500);
  run('calcImmo 2 biens',           () => calcImmo([{meth:'estimatif',prixM2:8000,surface:85,prixOffert:null},{meth:'offert',prixM2:100,surface:2000,prixOffert:260000}]), 940000);
  run('calcTransport offert',       () => calcTransport([{meth:'offert',valEstim:92000,prixOffert:95000}]),             95000);
  run('calcOr 2 stocks',            () => calcOr([{quantite:250,prixOffert:null},{quantite:125,prixOffert:null}],905), Math.round((250+125)*905));
  run('totalPatrimoine > 1.8M',     () => totalPatrimoine(INIT) > 1800000,                                             true);
  run('totalPatrimoine > 0',        () => totalPatrimoine(INIT) > 0,                                                   true);
  run('pctDiff gain',               () => Math.round(((110-100)/100)*100),                                             10);
  run('pctDiff perte',              () => Math.round(((90-100)/100)*100),                                              -10);
  console.log('[PatriMoi TNR] ' + ok + '/' + (ok+ko) + ' tests ' + (ko===0 ? 'OK' : '— ' + ko + ' ECHEC(S)'));
})();

// =========================================================
// HELPERS
// =========================================================
const fmt     = (n) => Math.round(n).toLocaleString('fr-FR') + ' DH';
const fmtN    = (n) => Math.round(n).toLocaleString('fr-FR');
const pctDiff = (v, base) => base === 0 ? 0 : (v - base) / base * 100;
const fmtDate = () => new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

// =========================================================
// API COURS OR EN TEMPS RÉEL
// Prix or via metals.live (USD/troy oz) + taux USD/MAD via er-api
// Fallback silencieux : conserve le dernier prix connu
// =========================================================
async function fetchPrixOr() {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot/gold', { signal: AbortSignal.timeout(6000) }),
      fetch('https://open.er-api.com/v6/latest/USD',  { signal: AbortSignal.timeout(6000) }),
    ]);
    if (!goldRes.ok || !fxRes.ok) return null;
    const goldData = await goldRes.json();  // [{ gold: 3320.28 }]
    const fxData   = await fxRes.json();    // { rates: { MAD: 10.08, ... } }
    const goldUSD  = Array.isArray(goldData) ? goldData[0]?.gold : goldData?.gold;
    const usdMad   = fxData?.rates?.MAD;
    if (!goldUSD || !usdMad) return null;
    // 1 troy once = 31.1035 g → prix par gramme en DH
    return Math.round((goldUSD / 31.1035) * usdMad);
  } catch {
    return null; // timeout ou réseau indisponible → fallback
  }
}

// =========================================================
// API COURS BVC — GitHub Actions batch (2x/jour)
// Fetch un JSON statique publié automatiquement sur GitHub.
// Remplacez BVC_COURS_URL par l'URL raw de VOTRE repo.
// =========================================================
const BVC_COURS_URL =
  'https://raw.githubusercontent.com/TON_USER/TON_REPO/main/bvc_cours.json';

async function fetchBVC() {
  try {
    const res = await fetch(BVC_COURS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.cours || typeof json.cours !== 'object') return null;
    return json; // { updated, cours: { ATW: { cours, date, ... }, ... } }
  } catch {
    return null;
  }
}

/**
 * Applique les cours BVC frais sur les tableaux pea et ct.actions.
 * Les tickers non trouvés dans le JSON gardent leur cours actuel.
 */
function applyBVCCours(data, bvcData) {
  if (!bvcData?.cours) return data;
  const c = bvcData.cours;

  const pea = data.pea.map(t =>
    c[t.ticker] ? { ...t, cours: c[t.ticker].cours } : t
  );
  const ctActions = data.ct.actions.map(t =>
    c[t.ticker] ? { ...t, cours: c[t.ticker].cours } : t
  );

  return {
    ...data,
    pea,
    ct: { ...data.ct, actions: ctActions },
    bvcUpdated: bvcData.updated ?? null,
  };
}

// =========================================================
// CONSEILS PERSONNALISÉS (générés depuis le vrai portfolio)
// =========================================================
function generateConseils(data) {
  const total   = totalPatrimoine(data);
  if (total === 0) return [];
  const conseils = [];

  const liqTotal  = calcLiquide(data.liquidites) + calcBanque(data.banque);
  const liqRatio  = liqTotal / total;
  const peaVal    = calcPEA(data.pea);
  const peaCout   = calcPEACout(data.pea);
  const ctVal     = calcCT(data.ct);
  const orVal     = calcOr(data.or, data.prixOr);
  const orRatio   = orVal / total;
  const immoVal   = calcImmo(data.immobilier);
  const immoRatio = immoVal / total;
  const PEA_PLAFOND = 600000;

  // 1. Trop de liquidités
  if (liqRatio > 0.25) {
    conseils.push({
      id: 'liq', priority: 1, couleur: C.rneg, icon: '⚠',
      titre: 'Liquidités élevées',
      corps: `Vos liquidités représentent ${Math.round(liqRatio * 100)}% de votre patrimoine (${fmt(liqTotal)}). La règle : 3 mois de dépenses en réserve, le reste investi. Pensez à alimenter votre PEA.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 2. PEA pas au plafond
  if (peaVal < PEA_PLAFOND) {
    const reste = PEA_PLAFOND - peaVal;
    const plPct = peaCout > 0 ? pctDiff(peaVal, peaCout) : null;
    conseils.push({
      id: 'pea', priority: 2, couleur: C.pri, icon: '★',
      titre: `PEA : ${fmt(reste)} d'espace restant`,
      corps: `Votre PEA est à ${fmt(peaVal)} sur ${fmt(PEA_PLAFOND)} de plafond.${plPct !== null ? ` Performance actuelle : ${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%.` : ''} Chaque dirham investi ici sera exonéré d'impôt après 5 ans.`,
      action: 'Alimenter mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 3. Or < 5% → manque de valeur refuge
  if (orRatio < 0.05) {
    conseils.push({
      id: 'or', priority: 3, couleur: C.gold, icon: '◈',
      titre: 'Faible exposition à l\'or',
      corps: `L'or représente seulement ${Math.round(orRatio * 100)}% de votre patrimoine. Les experts recommandent 5 à 10% en valeur refuge, surtout face à l'inflation du dirham.`,
      action: 'Voir mon or', nav: 'actifs', sub: 'or',
    });
  }

  // 4. Immobilier > 70% → concentration risquée
  if (immoRatio > 0.70) {
    conseils.push({
      id: 'immo', priority: 2, couleur: '#B46428', icon: '!',
      titre: 'Patrimoine très concentré en immobilier',
      corps: `L'immobilier représente ${Math.round(immoRatio * 100)}% de votre patrimoine (${fmt(immoVal)}). Une concentration aussi forte réduit votre liquidité. Envisagez de diversifier vers des actifs financiers.`,
      action: 'Voir mon immobilier', nav: 'actifs', sub: 'immobilier',
    });
  }

  // 5. Compte-Titre P&L négatif
  const ctCout = calcCTCout(data.ct);
  if (ctVal < ctCout && ctCout > 0) {
    conseils.push({
      id: 'ct', priority: 2, couleur: C.rneg, icon: '↓',
      titre: 'Compte-Titre en moins-value',
      corps: `Votre Compte-Titre affiche une moins-value de ${fmt(ctCout - ctVal)} (${pctDiff(ctVal, ctCout).toFixed(1)}%). Pensez à arbitrer ou renforcer les lignes les plus solides.`,
      action: 'Voir mon Compte-Titre', nav: 'actifs', sub: 'ct',
    });
  }

  // 6. Pas de Compte sur Carnet
  if (calcCarnet(data.carnet) === 0) {
    conseils.push({
      id: 'carnet', priority: 3, couleur: C.teal, icon: '✦',
      titre: 'Ouvrez un Compte sur Carnet',
      corps: `Le Compte sur Carnet offre 2,5 à 3% par an, garanti et sans risque. Idéal pour votre épargne de précaution.`,
      action: 'Voir les carnets', nav: 'actifs', sub: 'carnet',
    });
  }

  return conseils.sort((a, b) => a.priority - b.priority);
}

// =========================================================
// STYLES PARTAGES
// =========================================================
const sh = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6 },
      android: { elevation: 3 },
    }),
  },
  row:    { flexDirection:'row', alignItems:'center' },
  center: { alignItems:'center', justifyContent:'center' },
  flex1:  { flex: 1 },
  bold:   { fontWeight:'700' },
  italic: { fontStyle:'italic' },
});

// =========================================================
// COMPOSANTS UI
// =========================================================

// -- Carte conteneur -----------------------------------------
const Card = ({ children, style, onPress }) => (
  <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={[sh.card, style]}>
    {children}
  </TouchableOpacity>
);

// -- Boutons -------------------------------------------------
const BtnPri = ({ children, onPress, style, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[{ backgroundColor: disabled ? C.g2 : C.pri, borderRadius:10, paddingVertical:13, alignItems:'center' }, style]}
    activeOpacity={0.8}
  >
    <Text style={{ color:C.white, fontWeight:'700', fontSize:14 }}>{children}</Text>
  </TouchableOpacity>
);

const BtnSec = ({ children, onPress, style }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[{ backgroundColor:C.priL, borderRadius:10, paddingVertical:11, alignItems:'center', borderWidth:1.5, borderColor:C.pri }, style]}
    activeOpacity={0.8}
  >
    <Text style={{ color:C.pri, fontWeight:'700', fontSize:13 }}>{children}</Text>
  </TouchableOpacity>
);

// -- Badge P&L -----------------------------------------------
const PLBadge = ({ value, base }) => {
  const diff = value - base;
  const p    = pctDiff(value, base);
  const pos  = diff >= 0;
  return (
    <View style={{ alignItems:'flex-end' }}>
      <Text style={{ color:pos?C.gpos:C.rneg, fontWeight:'700', fontSize:12 }}>
        {pos?'+':''}{fmtN(diff)} DH
      </Text>
      <Text style={{ color:pos?C.gpos:C.rneg, fontSize:11 }}>
        {pos?'▲':'▼'} {Math.abs(p).toFixed(1)}%
      </Text>
    </View>
  );
};

// -- Toggle iOS style ----------------------------------------
const Toggle = ({ on, onChange }) => (
  <TouchableOpacity
    onPress={() => onChange(!on)}
    style={{ width:46, height:26, borderRadius:13, backgroundColor:on?C.gpos:C.g2, justifyContent:'center' }}
    activeOpacity={0.9}
  >
    <View style={{
      width:20, height:20, borderRadius:10, backgroundColor:C.white,
      position:'absolute', left:on?23:3,
      ...Platform.select({
        ios:     { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.2, shadowRadius:2 },
        android: { elevation:2 },
      }),
    }}/>
  </TouchableOpacity>
);

// -- Icone carre arrondi -------------------------------------
const IconBox = ({ label, bg, size=34, fs=10 }) => (
  <View style={{ width:size, height:size, borderRadius:Math.round(size*0.35), backgroundColor:bg, alignItems:'center', justifyContent:'center' }}>
    <Text style={{ color:C.white, fontWeight:'700', fontSize:fs }}>{label}</Text>
  </View>
);

// -- Entete de section ---------------------------------------
const SectionLabel = ({ children }) => (
  <Text style={{ fontSize:11, fontWeight:'600', color:C.g3, marginTop:14, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
    {children}
  </Text>
);

const SectionTitle = ({ children, action, onAction }) => (
  <View style={[sh.row, { justifyContent:'space-between', marginTop:16, marginBottom:8 }]}>
    <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{children}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={{ color:C.pri, fontSize:12 }}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// -- Ligne info ----------------------------------------------
const InfoRow = ({ label, sub: subLabel, value }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingVertical:7, borderBottomWidth:1, borderBottomColor:C.g1 }}>
    <View>
      <Text style={{ fontSize:12, color:C.g3 }}>{label}</Text>
      {subLabel ? <Text style={{ fontSize:10, color:C.g2, marginTop:1 }}>{subLabel}</Text> : null}
    </View>
    <Text style={{ fontSize:13, fontWeight:'500', color:C.dark, textAlign:'right', marginLeft:8, flexShrink:1 }}>{value}</Text>
  </View>
);

// -- Selecteur methode estimatif / offert --------------------
const MethodSelector = ({ value, onChange }) => (
  <View style={{ flexDirection:'row', gap:6, marginTop:8 }}>
    {[['estimatif','Valeur estimative'],['offert','Prix offert']].map(([m, label]) => (
      <TouchableOpacity
        key={m}
        onPress={() => onChange(m)}
        style={{ flex:1, paddingVertical:7, borderRadius:7, alignItems:'center', backgroundColor: value===m?C.pri:C.g1 }}
        activeOpacity={0.8}
      >
        <Text style={{ fontWeight:'600', fontSize:11, color:value===m?C.white:C.g3 }}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// -- Champ de saisie textuelle -------------------------------
const Input = ({ label, value, onChangeText, placeholder, keyboardType, unit }) => (
  <View style={{ marginBottom:12 }}>
    {label ? <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:4 }}>{label}</Text> : null}
    <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:C.g1, borderRadius:8, paddingHorizontal:12, borderWidth:1, borderColor:C.g2 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.g3}
        keyboardType={keyboardType || 'default'}
        style={{ flex:1, paddingVertical:10, fontSize:13, color:C.dark }}
      />
      {unit ? <Text style={{ color:C.g3, fontSize:12 }}>{unit}</Text> : null}
    </View>
  </View>
);

// -- Picker modal (remplace <select>) ------------------------
const PickerModal = ({ visible, options, onSelect, onClose, title }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose}>
      <View style={{ position:'absolute', bottom:0, left:0, right:0, backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'60%' }}>
        <View style={{ padding:16, borderBottomWidth:1, borderBottomColor:C.g1, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', fontSize:15, color:C.dark }}>{title || 'Choisir'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color:C.pri, fontWeight:'700', fontSize:15 }}>Fermer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { onSelect(typeof opt === 'object' ? opt.value : opt); onClose(); }}
              style={{ paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.g1 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:14, color:C.dark }}>{typeof opt === 'object' ? opt.label : opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
);

// -- SelectInput (champ avec modal picker) -------------------
const SelectInput = ({ label, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const display = options.find(o => (o.value||o) === value);
  return (
    <View style={{ marginBottom:12 }}>
      {label ? <Text style={{ fontSize:12, fontWeight:'600', color:C.dark, marginBottom:4 }}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.g1, borderRadius:8, paddingHorizontal:12, paddingVertical:12, borderWidth:1, borderColor:C.g2 }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize:13, color:value ? C.dark : C.g3 }}>
          {display ? (display.label || display) : 'Selectionner...'}
        </Text>
        <Text style={{ color:C.g3, fontSize:16 }}>v</Text>
      </TouchableOpacity>
      <PickerModal
        visible={open}
        options={options}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        title={label}
      />
    </View>
  );
};

// -- Top bar (en-tete page) ----------------------------------
const TopBar = ({ title, subtitle, onBack }) => (
  <View style={{ backgroundColor:C.pri, paddingHorizontal:16, paddingTop: Platform.OS==='ios' ? 16 : 12, paddingBottom:12 }}>
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ paddingRight:10 }} activeOpacity={0.7}>
          <Text style={{ color:C.white, fontSize:24, lineHeight:28 }}>‹</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex:1, alignItems:onBack?'flex-start':'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>{title}</Text>
        {subtitle ? <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:1 }}>{subtitle}</Text> : null}
      </View>
    </View>
  </View>
);

// -- Sparkline (remplace AreaChart recharts) -----------------
const Sparkline = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', height:50, gap:2 }}>
      {data.map((v, i) => {
        const h = Math.max(((v - min) / range) * 46 + 4, 4);
        return (
          <View key={i} style={{ flex:1, height:h, backgroundColor:color || C.acc, borderRadius:2, opacity: 0.7 + (i/data.length)*0.3 }}/>
        );
      })}
    </View>
  );
};

// -- Mini barre de pourcentage -------------------------------
const BarH = ({ pct, color, height=5 }) => (
  <View style={{ height, backgroundColor:C.g1, borderRadius:height/2, overflow:'hidden' }}>
    <View style={{ width:`${Math.min(pct,100)}%`, height:'100%', backgroundColor:color, borderRadius:height/2 }}/>
  </View>
);

// -- Donut simplifie (barres colorees) -----------------------
const DonutSimple = ({ cats, total }) => (
  <View>
    <View style={{ flexDirection:'row', height:16, borderRadius:8, overflow:'hidden', gap:1 }}>
      {cats.map((c, i) => {
        const poids = total > 0 ? c.val / total * 100 : 0;
        return <View key={i} style={{ flex:poids, backgroundColor:c.col }}/>;
      })}
    </View>
    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 }}>
      {cats.slice(0,6).map((c,i) => (
        <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <View style={{ width:9, height:9, borderRadius:2, backgroundColor:c.col }}/>
          <Text style={{ fontSize:9, color:C.dark }}>{c.abbr} {total>0?Math.round(c.val/total*100):0}%</Text>
        </View>
      ))}
    </View>
  </View>
);

// -- Barre de navigation 6 onglets ---------------------------
const NAV_ITEMS = [
  { id:'proverbe',  label:'Accueil',  abbr:'PG1' },
  { id:'dashboard', label:'Dashboard',abbr:'DBD' },
  { id:'actifs',    label:'Actifs',   abbr:'ACT' },
  { id:'conseils',  label:'Conseils', abbr:'CNS' },
  { id:'apropos',   label:'A propos', abbr:'APR' },
  { id:'params',    label:'Params',   abbr:'PRM' },
];

const NavBar = ({ active, onChange }) => (
  <View style={{ flexDirection:'row', backgroundColor:C.white, borderTopWidth:1, borderTopColor:C.g2 }}>
    {NAV_ITEMS.map(n => {
      const isA = active === n.id;
      return (
        <TouchableOpacity
          key={n.id}
          onPress={() => onChange(n.id)}
          style={{ flex:1, alignItems:'center', paddingVertical:7 }}
          activeOpacity={0.7}
        >
          <View style={{ backgroundColor:isA?C.pri:C.g1, borderRadius:5, paddingHorizontal:4, paddingVertical:2, marginBottom:2, minWidth:26, alignItems:'center' }}>
            <Text style={{ fontSize:7.5, fontWeight:'700', color:isA?C.white:C.g3 }}>{n.abbr}</Text>
          </View>
          <Text style={{ fontSize:8.5, fontWeight:isA?'700':'400', color:isA?C.pri:C.g3 }}>{n.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// =========================================================
// PAGE 1 — PROVERBE + WIDGET PATRIMOINE + TEMOIGNAGES
// =========================================================
function PageProverbe({ onNav, data }) {
  const today     = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const prv       = PROVERBES[dayOfYear % PROVERBES.length];
  const initials  = prv.a.split(' ').map(w => w[0]).slice(0,2).join('');
  const total     = totalPatrimoine(data);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor:C.pri, padding:16 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>Bonjour, Mohammed !</Text>
            <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, marginTop:3 }}>
              {today.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </Text>
          </View>
          <View style={{ backgroundColor:'rgba(255,255,255,0.15)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignItems:'flex-end' }}>
            <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:10 }}>Patrimoine total</Text>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>{fmt(total)}</Text>
          </View>
        </View>
        {/* Barre de répartition rapide */}
        <TouchableOpacity
          onPress={() => onNav('actifs')}
          style={{ marginTop:12, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:10, padding:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection:'row', gap:6, alignItems:'center' }}>
            {[
              { label:'Financier', val: calcPEA(data.pea) + calcCT(data.ct) + calcBanque(data.banque) + calcCarnet(data.carnet) + calcLiquide(data.liquidites), col:'#6EE7A0' },
              { label:'Immo',      val: calcImmo(data.immobilier),   col:C.acc },
              { label:'Or',        val: calcOr(data.or, data.prixOr), col:'#FFD700' },
            ].map((cat, i) => (
              <View key={i} style={{ alignItems:'center' }}>
                <Text style={{ color:cat.col, fontWeight:'700', fontSize:12 }}>{total > 0 ? Math.round(cat.val / total * 100) : 0}%</Text>
                <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:9 }}>{cat.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:12 }}>Voir mes actifs →</Text>
        </TouchableOpacity>
      </View>

      {/* Proverbe */}
      <View style={{ backgroundColor:C.priD, margin:12, borderRadius:16, padding:16 }}>
        <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:11, fontWeight:'600', marginBottom:6 }}>
          Proverbe du Jour - {dayOfYear}/366
        </Text>
        <Text style={{ color:C.white, fontSize:15, fontWeight:'700', lineHeight:22, marginBottom:12 }}>
          {'"'}{prv.q}{'"'}
        </Text>
        <View style={{ backgroundColor:'rgba(255,255,255,0.08)', height:1, marginBottom:12 }}/>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
          <View style={{ width:50, height:50, borderRadius:25, backgroundColor:C.acc, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:16 }}>{initials}</Text>
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ color:C.white, fontWeight:'700', fontSize:13 }}>{prv.a}</Text>
            <Text style={{ color:'rgba(160,210,180,0.9)', fontSize:11 }}>{prv.d}</Text>
          </View>
        </View>
        <View style={{ backgroundColor:'rgba(20,90,45,0.9)', borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.acc }}>
          <Text style={{ color:C.acc, fontWeight:'700', fontSize:11, marginBottom:4 }}>PatriMoi dit :</Text>
          <Text style={{ color:'rgba(200,240,210,0.95)', fontSize:12, lineHeight:18 }}>{prv.comment}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onNav('dashboard')}
          style={{ marginTop:12, backgroundColor:C.acc, borderRadius:8, paddingVertical:9, paddingHorizontal:18, alignSelf:'flex-start' }}
          activeOpacity={0.8}
        >
          <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>Voir mon patrimoine →</Text>
        </TouchableOpacity>
      </View>

      {/* Temoignages */}
      <View style={{ paddingHorizontal:12 }}>
        <SectionTitle>Ils font confiance a PatriMoi</SectionTitle>
        {[
          { ini:'RM', nom:'Rachid M.', ville:'Casablanca', avis:'Enfin une app marocaine qui comprend nos actifs ! PEA et immobilier en meme temps, parfait.', stars:5 },
          { ini:'SB', nom:'Sara B.',   ville:'Rabat',       avis:"Super intuitif. Mes DH ne dorment plus. Merci PatriMoi !", stars:5 },
          { ini:'KA', nom:'Karim A.',  ville:'Marrakech',   avis:"Le suivi de l'or et la barre de poids des actions sont excellents.", stars:5 },
        ].map((t, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, marginBottom:8, alignItems:'center' }}>
              <View style={{ width:40, height:40, borderRadius:20, backgroundColor:C.priL, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:C.pri, fontWeight:'700', fontSize:14 }}>{t.ini}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{t.nom}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{t.ville}</Text>
              </View>
              <Text style={{ fontSize:13 }}>{'*'.repeat(t.stars)}</Text>
            </View>
            <Text style={{ fontSize:12, color:C.g3, fontStyle:'italic' }}>{'"'}{t.avis}{'"'}</Text>
          </Card>
        ))}

        <TouchableOpacity
          style={{ paddingVertical:11, borderRadius:10, borderWidth:1.5, borderColor:C.pri, backgroundColor:C.priL, alignItems:'center', marginTop:4 }}
          activeOpacity={0.8}
        >
          <Text style={{ color:C.pri, fontWeight:'700', fontSize:13 }}>Voir tous les avis →</Text>
        </TouchableOpacity>

        {/* Compteur en grand */}
        <View style={{ backgroundColor:C.pri, borderRadius:16, marginVertical:16, padding:20, alignItems:'center' }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:13, marginBottom:4 }}>Utilisateurs actifs</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:44 }}>+12 400</Text>
          <Text style={{ color:'rgba(180,230,200,0.75)', fontSize:12, marginTop:4 }}>et ca grandit chaque jour</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// =========================================================
// PAGE 2 — DASHBOARD
// =========================================================
function PageDashboard({ data, onNav, onRefreshOr, isRefreshing, onRefreshBVC, bvcStatus }) {
  const [period, setPeriod] = useState('1A');
  const total = totalPatrimoine(data);

  const cats = [
    { id:'liquide',   label:'Argent Liquide',      val:calcLiquide(data.liquidites), col:C.gpos, abbr:'LIQ', plPct:null },
    { id:'banque',    label:'Argent en Banque',     val:calcBanque(data.banque),       col:C.navy, abbr:'BNQ', plPct:null },
    { id:'carnet',    label:'Compte sur Carnet',    val:calcCarnet(data.carnet),       col:C.teal, abbr:'CRT', plPct:null },
    { id:'pea',       label:'Compte PEA',           val:calcPEA(data.pea),             col:C.pri,  abbr:'PEA', plPct:pctDiff(calcPEA(data.pea),calcPEACout(data.pea)) },
    { id:'ct',        label:'Compte-Titre',         val:calcCT(data.ct),               col:C.navy, abbr:'CT',  plPct:pctDiff(calcCT(data.ct),calcCTCout(data.ct)) },
    { id:'or',        label:'Or & Metaux Precieux', val:calcOr(data.or,data.prixOr),   col:C.gold, abbr:'OR',  plPct:null },
    { id:'immobilier',label:'Immobilier & Terrains',val:calcImmo(data.immobilier),     col:'#B46428', abbr:'IMM', plPct:null },
    { id:'transport', label:'Biens de Transport',   val:calcTransport(data.transport), col:'#50506A', abbr:'VEH', plPct:null },
  ].sort((a,b) => b.val - a.val);

  const sparkData = [1.60,1.65,1.58,1.72,1.70,1.78,1.82,1.86,1.89,1.934].map(v => v * 1e6);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.g1 }}>
      {/* Hero */}
      <View style={{ backgroundColor:C.pri, padding:16, paddingBottom:18 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Patrimoine Total</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            <TouchableOpacity
              onPress={onRefreshOr}
              disabled={isRefreshing}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, flexDirection:'row', alignItems:'center', gap:4 }}
              activeOpacity={0.7}
            >
              {isRefreshing
                ? <ActivityIndicator size="small" color="rgba(180,230,200,0.9)"/>
                : <Text style={{ fontSize:10, color:'rgba(180,230,200,0.9)' }}>↻ Or {data.lastUpdate}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRefreshBVC}
              style={{ backgroundColor:C.priD, borderRadius:6, paddingHorizontal:8, paddingVertical:3, flexDirection:'row', alignItems:'center', gap:4 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize:10, color: bvcStatus === 'ok' ? '#6EE7A0' : bvcStatus === 'error' ? C.acc : 'rgba(180,230,200,0.9)' }}>
                {bvcStatus === 'ok' ? '✓ BVC' : bvcStatus === 'error' ? '⚠ BVC' : '↻ BVC'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:28 }}>{fmt(total)}</Text>
        <View style={{ backgroundColor:'rgba(255,255,255,0.12)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start', marginTop:6 }}>
          <Text style={{ fontSize:12, color:'#6EE7A0' }}>+14 200 DH  -  +0,74% aujourd'hui</Text>
        </View>
        {/* Sparkline */}
        <View style={{ marginTop:10 }}>
          <Sparkline data={sparkData} color={C.acc}/>
        </View>
        {/* Periode */}
        <View style={{ flexDirection:'row', backgroundColor:'rgba(0,0,0,0.15)', borderRadius:8, marginTop:8, padding:2 }}>
          {['1S','1M','3M','6M','1A','MAX'].map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={{ flex:1, paddingVertical:5, alignItems:'center', borderRadius:6, backgroundColor:period===p?C.pri:'transparent' }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize:11, fontWeight:period===p?'700':'400', color:period===p?C.white:'rgba(255,255,255,0.7)' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ padding:12 }}>
        {/* Bilan du jour */}
        <Card style={{ backgroundColor:C.priL, borderLeftWidth:4, borderLeftColor:C.pri, marginBottom:10 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:8 }}>Bilan du jour</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>Or / gramme</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.gold }}>{data.prixOr} DH</Text>
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>PEA P&L</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:calcPEA(data.pea) >= calcPEACout(data.pea) ? C.gpos : C.rneg }}>
                {calcPEACout(data.pea) > 0 ? (pctDiff(calcPEA(data.pea), calcPEACout(data.pea)) >= 0 ? '+' : '') + pctDiff(calcPEA(data.pea), calcPEACout(data.pea)).toFixed(1) + '%' : 'N/A'}
              </Text>
            </View>
            <View style={{ width:1, backgroundColor:C.g2 }}/>
            <View style={{ alignItems:'center' }}>
              <Text style={{ fontSize:10, color:C.g3 }}>Actifs</Text>
              <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>8 catégories</Text>
            </View>
          </View>
        </Card>

        {/* Repartition */}
        <Card>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:10 }}>Repartition du patrimoine</Text>
          <DonutSimple cats={cats} total={total}/>
        </Card>

        {/* Liste categories */}
        <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginTop:14, marginBottom:8 }}>Detail par categorie</Text>
        {cats.map((c, i) => (
          <Card key={i} style={{ padding:12 }} onPress={() => onNav('actifs', c.id)}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
              <IconBox label={c.abbr} bg={c.col} size={36} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                <View style={{ marginTop:4 }}>
                  <BarH pct={Math.min(total>0?c.val/total*100*3:0,90)} color={c.col}/>
                </View>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:12, color:C.dark }}>{fmt(c.val)}</Text>
                {c.plPct != null && (
                  <Text style={{ fontSize:11, color:c.plPct>=0?C.gpos:C.rneg }}>{c.plPct>=0?'▲':'▼'} {Math.abs(c.plPct).toFixed(1)}%</Text>
                )}
              </View>
              <Text style={{ color:C.g2, fontSize:18 }}>›</Text>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

// =========================================================
// SOUS-PAGES ACTIFS
// =========================================================

function SubLiquide({ data, setData, onBack }) {
  const liq   = data.liquidites;
  const total = calcLiquide(liq);
  const [showAdd, setShowAdd] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [nom, setNom]         = useState('');
  const [qty, setQty]         = useState('');
  const [taux, setTaux]       = useState('');
  const COLS = ['#005090','#003280','#640064','#006440','#804000'];

  function addDevise() {
    if (!devCode || !qty || !taux) return;
    setData(d => ({ ...d, liquidites:{ ...d.liquidites, devises:[...d.liquidites.devises,
      { code:devCode.toUpperCase(), nom:nom||devCode.toUpperCase(), quantite:parseFloat(qty), taux:parseFloat(taux), variation:0 },
    ]}}));
    setShowAdd(false); setDevCode(''); setNom(''); setQty(''); setTaux('');
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Argent Liquide & Devises" subtitle="Liquidites totales" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.gpos, borderRadius:16, padding:16, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(255,255,255,0.85)', fontSize:12 }}>Total (en DH)</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:30, marginVertical:4 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(200,255,200,0.85)', fontSize:11 }}>Mis a jour : {new Date().toLocaleDateString('fr-FR')}</Text>
        </View>

        <SectionTitle>Especes en Dirhams</SectionTitle>
        <Card>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label="DH" bg={C.pri} size={36} fs={9}/>
              <View>
                <Text style={{ fontWeight:'600', fontSize:13 }}>Especes DH</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>Domicile / Coffre-fort</Text>
              </View>
            </View>
            <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>{fmt(liq.dh)}</Text>
          </View>
        </Card>

        <SectionTitle>Devises etrangeres</SectionTitle>
        {liq.devises.map((dv, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'flex-start' }}>
              <IconBox label={dv.code} bg={COLS[i % COLS.length]} size={38} fs={9}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{dv.nom}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{fmtN(dv.quantite)} {dv.code} - 1 {dv.code} = {dv.taux.toFixed(2)} DH</Text>
                <Text style={{ fontSize:10, color:C.g2, marginTop:2 }}>Source : Bank Al-Maghrib</Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{fmt(dv.quantite * dv.taux)}</Text>
                <Text style={{ fontSize:11, color:dv.variation>=0?C.gpos:C.rneg }}>
                  {dv.variation>=0?'+':''}{dv.variation.toFixed(2)}%
                </Text>
              </View>
            </View>
          </Card>
        ))}

        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gpos }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter une devise</Text>
            <Input label="Code (ex: USD)" value={devCode} onChangeText={setDevCode} placeholder="USD"/>
            <Input label="Nom complet" value={nom} onChangeText={setNom} placeholder="Dollar US"/>
            <Input label="Quantite" value={qty} onChangeText={setQty} placeholder="1000" keyboardType="numeric"/>
            <Input label="Cours (DH)" value={taux} onChangeText={setTaux} placeholder="10.22" keyboardType="numeric" unit="DH"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addDevise} style={{ flex:1 }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:4 }}>+ Ajouter une devise</BtnPri>
        )}

        <View style={{ backgroundColor:C.priL, borderRadius:10, padding:12, marginTop:14, borderLeftWidth:4, borderLeftColor:C.pri }}>
          <Text style={{ fontSize:11, color:C.pri, fontStyle:'italic' }}>
            PatriMoi conseille de limiter les liquidites a 3 mois de depenses et d'investir le surplus dans un compte PEA.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SubBanque({ data, setData, onBack }) {
  const total = calcBanque(data.banque);
  return (
    <View style={{ flex:1 }}>
      <TopBar title="Argent en Banque" subtitle="Comptes courants" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.navy, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(180,190,230,0.9)', fontSize:12 }}>Solde total</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(180,190,230,0.75)', fontSize:11 }}>{data.banque.length} compte(s)</Text>
        </View>
        {data.banque.map((b, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label="BNQ" bg={C.navy} size={36} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{b.banque}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{b.compte}</Text>
              </View>
              <Text style={{ fontWeight:'700', fontSize:14 }}>{fmt(b.solde)}</Text>
            </View>
          </Card>
        ))}
        <BtnPri onPress={() => setData(d => ({ ...d, banque:[...d.banque, { banque:'Nouvelle banque', solde:0, compte:'Compte courant' }] }))}>
          + Ajouter un compte
        </BtnPri>
      </ScrollView>
    </View>
  );
}

function SubCarnet({ data, onBack }) {
  const total = calcCarnet(data.carnet);
  const proj  = (n) => data.carnet.reduce((s,c) => s + c.solde*(Math.pow(1+c.taux/100,n)-1), 0);
  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte sur Carnet" subtitle="Epargne reglementee" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.teal, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(200,240,240,0.9)', fontSize:12 }}>Solde total</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
          <Text style={{ color:'rgba(200,240,240,0.8)', fontSize:11 }}>{data.carnet.length} carnet(s)</Text>
        </View>
        {data.carnet.map((c, i) => (
          <Card key={i}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center', marginBottom:8 }}>
              <IconBox label="CRT" bg={C.teal} size={36} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13 }}>{c.banque}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>Taux : {c.taux}% - +{fmt(c.solde*c.taux/100)}/an</Text>
              </View>
              <Text style={{ fontWeight:'700', fontSize:14 }}>{fmt(c.solde)}</Text>
            </View>
            <View style={{ backgroundColor:C.tealL, borderRadius:8, padding:10 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.teal, marginBottom:3 }}>Rappel d'epargne</Text>
              <Text style={{ fontSize:11, color:C.dark }}>Investir {fmt(c.rappel.montant)} - {c.rappel.freq}</Text>
              <Text style={{ fontSize:10, color:C.acc, marginTop:2 }}>Prochain : {c.rappel.prochaine}</Text>
            </View>
          </Card>
        ))}
        <Card style={{ backgroundColor:C.g1 }}>
          <Text style={{ fontWeight:'700', fontSize:12, marginBottom:10 }}>Projection des interets</Text>
          <View style={{ flexDirection:'row' }}>
            {[[1,'1 an'],[3,'3 ans'],[5,'5 ans']].map(([n,label]) => (
              <View key={n} style={{ flex:1, alignItems:'center' }}>
                <Text style={{ fontSize:11, color:C.g3 }}>{label}</Text>
                <Text style={{ fontSize:14, fontWeight:'700', color:C.gpos, marginTop:3 }}>+{fmt(proj(n))}</Text>
              </View>
            ))}
          </View>
        </Card>
        <BtnPri>+ Nouveau rappel d'epargne</BtnPri>
      </ScrollView>
    </View>
  );
}

const BVC_LIST = ['ATW - Attijariwafa Bank','BCP - Banque Centrale Pop.','CIH - CIH Bank','IAM - Maroc Telecom','ATL - Attijari Leasing','LHM - Label Vie','BOA - Bank of Africa','ADH - Alliances','CMA - Ciments du Maroc','HPS - HPS','WAA - Wafa Assurance','MNG - Managem'];
const PEA_COLORS = [C.priD,'#006A50',C.pri,C.gpos,C.teal,'#4A8050'];

function SubPEA({ data, setData, onBack }) {
  const pea   = data.pea;
  const total = calcPEA(pea);
  const cout  = calcPEACout(pea);
  const [showAdd, setShowAdd] = useState(false);
  const [ticker, setTicker]   = useState('');
  const [pru,    setPru]      = useState('');
  const [qty,    setQty]      = useState('');
  const [cours,  setCours]    = useState('');

  function addTitre() {
    if (!ticker || !pru || !qty || !cours) return;
    const [tck, ...rest] = ticker.split(' - ');
    setData(d => ({ ...d, pea:[...d.pea, { ticker:tck, nom:rest.join(' '), pru:parseFloat(pru), cours:parseFloat(cours), qty:parseInt(qty,10) }] }));
    setShowAdd(false); setTicker(''); setPru(''); setQty(''); setCours('');
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte PEA" subtitle="Bourse de Casablanca" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:C.priD, borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#6EE7A0', fontSize:12, fontWeight:'600' }}>
              P&L : {cout>0?(total>=cout?'+':'')+fmt(total-cout)+' ('+pctDiff(total,cout).toFixed(1)+'%)' : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontWeight:'700', fontSize:12, color:C.goldD }}>Avantages du Compte PEA au Maroc</Text>
          <Text style={{ fontSize:11, color:C.goldD, marginTop:4 }}>Exoneration totale d'impot apres 5 ans - Plafond : 600 000 DH - Titres BVC uniquement</Text>
        </View>

        {/* Tableau */}
        <Card style={{ padding:0, overflow:'hidden' }}>
          <View style={{ backgroundColor:C.pri, padding:8, flexDirection:'row' }}>
            {['Titre','PRU','Cours','P&L','Poids'].map((h,i) => (
              <Text key={i} style={{ flex:i===0?2.5:1, fontSize:10, fontWeight:'700', color:'rgba(255,255,255,0.85)', textAlign:i===0?'left':'right' }}>{h}</Text>
            ))}
          </View>
          {pea.map((t, i) => {
            const val   = t.cours * t.qty;
            const base  = t.pru   * t.qty;
            const diff  = val - base;
            const poids = total > 0 ? val / total * 100 : 0;
            return (
              <View key={i} style={{ padding:10, borderBottomWidth:1, borderBottomColor:C.g1, flexDirection:'row', alignItems:'center', gap:4 }}>
                <View style={{ flex:2.5 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                    <IconBox label={t.ticker} bg={PEA_COLORS[i%PEA_COLORS.length]} size={24} fs={7}/>
                    <Text style={{ fontSize:11, color:C.dark, fontWeight:'600' }}>{t.ticker}</Text>
                  </View>
                  <Text style={{ fontSize:9, color:C.g3, marginTop:2 }}>{t.qty} titres</Text>
                </View>
                <Text style={{ flex:1, textAlign:'right', fontSize:10, color:C.g3 }}>{t.pru.toFixed(0)}</Text>
                <Text style={{ flex:1, textAlign:'right', fontSize:10, fontWeight:'600' }}>{t.cours.toFixed(0)}</Text>
                <Text style={{ flex:1, textAlign:'right', fontSize:11, fontWeight:'700', color:diff>=0?C.gpos:C.rneg }}>
                  {diff>=0?'+':''}{pctDiff(val,base).toFixed(1)}%
                </Text>
                <View style={{ flex:1, alignItems:'flex-end' }}>
                  <View style={{ backgroundColor:C.priL, borderRadius:4, paddingHorizontal:4, paddingVertical:2 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.pri }}>{poids.toFixed(1)}%</Text>
                  </View>
                  <View style={{ marginTop:3 }}>
                    <BarH pct={Math.min(poids*4,100)} color={PEA_COLORS[i%PEA_COLORS.length]} height={3}/>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri, marginTop:8 }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:12 }}>Ajouter un titre BVC</Text>
            <SelectInput label="Action cotee BVC" value={ticker} onChange={setTicker} options={['Selectionner...'].concat(BVC_LIST)}/>
            <Input label="Prix d'achat unitaire (DH)" value={pru}   onChangeText={setPru}   keyboardType="numeric" placeholder="124.50"/>
            <Input label="Cours actuel (DH)"          value={cours} onChangeText={setCours} keyboardType="numeric" placeholder="128.20"/>
            <Input label="Quantite (actions)"         value={qty}   onChangeText={setQty}   keyboardType="numeric" placeholder="80"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addTitre} disabled={!ticker||!pru||!qty||!cours} style={{ flex:1 }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubCT({ data, onBack }) {
  const ct    = data.ct;
  const total = calcCT(ct);
  const cout  = calcCTCout(ct);
  const [tab, setTab] = useState('actions');
  const CT_COLORS = [C.navy,'#2850B0','#3060C0'];
  const OPC_COLORS= [C.pri, C.teal, C.gpos];

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Compte-Titre" subtitle="Actions & OPCVM" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.navy, borderRadius:16, padding:16, marginBottom:12 }}>
          <Text style={{ color:'rgba(180,190,230,0.9)', fontSize:12 }}>Valeur du portefeuille</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:24, marginVertical:4 }}>{fmt(total)}</Text>
          <View style={{ backgroundColor:'rgba(20,40,110,0.8)', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' }}>
            <Text style={{ color:'#90B8FF', fontSize:12, fontWeight:'600' }}>
              P&L : {cout>0?(total>=cout?'+':'')+fmt(total-cout)+' ('+pctDiff(total,cout).toFixed(1)+'%)' : 'N/A'}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor:'#FEE8E8', borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.sec, marginBottom:12 }}>
          <Text style={{ fontSize:12, fontWeight:'700', color:C.sec }}>Compte fiscalise</Text>
          <Text style={{ fontSize:11, color:'#800020', marginTop:3 }}>Les plus-values sont soumises a l'IR marocain. Pas d'exoneration fiscale contrairement au PEA apres 5 ans.</Text>
        </View>
        <View style={{ flexDirection:'row', backgroundColor:C.g1, borderRadius:8, padding:3, marginBottom:14 }}>
          {[['actions','Actions ('+ct.actions.length+')'],['opcvm','OPCVM ('+ct.opcvm.length+')']].map(([id,label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id)} style={{ flex:1, paddingVertical:8, alignItems:'center', borderRadius:6, backgroundColor:tab===id?C.navy:C.g1 }} activeOpacity={0.8}>
              <Text style={{ fontWeight:tab===id?'700':'400', fontSize:12, color:tab===id?C.white:C.g3 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab==='actions' && ct.actions.map((t,i) => {
          const val=t.cours*t.qty, base=t.pru*t.qty, poids=total>0?val/total*100:0;
          return (
            <Card key={i} style={{ paddingHorizontal:14, paddingVertical:10 }}>
              <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                <IconBox label={t.ticker} bg={CT_COLORS[i%CT_COLORS.length]} size={32} fs={8}/>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'600', fontSize:12 }}>{t.nom}</Text>
                  <Text style={{ fontSize:10, color:C.g3 }}>Qte: {t.qty} - PRU: {t.pru} - Cours: {t.cours}</Text>
                  <View style={{ marginTop:4 }}>
                    <BarH pct={Math.min(poids*4,100)} color={CT_COLORS[i%CT_COLORS.length]} height={3}/>
                  </View>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:val>=base?C.gpos:C.rneg }}>{val>=base?'+':''}{pctDiff(val,base).toFixed(1)}%</Text>
                  <View style={{ backgroundColor:C.navyL, borderRadius:4, paddingHorizontal:5, paddingVertical:1, marginTop:3 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.navy }}>{poids.toFixed(1)}% poids</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        {tab==='opcvm' && ct.opcvm.map((o,i) => {
          const val=o.vl*o.parts, poids=total>0?val/total*100:0;
          return (
            <Card key={i} style={{ padding:10 }}>
              <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                <IconBox label="OPC" bg={OPC_COLORS[i%OPC_COLORS.length]} size={32} fs={7}/>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'600', fontSize:12 }}>{o.nom}</Text>
                  <Text style={{ fontSize:10, color:C.g3 }}>{o.parts} parts - VL: {fmt(o.vl)}/part - {o.type}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={{ fontWeight:'700', fontSize:12 }}>{fmt(val)}</Text>
                  <View style={{ backgroundColor:C.priL, borderRadius:4, paddingHorizontal:5, paddingVertical:1, marginTop:3 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:C.pri }}>{poids.toFixed(1)}% poids</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        <BtnPri style={{ marginTop:8 }}>+ Ajouter un actif financier</BtnPri>
      </ScrollView>
    </View>
  );
}

function SubOr({ data, setData, onBack }) {
  const or     = data.or;
  const prixOr = data.prixOr;
  const total  = calcOr(or, prixOr);
  const [showAdd, setShowAdd] = useState(false);
  const [nom, setNom] = useState('');
  const [qty, setQty] = useState('');
  const [pa,  setPa]  = useState('');
  const [po,  setPo]  = useState('');

  function addOr() {
    if (!nom || !qty || !pa) return;
    setData(d => ({ ...d, or:[...d.or, { id:Date.now(), nom, quantite:parseFloat(qty), unite:'g', prixAchat:parseFloat(pa), prixOffert:po?parseFloat(po):null }] }));
    setShowAdd(false); setNom(''); setQty(''); setPa(''); setPo('');
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Or & Metaux Precieux" subtitle="Patrimoine physique" onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.gold, borderRadius:16, padding:16, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(255,240,200,0.9)', fontSize:12 }}>Valeur totale de votre or</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:28, marginVertical:4 }}>{fmt(total)}</Text>
        </View>
        <View style={{ backgroundColor:C.goldL, borderRadius:10, padding:12, borderLeftWidth:4, borderLeftColor:C.gold, marginBottom:12 }}>
          <Text style={{ fontWeight:'700', fontSize:12, color:C.goldD }}>Prix de l'or aujourd'hui (Maroc)</Text>
          <Text style={{ color:C.gold, fontSize:15, fontWeight:'700', marginTop:4 }}>1 gramme = {prixOr} DH</Text>
          <Text style={{ fontSize:10, color:C.goldD, marginTop:2 }}>Source : BAM + LBMA - 1 kg = {fmt(prixOr*1000)}</Text>
        </View>
        <SectionTitle>Mes stocks d'or</SectionTitle>
        {or.map((o,i) => {
          const ve=o.quantite*prixOr, vr=Math.max(ve,o.prixOffert||0);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:C.goldL, borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label="OR" bg={C.gold} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.goldD }}>{o.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{o.quantite} {o.unite}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={o.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat" value={fmt(o.prixAchat)}/>
              <InfoRow label="Valeur estimative (cours J)" value={fmt(ve)}/>
              {o.prixOffert ? <InfoRow label="Prix offert" value={fmt(o.prixOffert)}/> : null}
              <View style={{ backgroundColor:C.goldL, borderRadius:6, padding:8, marginTop:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.goldD }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.gold }}>{fmt(vr)}</Text>
              </View>
            </Card>
          );
        })}
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.gold }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter un stock d'or</Text>
            <Input label="Designation" value={nom} onChangeText={setNom} placeholder="Lingot 100g, Pieces 18K..."/>
            <Input label="Quantite (grammes)" value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="100" unit="g"/>
            <Input label="Prix d'achat (DH)" value={pa} onChangeText={setPa} keyboardType="numeric" placeholder="85000"/>
            <Input label="Prix offert (optionnel)" value={po} onChangeText={setPo} keyboardType="numeric" placeholder="Laisser vide"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addOr} disabled={!nom||!qty||!pa} style={{ flex:1, backgroundColor:C.gold }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)} style={{ marginTop:8, backgroundColor:C.gold }}>+ Ajouter un stock d'or</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubImmobilier({ data, setData, onBack }) {
  const immo  = data.immobilier;
  const total = calcImmo(immo);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nom:'', type:'Bien bati', ville:'', surface:'', prixAchat:'', prixM2:'', prixOffert:'', meth:'estimatif' });
  const up = (k,v) => setForm(f => ({...f,[k]:v}));

  function addBien() {
    if (!form.nom || !form.prixAchat) return;
    setData(d => ({ ...d, immobilier:[...d.immobilier, {
      id:Date.now(), ...form,
      surface:parseFloat(form.surface)||0, prixAchat:parseFloat(form.prixAchat)||0,
      prixM2:parseFloat(form.prixM2)||0, prixOffert:form.prixOffert?parseFloat(form.prixOffert):null,
      datAchat:new Date().getFullYear().toString(), unite:'m2',
    }] }));
    setShowAdd(false);
    setForm({ nom:'', type:'Bien bati', ville:'', surface:'', prixAchat:'', prixM2:'', prixOffert:'', meth:'estimatif' });
  }

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Immobilier & Terrains" subtitle={immo.length+' bien(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:C.pri, borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>
        {immo.map((b,i) => {
          const ve=b.prixM2*b.surface, vr=valImmo(b);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:C.priL, borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label={b.type==='Terrain'?'TRN':'APP'} bg={'#B46428'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.pri }}>{b.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{b.type} - {b.ville} - {b.surface} {b.unite||'m2'}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={b.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"      value={fmt(b.prixAchat)} sub={'Acquis en '+b.datAchat}/>
              <InfoRow label="Valeur estimative" value={fmt(ve)}           sub="Prix/m2 x Surface"/>
              <InfoRow label="Prix offert"       value={b.prixOffert?fmt(b.prixOffert):'N/A'} sub="Meilleure offre recue"/>
              <View style={{ backgroundColor:C.priL, borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:C.pri }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:C.pri }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={b.meth} onChange={m => setData(d => ({...d, immobilier:d.immobilier.map((x,j) => j===i?{...x,meth:m}:x)}))}/>
            </Card>
          );
        })}
        {showAdd ? (
          <Card style={{ borderWidth:1.5, borderColor:C.pri }}>
            <Text style={{ fontWeight:'700', fontSize:13, marginBottom:10 }}>Ajouter un bien</Text>
            <Input label="Designation"             value={form.nom}        onChangeText={v=>up('nom',v)}        placeholder="Appartement Gueliz"/>
            <SelectInput label="Type"              value={form.type}       onChange={v=>up('type',v)}           options={['Bien bati','Terrain']}/>
            <Input label="Ville"                   value={form.ville}      onChangeText={v=>up('ville',v)}      placeholder="Casablanca"/>
            <Input label="Surface (m2)"            value={form.surface}    onChangeText={v=>up('surface',v)}    keyboardType="numeric" unit="m2"/>
            <Input label="Prix d'achat (DH)"       value={form.prixAchat}  onChangeText={v=>up('prixAchat',v)}  keyboardType="numeric"/>
            <Input label="Prix au m2 du secteur"   value={form.prixM2}     onChangeText={v=>up('prixM2',v)}     keyboardType="numeric" unit="DH/m2"/>
            <Input label="Prix offert (optionnel)" value={form.prixOffert} onChangeText={v=>up('prixOffert',v)} keyboardType="numeric"/>
            <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
              <BtnSec onPress={() => setShowAdd(false)} style={{ flex:1 }}>Annuler</BtnSec>
              <BtnPri onPress={addBien} disabled={!form.nom||!form.prixAchat} style={{ flex:1 }}>Ajouter</BtnPri>
            </View>
          </Card>
        ) : (
          <BtnPri onPress={() => setShowAdd(true)}>+ Ajouter un bien</BtnPri>
        )}
      </ScrollView>
    </View>
  );
}

function SubTransport({ data, setData, onBack }) {
  const transport = data.transport;
  const total     = calcTransport(transport);
  return (
    <View style={{ flex:1 }}>
      <TopBar title="Biens de Transport" subtitle={transport.length+' vehicule(s)'} onBack={onBack}/>
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ backgroundColor:'#50506A', borderRadius:14, padding:14, alignItems:'center', marginBottom:12 }}>
          <Text style={{ color:'rgba(190,190,220,0.9)', fontSize:12 }}>Valeur totale</Text>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:26 }}>{fmt(total)}</Text>
        </View>
        <View style={{ backgroundColor:C.accL, borderRadius:10, padding:10, borderLeftWidth:4, borderLeftColor:C.acc, marginBottom:12 }}>
          <Text style={{ fontSize:11, color:C.goldD }}>Les vehicules perdent en moyenne 15-25% de valeur par an.</Text>
        </View>
        {transport.map((t,i) => {
          const vr = valTransport(t);
          return (
            <Card key={i}>
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:8, padding:10, flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                  <IconBox label="VEH" bg={'#50506A'} size={34} fs={8}/>
                  <View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{t.nom}</Text>
                    <Text style={{ fontSize:11, color:C.g3 }}>{t.type} - {t.annee} - {t.immat}</Text>
                  </View>
                </View>
                <PLBadge value={vr} base={t.prixAchat}/>
              </View>
              <InfoRow label="Prix d'achat"             value={fmt(t.prixAchat)}   sub={'Achete en '+t.dateAchat}/>
              <InfoRow label="Valeur estimative marche" value={fmt(t.valEstim)}/>
              {t.prixOffert ? <InfoRow label="Prix offert" value={fmt(t.prixOffert)}/> : null}
              <View style={{ backgroundColor:'#EAEAF0', borderRadius:6, padding:8, marginVertical:6, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ fontSize:12, fontWeight:'700', color:'#50506A' }}>Valeur retenue</Text>
                <Text style={{ fontSize:13, fontWeight:'700', color:'#50506A' }}>{fmt(vr)}</Text>
              </View>
              <MethodSelector value={t.meth} onChange={m => setData(d => ({...d, transport:d.transport.map((x,j) => j===i?{...x,meth:m}:x)}))}/>
            </Card>
          );
        })}
        <BtnPri style={{ backgroundColor:'#50506A' }}>+ Ajouter un vehicule</BtnPri>
      </ScrollView>
    </View>
  );
}

// =========================================================
// PAGE 3 — MES ACTIFS
// =========================================================
function PageActifs({ data, setData, sub, setSub }) {
  const total = totalPatrimoine(data);
  const cats = [
    { id:'liquide',   section:'Liquidites & Epargne',      label:'Argent Liquide & Devises', abbr:'LIQ', col:C.gpos,   val:calcLiquide(data.liquidites),   detail:'DH + '+data.liquidites.devises.length+' devises' },
    { id:'banque',    section:'Liquidites & Epargne',      label:'Argent en Banque',          abbr:'BNQ', col:C.navy,   val:calcBanque(data.banque),         detail:data.banque.length+' compte(s)' },
    { id:'carnet',    section:'Liquidites & Epargne',      label:'Compte sur Carnet',         abbr:'CRT', col:C.teal,   val:calcCarnet(data.carnet),         detail:'Rappels actifs' },
    { id:'pea',       section:'Investissements financiers', label:'Compte PEA',                abbr:'PEA', col:C.pri,    val:calcPEA(data.pea),               detail:data.pea.length+' titres BVC' },
    { id:'ct',        section:'Investissements financiers', label:'Compte-Titre',              abbr:'CT',  col:C.navy,   val:calcCT(data.ct),                 detail:data.ct.actions.length+' actions - '+data.ct.opcvm.length+' OPCVM' },
    { id:'or',        section:'Actifs reels',               label:'Or & Metaux Precieux',      abbr:'OR',  col:C.gold,   val:calcOr(data.or,data.prixOr),     detail:data.or.reduce((s,o)=>s+o.quantite,0)+' g au total' },
    { id:'immobilier',section:'Actifs reels',               label:'Immobilier & Terrains',     abbr:'IMM', col:'#B46428',val:calcImmo(data.immobilier),         detail:data.immobilier.length+' bien(s)' },
    { id:'transport', section:'Actifs reels',               label:'Biens de Transport',        abbr:'VEH', col:'#50506A',val:calcTransport(data.transport),    detail:data.transport.length+' vehicule(s)' },
  ];

  if (sub==='liquide')    return <SubLiquide    data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='banque')     return <SubBanque     data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='carnet')     return <SubCarnet     data={data}                  onBack={() => setSub(null)}/>;
  if (sub==='pea')        return <SubPEA        data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='ct')         return <SubCT         data={data}                  onBack={() => setSub(null)}/>;
  if (sub==='or')         return <SubOr         data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='immobilier') return <SubImmobilier data={data} setData={setData} onBack={() => setSub(null)}/>;
  if (sub==='transport')  return <SubTransport  data={data} setData={setData} onBack={() => setSub(null)}/>;

  const sections = ['Liquidites & Epargne','Investissements financiers','Actifs reels'];
  return (
    <View style={{ flex:1 }}>
      <View style={{ backgroundColor:C.pri, padding:14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color:'rgba(180,230,200,0.9)', fontSize:12 }}>Total patrimoine</Text>
          <Text style={{ color:'#6EE7A0', fontSize:11 }}>+14 200 DH (+0,74%)</Text>
        </View>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:22 }}>{fmt(total)}</Text>
      </View>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        {sections.map(sec => (
          <View key={sec}>
            <SectionLabel>{sec}</SectionLabel>
            {cats.filter(c => c.section===sec).map((c,i) => (
              <Card key={i} onPress={() => setSub(c.id)} style={{ padding:12 }}>
                <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
                  <IconBox label={c.abbr} bg={c.col} size={38} fs={9}/>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontWeight:'600', fontSize:13, color:C.dark }}>{c.label}</Text>
                    <Text style={{ fontSize:11, color:C.g3, marginTop:2 }}>{c.detail}</Text>
                  </View>
                  <Text style={{ fontWeight:'700', fontSize:13, color:C.dark }}>{fmt(c.val)}</Text>
                  <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        ))}
        <BtnPri style={{ marginTop:8 }}>+ Ajouter un actif</BtnPri>
      </ScrollView>
    </View>
  );
}

// =========================================================
// PAGE 4 — CONSEILS PERSONNALISÉS
// =========================================================
function PageConseils({ data, onNav }) {
  const conseils = generateConseils(data);
  const total    = totalPatrimoine(data);

  const priorityLabel = (p) => p === 1 ? 'Urgent' : p === 2 ? 'Important' : 'À considérer';
  const priorityBg    = (p) => p === 1 ? '#FFF0F0' : p === 2 ? '#FFF8E8' : '#F0F8FF';

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Conseils & Ressources" subtitle="Basés sur votre vrai portfolio"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>

        {/* Conseils personnalisés */}
        {conseils.length > 0 ? (
          <>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
              <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.gpos }}/>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>
                {conseils.length} recommandation{conseils.length > 1 ? 's' : ''} pour vous
              </Text>
            </View>
            {conseils.map((c) => (
              <Card key={c.id} style={{ borderLeftWidth:4, borderLeftColor:c.couleur, backgroundColor:priorityBg(c.priority), marginBottom:10 }}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <View style={{ width:28, height:28, borderRadius:14, backgroundColor:c.couleur, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>{c.icon}</Text>
                    </View>
                    <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, flex:1, flexShrink:1 }}>{c.titre}</Text>
                  </View>
                  <View style={{ backgroundColor:c.couleur + '22', borderRadius:6, paddingHorizontal:7, paddingVertical:2 }}>
                    <Text style={{ fontSize:9, fontWeight:'700', color:c.couleur }}>{priorityLabel(c.priority)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize:12, color:C.dark, lineHeight:18, marginBottom:10 }}>{c.corps}</Text>
                {c.action && (
                  <TouchableOpacity
                    onPress={() => onNav(c.nav, c.sub)}
                    style={{ backgroundColor:c.couleur, borderRadius:8, paddingVertical:8, alignItems:'center' }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color:C.white, fontWeight:'700', fontSize:12 }}>{c.action} →</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </>
        ) : (
          <Card style={{ backgroundColor:C.priL, borderLeftWidth:4, borderLeftColor:C.pri, marginBottom:14 }}>
            <Text style={{ fontWeight:'700', fontSize:13, color:C.pri, marginBottom:4 }}>Excellent travail !</Text>
            <Text style={{ fontSize:12, color:C.dark }}>Votre portfolio est bien équilibré. Continuez à alimenter votre PEA et à diversifier.</Text>
          </Card>
        )}

        {/* Score de santé patrimoine */}
        <Card style={{ marginBottom:14 }}>
          <Text style={{ fontWeight:'700', fontSize:13, color:C.dark, marginBottom:10 }}>Score de santé de votre patrimoine</Text>
          {[
            { label:'Diversification', pct: Math.min(100, (calcOr(data.or, data.prixOr) > 0 ? 25 : 0) + (calcImmo(data.immobilier) > 0 ? 25 : 0) + (calcPEA(data.pea) > 0 ? 25 : 0) + (calcCT(data.ct) > 0 ? 25 : 0)), col:C.pri },
            { label:'Épargne réglementée', pct: Math.min(100, calcCarnet(data.carnet) > 0 ? 80 : 10), col:C.teal },
            { label:'Investissements BVC', pct: Math.min(100, total > 0 ? (calcPEA(data.pea) + calcCT(data.ct)) / total * 300 : 0), col:C.navy },
            { label:'Liquidité optimale', pct: Math.min(100, total > 0 ? Math.max(0, 100 - Math.abs(((calcLiquide(data.liquidites) + calcBanque(data.banque)) / total * 100) - 15) * 4) : 0), col:C.gpos },
          ].map((s, i) => (
            <View key={i} style={{ marginBottom:8 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:3 }}>
                <Text style={{ fontSize:11, color:C.dark }}>{s.label}</Text>
                <Text style={{ fontSize:11, fontWeight:'700', color:s.col }}>{Math.round(s.pct)}%</Text>
              </View>
              <BarH pct={s.pct} color={s.col} height={6}/>
            </View>
          ))}
        </Card>

        {/* Guides thématiques */}
        <SectionTitle>Guides thématiques</SectionTitle>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:14 }}>
          {[
            { abbr:'BVC', col:C.pri,    title:'Investir à la BVC',      sub:'Débutant à Confirmé' },
            { abbr:'IMM', col:'#B46428',title:'Fiscalité immobilière',   sub:'Calculer vos plus-values' },
            { abbr:'OPC', col:C.teal,   title:'Comprendre les OPCVM',   sub:'Fonds, VL, rendements' },
            { abbr:'EPN', col:C.acc,    title:'Optimiser votre épargne', sub:'PEA, Carnet, intérêts' },
          ].map((g, i) => (
            <Card key={i} style={{ width:'47%', margin:0 }}>
              <IconBox label={g.abbr} bg={g.col} size={32} fs={9}/>
              <Text style={{ fontWeight:'700', fontSize:12, marginTop:8 }}>{g.title}</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>{g.sub}</Text>
            </Card>
          ))}
        </View>

        {/* Sources officielles */}
        <SectionTitle>Sources officielles</SectionTitle>
        {[
          { abbr:'BVC', col:C.pri,   url:'casablanca-bourse.com', desc:'Cours officiels BVC' },
          { abbr:'AMC', col:C.sec,   url:'ammc.ma',               desc:'Régulateur des marchés' },
          { abbr:'BAM', col:C.navy,  url:'bkam.ma',               desc:'Bank Al-Maghrib' },
          { abbr:'IMB', col:C.teal,  url:'mubawab.ma',            desc:'Prix immobilier Maroc' },
          { abbr:'OPC', col:C.priD,  url:'opcvm.ma',              desc:'Valeurs liquidatives OPCVM' },
        ].map((s, i) => (
          <Card key={i} style={{ padding:10 }}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label={s.abbr} bg={s.col} size={34} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{s.url}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{s.desc}</Text>
              </View>
              <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

// =========================================================
// PAGE 5 — A PROPOS
// =========================================================
function PageAPropos() {
  return (
    <View style={{ flex:1 }}>
      <TopBar title="A propos de PatriMoi" subtitle="Made in Morocco, For Morocco"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        <View style={{ alignItems:'center', paddingVertical:20 }}>
          <View style={{ width:80, height:80, borderRadius:24, backgroundColor:C.priL, alignItems:'center', justifyContent:'center', marginBottom:10 }}>
            <Text style={{ fontWeight:'700', fontSize:22, color:C.pri }}>PAT</Text>
            <Text style={{ fontWeight:'700', fontSize:12, color:C.acc }}>RIMOI</Text>
          </View>
          <Text style={{ fontWeight:'700', fontSize:20, color:C.pri }}>PatriMoi</Text>
          <Text style={{ fontSize:12, color:C.g3, marginTop:4 }}>Votre Patrimoine. Votre Avenir.</Text>
        </View>

        <Card style={{ borderLeftWidth:4, borderLeftColor:C.pri }}>
          <Text style={{ fontWeight:'700', fontSize:14, color:C.pri, marginBottom:6 }}>Notre mission</Text>
          <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
            Donner a chaque Marocain les outils pour comprendre, suivre et faire croitre son patrimoine — simplement, en francais ou en arabe, depuis son telephone.
          </Text>
        </Card>

        <Card style={{ borderLeftWidth:4, borderLeftColor:C.acc, backgroundColor:C.accL }}>
          <Text style={{ fontWeight:'700', fontSize:14, color:C.goldD, marginBottom:6 }}>Besoin comble</Text>
          <Text style={{ fontSize:13, color:C.dark, lineHeight:20 }}>
            Avant PatriMoi, aucune application marocaine ne centralisait patrimoine financier, immobilier, or et devises en un seul endroit.{' '}
            <Text style={{ fontWeight:'700' }}>Nous l'avons cree.</Text>
          </Text>
        </Card>

        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {[['12 400+','Utilisateurs'],['4,8/5','Note app'],['8','Categories'],['366','Proverbes']].map(([v,l],i) => (
            <Card key={i} style={{ flex:1, minWidth:'22%', alignItems:'center', padding:12, margin:0 }}>
              <Text style={{ fontWeight:'700', fontSize:15, color:C.pri }}>{v}</Text>
              <Text style={{ fontSize:9, color:C.g3, marginTop:4 }}>{l}</Text>
            </Card>
          ))}
        </View>

        <SectionTitle>Contactez-nous</SectionTitle>
        {[
          { abbr:'TEL', col:C.gpos, val:'06 00 00 00 00',      sub:'Appel ou WhatsApp' },
          { abbr:'MAL', col:C.navy, val:'contact@patrimoi.ma', sub:'Support & questions' },
          { abbr:'WEB', col:C.pri,  val:'www.patrimoi.ma',     sub:'Site officiel' },
          { abbr:'IG',  col:C.sec,  val:'@patrimoi.app',       sub:'Instagram & reseaux' },
        ].map((c,i) => (
          <Card key={i} style={{ padding:10 }}>
            <View style={{ flexDirection:'row', gap:10, alignItems:'center' }}>
              <IconBox label={c.abbr} bg={c.col} size={34} fs={8}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'600', fontSize:13 }}>{c.val}</Text>
                <Text style={{ fontSize:11, color:C.g3 }}>{c.sub}</Text>
              </View>
              <Text style={{ color:C.g2, fontSize:20 }}>›</Text>
            </View>
          </Card>
        ))}
        <View style={{ backgroundColor:C.pri, borderRadius:12, padding:14, alignItems:'center', marginTop:8 }}>
          <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>PatriMoi v1.0</Text>
          <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:11, marginTop:4 }}>Document confidentiel - 2025</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// =========================================================
// PAGE 6 — PARAMETRES
// =========================================================
function PageParams() {
  const [bio,     setBio]     = useState(true);
  const [discret, setDiscret] = useState(false);
  const [rappels, setRappels] = useState(true);
  const [alertes, setAlertes] = useState(true);
  const [hebdo,   setHebdo]   = useState(false);

  const sections = [
    { title:'Mon compte', items:[
      { label:'Informations personnelles', right:'›' },
      { label:'Monnaie d\'affichage',       right:'DH (MAD) ›' },
      { label:'Date de debut de suivi',    right:'01/01/2023 ›' },
    ]},
    { title:'Securite', items:[
      { label:'Auth. biometrique (Face ID)',   right:<Toggle on={bio}     onChange={setBio}/> },
      { label:'Code PIN 6 chiffres',           right:'›' },
      { label:'Verrouillage automatique',      right:'5 min ›' },
      { label:'Mode discret (masquer montants)',right:<Toggle on={discret} onChange={setDiscret}/> },
    ]},
    { title:'Notifications', items:[
      { label:'Rappels d\'epargne',      right:<Toggle on={rappels} onChange={setRappels}/> },
      { label:'Alertes de performance',  right:<Toggle on={alertes} onChange={setAlertes}/> },
      { label:'Synthese hebdo marches',  right:<Toggle on={hebdo}   onChange={setHebdo}/> },
    ]},
    { title:'Donnees & Export', items:[
      { label:'Exporter en PDF', right:'›' },
      { label:'Exporter en CSV', right:'›' },
      { label:'Supprimer mon compte', right:<Text style={{ color:C.sec }}>›</Text> },
    ]},
  ];

  return (
    <View style={{ flex:1 }}>
      <TopBar title="Parametres" subtitle="PatriMoi v1.0"/>
      <ScrollView style={{ flex:1, backgroundColor:C.g1 }} contentContainerStyle={{ padding:12 }}>
        <Card style={{ backgroundColor:C.pri, padding:14, marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:12, alignItems:'center' }}>
            <View style={{ width:50, height:50, borderRadius:25, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:18 }}>MA</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.white, fontWeight:'700', fontSize:15 }}>Mohammed Alami</Text>
              <Text style={{ color:'rgba(180,230,200,0.85)', fontSize:12 }}>m.alami@gmail.com</Text>
            </View>
            <View style={{ backgroundColor:C.acc, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:C.white }}>PatriMoi+</Text>
            </View>
          </View>
        </Card>

        {sections.map((sec, si) => (
          <View key={si}>
            <SectionLabel>{sec.title}</SectionLabel>
            <Card style={{ padding:0, overflow:'hidden' }}>
              {sec.items.map((it, ii) => (
                <View key={ii} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13, borderBottomWidth:ii<sec.items.length-1?1:0, borderBottomColor:C.g1 }}>
                  <Text style={{ flex:1, fontSize:13, color:C.dark }}>{it.label}</Text>
                  {typeof it.right === 'string'
                    ? <Text style={{ fontSize:12, color:C.g3 }}>{it.right}</Text>
                    : it.right
                  }
                </View>
              ))}
            </Card>
          </View>
        ))}

        <SectionLabel>Abonnement</SectionLabel>
        <Card style={{ borderLeftWidth:4, borderLeftColor:C.pri }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <View>
              <Text style={{ fontWeight:'700', fontSize:14, color:C.dark }}>Plan PatriMoi+</Text>
              <Text style={{ fontSize:12, color:C.g3, marginTop:2 }}>Comptes illimites - Temps reel - Export</Text>
            </View>
            <View style={{ alignItems:'flex-end' }}>
              <Text style={{ fontWeight:'700', fontSize:16, color:C.pri }}>49 DH</Text>
              <Text style={{ fontSize:10, color:C.g3 }}>/mois</Text>
            </View>
          </View>
          <BtnSec style={{ marginTop:10 }}>Gerer mon abonnement →</BtnSec>
        </Card>
      </ScrollView>
    </View>
  );
}

// =========================================================
// APPLICATION RACINE
// =========================================================
export default function PatriMoi() {
  const [page,        setPage]        = useState('proverbe');
  const [data,        setData]        = useState(INIT);
  const [sub,         setSub]         = useState(null);
  const [appReady,    setAppReady]    = useState(false);
  const [isRefreshing,setIsRefreshing]= useState(false);
  const [bvcStatus,   setBvcStatus]   = useState(null); // null | 'ok' | 'error'

  // ── Chargement initial depuis AsyncStorage ──────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored) {
          try { setData(JSON.parse(stored)); } catch { /* données corrompues → fallback INIT */ }
        }
      })
      .finally(() => setAppReady(true));
  }, []);

  // ── Sauvegarde automatique à chaque modification ─────────
  useEffect(() => {
    if (!appReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, appReady]);

  // ── Refresh cours or ────────────────────────────────────
  const refreshOr = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const prix = await fetchPrixOr();
    setIsRefreshing(false);
    if (prix) {
      setData(d => ({ ...d, prixOr: prix, lastUpdate: fmtDate() }));
    }
  }, [isRefreshing]);

  // ── Refresh cours BVC ────────────────────────────────────
  const refreshBVC = useCallback(async () => {
    const bvcData = await fetchBVC();
    if (bvcData) {
      setData(d => applyBVCCours(d, bvcData));
      setBvcStatus('ok');
    } else {
      setBvcStatus('error');
    }
  }, []);

  // Fetch or + BVC au démarrage (silencieux, parallèle)
  useEffect(() => {
    if (!appReady) return;
    refreshOr();
    refreshBVC();
  }, [appReady]);

  function goTo(p, subPage = null) { setPage(p); setSub(subPage); }
  function handleNav(p)            { setPage(p); setSub(null);    }

  if (!appReady) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:C.pri, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color:C.white, fontWeight:'700', fontSize:18, marginBottom:8 }}>PatriMoi</Text>
        <ActivityIndicator color={C.acc} size="large"/>
        <Text style={{ color:'rgba(180,230,200,0.8)', fontSize:12, marginTop:10 }}>Chargement de votre patrimoine...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.pri }}>
      <StatusBar barStyle="light-content" backgroundColor={C.pri}/>
      <View style={{ flex:1, backgroundColor:C.bg, maxWidth:APP_W, alignSelf:'center', width:'100%' }}>
        <View style={{ flex:1 }}>
          {page==='proverbe'  && <PageProverbe  onNav={goTo} data={data}/>}
          {page==='dashboard' && <PageDashboard data={data} onNav={goTo} onRefreshOr={refreshOr} isRefreshing={isRefreshing} onRefreshBVC={refreshBVC} bvcStatus={bvcStatus}/>}
          {page==='actifs'    && <PageActifs    data={data} setData={setData} sub={sub} setSub={setSub}/>}
          {page==='conseils'  && <PageConseils  data={data} onNav={goTo}/>}
          {page==='apropos'   && <PageAPropos/>}
          {page==='params'    && <PageParams/>}
        </View>
        <NavBar active={page} onChange={handleNav}/>
      </View>
    </SafeAreaView>
  );
}
