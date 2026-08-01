import { C } from '../constants/colors';
import {
  totalPatrimoine, calcLiquide, calcBanque, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcCarnet, calcTransport,
} from './calc';
import { fmt, pctDiff } from './fmt';

// =========================================================
// PISTES D'OPTIMISATION PATRIMONIALE
//
// ⚠️  CONFORMITÉ AMMC
// Toutes les observations sont fournies à titre informatif
// et éducatif uniquement. Elles ne constituent pas un conseil
// en investissement au sens de la réglementation AMMC / CDVM.
// Aucune recommandation d'achat ou de vente de valeurs
// mobilières n'est formulée. L'utilisateur reste seul
// responsable de ses décisions financières.
// =========================================================

const BAM_TAUX = 2.75; // Taux directeur BAM 2026 (%)
const PEA_PLAFOND = 600000;

// Durée de détention en mois à partir d'une date "jj/mm/aaaa"
function detentionMois(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  if (isNaN(dt.getTime())) return null;
  return Math.floor((Date.now() - dt) / (1000 * 60 * 60 * 24 * 30.44));
}

// Revenus passifs annuels (carnet + loyers + dividendes de l'année)
function calcRevenuPassifAnnuel(data) {
  const interets = (data.carnet || []).reduce((s, c) => s + (c.solde || 0) * (c.taux || 0) / 100, 0);
  const loyers   = (data.revenus_recurrents || [])
    .filter(r => r.actif !== false && r.label?.toLowerCase().includes('loyer'))
    .reduce((s, r) => s + (r.montant || 0) * 12, 0);
  const annee    = new Date().getFullYear();
  const divs     = (data.operations || [])
    .filter(op => op.type === 'revenu' && op.categorie === 'dividende' && new Date(op.date).getFullYear() === annee)
    .reduce((s, op) => s + (op.montant || 0), 0);
  return { interets, loyers, divs, total: interets + loyers + divs };
}

// Budget du mois courant (opérations)
function calcBudgetMois(data) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ops = (data.operations || []).filter(op => (op.date || '').startsWith(ym));
  const revenus  = ops.filter(o => o.type === 'revenu').reduce((s, o)  => s + (o.montant || 0), 0);
  const depenses = ops.filter(o => o.type === 'depense').reduce((s, o) => s + (o.montant || 0), 0);
  return { revenus, depenses, solde: revenus - depenses, nb: ops.length };
}

export function generateConseils(data) {
  const total = totalPatrimoine(data);
  if (total === 0) return { conseils: [], total: 0 };
  const conseils = [];

  // ── Ratios de base ─────────────────────────────────────────────────────────
  const liqTotal  = calcLiquide(data.liquidites) + calcBanque(data.banque);
  const liqRatio  = liqTotal / total;
  const peaVal    = calcPEA(data.pea);
  const peaCout   = calcPEACout(data.pea);
  const ctVal     = calcCT(data.ct);
  const ctCout    = calcCTCout(data.ct);
  const orVal     = calcOr(data.or, data.prixOr);
  const orRatio   = orVal / total;
  const immoVal   = calcImmo(data.immobilier);
  const immoRatio = immoVal / total;
  const revPassif = calcRevenuPassifAnnuel(data);
  const rendPct   = total > 0 ? (revPassif.total / total) * 100 : 0;

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 1 — Alertes
  // ══════════════════════════════════════════════════════════════════════════

  // 1a. Liquidités trop élevées (> 25%)
  if (liqRatio > 0.25) {
    conseils.push({
      id: 'liq_haute', priority: 1, couleur: C.rneg, icon: '⚠',
      titre: 'Liquidités élevées',
      corps: `Vos liquidités représentent ${Math.round(liqRatio * 100)}% de votre patrimoine (${fmt(liqTotal)}). À titre indicatif, les bonnes pratiques suggèrent de maintenir 3 à 6 mois de dépenses en réserve et de placer le reste sur des actifs plus rémunérateurs.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 1b. Liquidités trop faibles (< 5%) — manque de sécurité
  if (liqRatio < 0.05 && total > 100000) {
    conseils.push({
      id: 'liq_faible', priority: 1, couleur: C.rneg, icon: '⚠',
      titre: 'Épargne de sécurité insuffisante',
      corps: `Vos liquidités (${fmt(liqTotal)}) représentent moins de 5% de votre patrimoine. À titre indicatif, disposer de 3 à 6 mois de dépenses en actifs liquides permet de faire face aux imprévus sans liquider des placements à contretemps.`,
      action: 'Voir mes liquidités', nav: 'actifs', sub: 'carnet',
    });
  }

  // 1c. Budget déficitaire ce mois
  const budget = calcBudgetMois(data);
  if (budget.nb >= 3 && budget.solde < 0) {
    conseils.push({
      id: 'budget_def', priority: 1, couleur: C.rneg, icon: '📉',
      titre: `Budget déficitaire ce mois (${fmt(Math.abs(budget.solde))} de dépassement)`,
      corps: `Vos dépenses enregistrées ce mois (${fmt(budget.depenses)}) dépassent vos revenus (${fmt(budget.revenus)}). Un déséquilibre budgétaire répété érode le patrimoine. Consultez votre suivi Budget pour identifier les postes à ajuster. À titre informatif uniquement.`,
      action: 'Voir mon budget', nav: 'budget', sub: null,
    });
  }

  // 1d. PEA : exonération fiscale dans < 12 mois
  const peaTitresAvecDate = (data.pea || []).filter(t => t.dateAchat);
  const peaPresque5ans = peaTitresAvecDate.filter(t => {
    const m = detentionMois(t.dateAchat);
    return m !== null && m >= 48 && m < 60;
  });
  if (peaPresque5ans.length > 0) {
    const tickers    = peaPresque5ans.map(t => t.ticker).join(', ');
    const resteMois  = 60 - (detentionMois(peaPresque5ans[0].dateAchat) ?? 60);
    conseils.push({
      id: 'pea_exo', priority: 1, couleur: C.pri, icon: '⏱',
      titre: `PEA : exonération fiscale dans ~${resteMois} mois`,
      corps: `${tickers} atteindront les 5 ans de détention dans environ ${resteMois} mois. À titre informatif : au Maroc, les plus-values sur titres cotés détenus plus de 5 ans via PEA bénéficient d'une exonération d'IR. Consultez un conseiller pour votre situation spécifique.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 2 — Optimisations importantes
  // ══════════════════════════════════════════════════════════════════════════

  // 2a. PEA sous le plafond
  if (peaVal < PEA_PLAFOND) {
    const reste = PEA_PLAFOND - peaVal;
    const plPct = peaCout > 0 ? pctDiff(peaVal, peaCout) : null;
    conseils.push({
      id: 'pea', priority: 2, couleur: C.pri, icon: '★',
      titre: `PEA : ${fmt(reste)} de plafond disponible`,
      corps: `Votre PEA est à ${fmt(peaVal)} sur ${fmt(PEA_PLAFOND)} de plafond autorisé.${plPct !== null ? ` Performance actuelle : ${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%.` : ''} À titre informatif : l'enveloppe PEA offre un cadre fiscal avantageux au Maroc après 5 ans de détention.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 2b. Aucun actif financier (PEA = 0 et CT = 0) — patrimoine purement immobilier
  if (peaVal === 0 && ctVal === 0 && total > 200000) {
    conseils.push({
      id: 'no_financier', priority: 2, couleur: '#B46428', icon: '⚖',
      titre: 'Aucun actif financier détecté',
      corps: `Votre patrimoine (${fmt(total)}) ne comprend aucun actif financier coté (PEA, Compte-Titre). À titre indicatif, une allocation mixte entre immobilier et actifs financiers peut améliorer la liquidité et le rendement global. Consultez un conseiller en gestion de patrimoine.`,
      action: 'Voir mes actifs', nav: 'actifs', sub: 'pea',
    });
  }

  // 2c. Immobilier très concentré (> 70%)
  if (immoRatio > 0.70) {
    conseils.push({
      id: 'immo_conc', priority: 2, couleur: '#B46428', icon: '!',
      titre: `Patrimoine très concentré en immobilier (${Math.round(immoRatio * 100)}%)`,
      corps: `L'immobilier représente ${Math.round(immoRatio * 100)}% de votre patrimoine (${fmt(immoVal)}). À titre indicatif, une concentration élevée sur un actif illiquide augmente le risque global du portefeuille. Un conseiller en gestion de patrimoine peut vous aider à évaluer les options de diversification.`,
      action: 'Voir mon immobilier', nav: 'actifs', sub: 'immobilier',
    });
  }

  // 2d. Or surpondéré (> 15%) — pas de revenu, frein au rendement
  if (orRatio > 0.15) {
    conseils.push({
      id: 'or_eleve', priority: 2, couleur: C.gold, icon: '◈',
      titre: `Or surpondéré (${Math.round(orRatio * 100)}% du patrimoine)`,
      corps: `L'or représente ${Math.round(orRatio * 100)}% de votre patrimoine (${fmt(orVal)}). À titre indicatif, l'or ne génère pas de revenu courant : une allocation supérieure à 15% peut peser sur le rendement global. Les praticiens situent généralement la pondération optimale entre 5 et 10%.`,
      action: 'Voir mon or', nav: 'actifs', sub: 'or',
    });
  }

  // 2e. Compte-Titre en moins-value
  if (ctVal < ctCout && ctCout > 0) {
    conseils.push({
      id: 'ct', priority: 2, couleur: C.rneg, icon: '↓',
      titre: 'Compte-Titre en moins-value',
      corps: `Votre Compte-Titre affiche une moins-value latente de ${fmt(ctCout - ctVal)} (${pctDiff(ctVal, ctCout).toFixed(1)}%). À titre informatif, il peut être utile de revoir la composition du portefeuille avec un professionnel. Aucune recommandation d'achat ou de vente n'est formulée ici.`,
      action: 'Voir mon Compte-Titre', nav: 'actifs', sub: 'ct',
    });
  }

  // 2f. Taux carnet inférieur au taux BAM
  const carnetsSousTaux = (data.carnet || []).filter(c => c.solde > 0 && c.taux > 0 && c.taux < BAM_TAUX);
  if (carnetsSousTaux.length > 0) {
    const nomsBanques = carnetsSousTaux.map(c => c.banque || 'Carnet').join(', ');
    conseils.push({
      id: 'carnet_taux', priority: 2, couleur: C.teal, icon: '✦',
      titre: `Taux carnet inférieur au taux de référence BAM`,
      corps: `${nomsBanques} affichent un taux inférieur à ${BAM_TAUX}% (taux directeur BAM 2026). À titre indicatif, il peut être utile de vérifier auprès de votre établissement si un taux plus favorable est disponible. Cette information est fournie à des fins éducatives uniquement.`,
      action: 'Voir mes carnets', nav: 'actifs', sub: 'carnet',
    });
  }

  // 2g. Immobilier non rentabilisé (biens sans loyer lié, immo > 40%)
  if (immoRatio > 0.40) {
    const biensNonLoues = (data.immobilier || []).filter(b => {
      // Exclure résidence principale et terrains (non concernés par la location)
      if (b.estLogement || b.type === 'Terrain') return false;
      const loyerLie = (data.revenus_recurrents || []).find(r =>
        r.actif !== false && (
          (b.id && r.bienId === b.id) ||
          (b.nom && r.bienNom && r.bienNom === b.nom) ||
          r.label?.toLowerCase().includes(b.nom?.toLowerCase())
        )
      );
      return !loyerLie;
    });
    if (biensNonLoues.length > 0) {
      const noms = biensNonLoues.map(b => b.nom).join(', ');
      conseils.push({
        id: 'immo_vide', priority: 2, couleur: '#B46428', icon: '🏠',
        titre: `${biensNonLoues.length > 1 ? biensNonLoues.length + ' biens sans' : 'Bien sans'} loyer récurrent`,
        corps: `${noms} — aucun loyer récurrent associé. À titre indicatif, un bien immobilier non loué génère des charges sans revenu compensatoire. Évaluer la mise en location peut améliorer le rendement global. Consultez un professionnel pour toute décision de cette nature.`,
        action: 'Voir mon immobilier', nav: 'actifs', sub: 'immobilier',
      });
    }
  }

  // 2h. Concentration BVC : 1 titre représente > 50% du PEA en valeur
  if (peaVal > 0 && (data.pea || []).length > 0) {
    const peaTrie = [...(data.pea || [])].sort((a, b) => (b.valeur || 0) - (a.valeur || 0));
    const topTitre = peaTrie[0];
    const topPct   = ((topTitre.valeur || 0) / peaVal) * 100;
    if (topPct > 50 && (data.pea || []).length > 1) {
      conseils.push({
        id: 'pea_conc', priority: 2, couleur: C.rneg, icon: '⚡',
        titre: `PEA : ${topTitre.ticker} représente ${Math.round(topPct)}% du portefeuille`,
        corps: `Une ligne représentant plus de 50% d'un portefeuille constitue un risque de concentration élevé. À titre informatif, les bonnes pratiques suggèrent de limiter chaque position à 20-25% maximum. Aucune recommandation d'achat ou de vente n'est formulée ici.`,
        action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 3 — Observations & renforts positifs
  // ══════════════════════════════════════════════════════════════════════════

  // 3a. Ouvrir un carnet (aucun carnet existant)
  if (calcCarnet(data.carnet) === 0) {
    conseils.push({
      id: 'carnet', priority: 3, couleur: C.teal, icon: '✦',
      titre: 'Compte sur Carnet : épargne garantie disponible',
      corps: `Aucun Compte sur Carnet détecté. À titre informatif, ce produit offre un taux garanti (référence BAM : ${BAM_TAUX}%) sans risque en capital, adapté à une épargne de précaution de 3 à 6 mois de dépenses. Renseignez-vous auprès de votre établissement bancaire.`,
      action: 'Voir les carnets', nav: 'actifs', sub: 'carnet',
    });
  }

  // 3b. Faible exposition à l'or (< 5%)
  if (orRatio < 0.05) {
    conseils.push({
      id: 'or_faible', priority: 3, couleur: C.gold, icon: '◈',
      titre: 'Faible exposition à l\'or',
      corps: `L'or représente ${Math.round(orRatio * 100)}% de votre patrimoine. À titre indicatif, une pondération de 5 à 10% est souvent citée comme valeur refuge face à l'inflation du dirham. Cette information est éducative et ne constitue pas un conseil d'investissement.`,
      action: 'Voir mon or', nav: 'actifs', sub: 'or',
    });
  }

  // 3c. Rendement passif faible (< 2%) — capital sous-optimisé
  if (rendPct < 2 && total > 300000 && revPassif.total < total * 0.02) {
    conseils.push({
      id: 'rend_faible', priority: 3, couleur: C.teal, icon: '📊',
      titre: `Rendement passif de ${rendPct.toFixed(1)}% — capital peu actif`,
      corps: `Vos revenus passifs annuels (intérêts, loyers, dividendes) représentent ${rendPct.toFixed(1)}% de votre patrimoine. À titre indicatif, un patrimoine bien structuré vise généralement au-dessus du taux de référence BAM (${BAM_TAUX}%). Consultez un conseiller en gestion de patrimoine pour analyser les leviers disponibles.`,
      action: 'Voir mes actifs', nav: 'actifs', sub: null,
    });
  }

  // 3d. PEA : titres exonérés (≥ 5 ans de détention)
  const peaDejaExo = peaTitresAvecDate.filter(t => {
    const m = detentionMois(t.dateAchat);
    return m !== null && m >= 60;
  });
  if (peaDejaExo.length > 0) {
    const tickers = peaDejaExo.map(t => t.ticker).join(', ');
    conseils.push({
      id: 'pea_exo_ok', priority: 3, couleur: C.gpos, icon: '✓',
      titre: `PEA : ${peaDejaExo.length} titre(s) avec 5 ans de détention`,
      corps: `${tickers} — plus de 5 ans de détention. À titre informatif, les titres cotés détenus plus de 5 ans dans un PEA bénéficient d'une exonération d'IR au Maroc sur les plus-values. Consultez un fiscaliste pour confirmer votre situation.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 3e. PEA en forte plus-value (> 25%)
  if (peaCout > 0 && peaVal > 0) {
    const peaPerf = pctDiff(peaVal, peaCout);
    if (peaPerf > 25) {
      conseils.push({
        id: 'pea_perf', priority: 3, couleur: C.gpos, icon: '↑',
        titre: `PEA : forte performance (+${peaPerf.toFixed(1)}%)`,
        corps: `Votre PEA affiche +${peaPerf.toFixed(1)}%. À titre informatif, une forte concentration des gains sur un seul portefeuille peut mériter une réflexion sur le rééquilibrage, notamment si le seuil des 5 ans est atteint. Aucune recommandation d'achat ou de vente n'est formulée ici.`,
        action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
      });
    }
  }

  // 3f. Or bien pondéré (5-10%)
  if (orRatio >= 0.05 && orRatio <= 0.10) {
    conseils.push({
      id: 'or_ok', priority: 3, couleur: C.gold, icon: '◈',
      titre: `Or bien pondéré (${Math.round(orRatio * 100)}% du patrimoine)`,
      corps: `Votre allocation or se situe dans la fourchette couramment citée (5-10%). Avec un cours actuel de ${data.prixOr ? fmt(data.prixOr) + '/g' : 'N/A'}, cette pondération joue son rôle de valeur refuge. À titre informatif uniquement.`,
      action: null, nav: null, sub: null,
    });
  }

  // 3g. Revenus passifs couvrent les charges récurrentes — liberté financière partielle
  const totalRevPassifMensuel = (data.revenus_recurrents || [])
    .filter(r => r.actif !== false)
    .reduce((s, r) => s + (r.montant || 0), 0);
  const totalCiblesMensuel = Object.values(data.budgetCibles || {}).reduce((s, v) => s + (v || 0), 0);
  if (totalRevPassifMensuel > 0 && totalCiblesMensuel > 0 && totalRevPassifMensuel >= totalCiblesMensuel) {
    conseils.push({
      id: 'liberte_fin', priority: 3, couleur: C.gpos, icon: '🏆',
      titre: `Vos revenus passifs couvrent vos charges (${fmt(totalRevPassifMensuel)}/mois)`,
      corps: `Vos revenus récurrents (${fmt(totalRevPassifMensuel)}/mois) couvrent l'ensemble de vos charges budgétées (${fmt(totalCiblesMensuel)}/mois). À titre informatif, c'est un indicateur de résilience patrimoniale : vous n'êtes pas contraint de liquider des actifs pour couvrir vos dépenses.`,
      action: null, nav: null, sub: null,
    });
  }

  // 3h. Véhicule ancien (> 8 ans) avec valeur estimée élevée (> 100K DH)
  const vehiculesAnciens = (data.transport || []).filter(v => {
    const age = new Date().getFullYear() - (parseInt(v.annee) || 0);
    const val = v.prixOffert || v.valEstim || v.prixAchat || 0;
    return age >= 8 && val > 100000;
  });
  if (vehiculesAnciens.length > 0) {
    const noms = vehiculesAnciens.map(v => v.nom || `Véhicule ${v.annee}`).join(', ');
    conseils.push({
      id: 'transport_dep', priority: 3, couleur: C.g3, icon: '🚗',
      titre: `Valeur véhicule à réévaluer (${noms})`,
      corps: `Un véhicule de plus de 8 ans se déprécie significativement. À titre indicatif, la valeur retenue dans votre patrimoine mérite d'être révisée régulièrement pour refléter la valeur réelle de marché. Cette information est fournie à des fins de précision patrimoniale uniquement.`,
      action: 'Voir mon transport', nav: 'actifs', sub: 'transport',
    });
  }

  return { conseils: conseils.sort((a, b) => a.priority - b.priority), total };
}
