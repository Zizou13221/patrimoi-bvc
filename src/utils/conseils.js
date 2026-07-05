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
      corps: `Le Compte sur Carnet offre 2,5 à 3% par an, garanti et sans risque. Idéal pour votre épargne de précaution.`,
      action: 'Voir les carnets', nav: 'actifs', sub: 'carnet',
    });
  }

  return { conseils: conseils.sort((a, b) => a.priority - b.priority), total };
}
