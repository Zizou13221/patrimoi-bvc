import { C } from '../constants/colors';
import {
  totalPatrimoine, calcLiquide, calcBanque, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcCarnet,
} from './calc';
import { fmt, pctDiff } from './fmt';

// =========================================================
// CONSEILS PERSONNALISÉS
// Retourne { conseils, total } pour éviter un double calcul
// dans PageConseils.
// =========================================================
export function generateConseils(data) {
  const total = totalPatrimoine(data);
  if (total === 0) return { conseils: [], total: 0 };
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

  if (liqRatio > 0.25) {
    conseils.push({
      id: 'liq', priority: 1, couleur: C.rneg, icon: '⚠',
      titre: 'Liquidités élevées',
      corps: `Vos liquidités représentent ${Math.round(liqRatio * 100)}% de votre patrimoine (${fmt(liqTotal)}). La règle : 3 mois de dépenses en réserve, le reste investi. Pensez à alimenter votre PEA.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

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

  if (orRatio < 0.05) {
    conseils.push({
      id: 'or', priority: 3, couleur: C.gold, icon: '◈',
      titre: 'Faible exposition à l\'or',
      corps: `L'or représente seulement ${Math.round(orRatio * 100)}% de votre patrimoine. Les experts recommandent 5 à 10% en valeur refuge, surtout face à l'inflation du dirham.`,
      action: 'Voir mon or', nav: 'actifs', sub: 'or',
    });
  }

  if (immoRatio > 0.70) {
    conseils.push({
      id: 'immo', priority: 2, couleur: '#B46428', icon: '!',
      titre: 'Patrimoine très concentré en immobilier',
      corps: `L'immobilier représente ${Math.round(immoRatio * 100)}% de votre patrimoine (${fmt(immoVal)}). Une concentration aussi forte réduit votre liquidité. Envisagez de diversifier vers des actifs financiers.`,
      action: 'Voir mon immobilier', nav: 'actifs', sub: 'immobilier',
    });
  }

  const ctCout = calcCTCout(data.ct);
  if (ctVal < ctCout && ctCout > 0) {
    conseils.push({
      id: 'ct', priority: 2, couleur: C.rneg, icon: '↓',
      titre: 'Compte-Titre en moins-value',
      corps: `Votre Compte-Titre affiche une moins-value de ${fmt(ctCout - ctVal)} (${pctDiff(ctVal, ctCout).toFixed(1)}%). Pensez à arbitrer ou renforcer les lignes les plus solides.`,
      action: 'Voir mon Compte-Titre', nav: 'actifs', sub: 'ct',
    });
  }

  if (calcCarnet(data.carnet) === 0) {
    conseils.push({
      id: 'carnet', priority: 3, couleur: C.teal, icon: '✦',
      titre: 'Ouvrez un Compte sur Carnet',
      corps: `Le Compte sur Carnet offre 2,75% par an (taux BAM 2025), garanti et sans risque. Idéal pour votre épargne de précaution (3 à 6 mois de dépenses).`,
      action: 'Voir les carnets', nav: 'actifs', sub: 'carnet',
    });
  }

  // ── PEA : exemption fiscale 5 ans (titres avec dateAchat renseignée) ──
  const detentionMoisFn = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (isNaN(dt.getTime())) return null;
    return Math.floor((Date.now() - dt) / (1000 * 60 * 60 * 24 * 30.44));
  };
  const peaTitresAvecDate = (data.pea || []).filter(t => t.dateAchat);
  const peaPresque5ans = peaTitresAvecDate.filter(t => {
    const m = detentionMoisFn(t.dateAchat);
    return m !== null && m >= 48 && m < 60;
  });
  const peaDejaExo = peaTitresAvecDate.filter(t => {
    const m = detentionMoisFn(t.dateAchat);
    return m !== null && m >= 60;
  });
  if (peaPresque5ans.length > 0) {
    const tickers = peaPresque5ans.map(t => t.ticker).join(', ');
    const resteMois = 60 - (detentionMoisFn(peaPresque5ans[0].dateAchat) ?? 60);
    conseils.push({
      id: 'pea_exo', priority: 1, couleur: C.pri, icon: '⏱',
      titre: `PEA : exonération fiscale dans ~${resteMois} mois`,
      corps: `${tickers} atteindront les 5 ans d'exonération dans environ ${resteMois} mois. Ne vendez pas avant ! Après cette date, vos plus-values seront 100% exonérées d'impôt.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }
  if (peaDejaExo.length > 0) {
    const tickers = peaDejaExo.map(t => t.ticker).join(', ');
    conseils.push({
      id: 'pea_exo_ok', priority: 3, couleur: C.gpos, icon: '✓',
      titre: `PEA : ${peaDejaExo.length} titre(s) exonérés d'impôt`,
      corps: `${tickers} — plus de 5 ans de détention. Vos plus-values sur ces titres sont exonérées d'IR au Maroc. Excellente stratégie patrimoniale !`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // ── PEA en forte plus-value (> 25%) → diversifier ──
  if (peaCout > 0 && peaVal > 0) {
    const peaPerf = pctDiff(peaVal, peaCout);
    if (peaPerf > 25) {
      conseils.push({
        id: 'pea_perf', priority: 3, couleur: C.gpos, icon: '↑',
        titre: `PEA en forte plus-value (+${peaPerf.toFixed(1)}%)`,
        corps: `Votre PEA affiche +${peaPerf.toFixed(1)}% de performance. Pensez à prendre partiellement vos bénéfices si votre PEA dépasse 5 ans, ou à rééquilibrer pour réduire la concentration sur un seul titre.`,
        action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
      });
    }
  }

  // ── Or à bon niveau (5-10%) → renforcement positif ──
  if (orRatio >= 0.05 && orRatio <= 0.10) {
    conseils.push({
      id: 'or_ok', priority: 3, couleur: C.gold, icon: '◈',
      titre: `Or bien pondéré (${Math.round(orRatio * 100)}% du patrimoine)`,
      corps: `Votre allocation or est optimale (5-10%). Avec un cours actuel de ${data.prixOr ? fmt(data.prixOr) + '/g' : 'N/A'}, votre or joue pleinement son rôle de valeur refuge contre l'inflation du dirham.`,
      action: null, nav: null, sub: null,
    });
  }

  return { conseils: conseils.sort((a, b) => a.priority - b.priority), total };
}
