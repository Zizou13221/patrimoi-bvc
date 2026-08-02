import { C } from '../constants/colors';
import {
  totalPatrimoine, calcLiquide, calcBanque, calcPEA, calcPEACout,
  calcCT, calcCTCout, calcOr, calcImmo, calcCarnet, calcTransport,
  calcDettes,
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
  // C Fix — loyer détecté par type='Loyer recu' (pas par label)
  const loyers   = (data.revenus_recurrents || [])
    .filter(r => r.actif !== false && r.type === 'Loyer recu')
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
  const dismissed = data.conseils_dismissed || {};
  const raw = [];

  // ── Ratios de base ─────────────────────────────────────────────────────────
  const liqTotal     = calcLiquide(data.liquidites) + calcBanque(data.banque);
  const liqRatio     = liqTotal / total;
  const peaVal       = calcPEA(data.pea);
  const peaCout      = calcPEACout(data.pea);
  const ctVal        = calcCT(data.ct);
  const ctCout       = calcCTCout(data.ct);
  const orVal        = calcOr(data.or, data.prixOr);
  const orRatio      = orVal / total;
  const immoVal      = calcImmo(data.immobilier);
  const immoRatio    = immoVal / total;
  const revPassif    = calcRevenuPassifAnnuel(data);
  const rendPct      = total > 0 ? (revPassif.total / total) * 100 : 0;
  // C1 — versements cumulés PEA (contrôle du plafond 600 000 DH)
  const versements   = data.versementsCumulesPEA ?? calcPEACout(data.pea);
  // C4 — dettes
  const detteTotal   = calcDettes(data.dettes || []);
  const conseils = raw; // alias — on utilisera raw puis on filtre + trie à la fin

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

  // 1d. PEA : exonération fiscale dans < 12 mois — C2 : basé sur dateOuverturePEA (plan)
  const dateOuvPEA = data.dateOuverturePEA || null;
  const moisOuvPEA = dateOuvPEA ? detentionMois(dateOuvPEA) : null;
  const peaTitresAvecDate = (data.pea || []).filter(t => t.dateAchat);
  if (dateOuvPEA && moisOuvPEA !== null && moisOuvPEA >= 48 && moisOuvPEA < 60) {
    const resteMois = 60 - moisOuvPEA;
    conseils.push({
      id: 'pea_exo', priority: 1, couleur: C.pri, icon: '⏱', impact: resteMois,
      titre: `PEA : exonération fiscale dans ~${resteMois} mois`,
      corps: `Votre PEA a été ouvert le ${dateOuvPEA} (${moisOuvPEA} mois). À titre informatif : les plus-values sur PEA ouvert depuis plus de 5 ans bénéficient d'une exonération d'IR au Maroc. Consultez un conseiller pour votre situation spécifique.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 1e. Endettement critique : mensualités > 40% des revenus (P1)
  if (detteTotal > 0 && (data.revenus_recurrents || []).length > 0) {
    const revMensuel = (data.revenus_recurrents || [])
      .filter(r => r.actif !== false)
      .reduce((s, r) => s + (r.montant || 0), 0);
    const mensTotal  = (data.dettes || []).reduce((s, d) => s + (d.mensualite || 0), 0);
    const txEndett   = revMensuel > 0 ? mensTotal / revMensuel : 0;
    if (txEndett > 0.40) {
      conseils.push({
        id: 'endett_critique', priority: 1, couleur: C.rneg, icon: '⚠', impact: txEndett,
        titre: `Taux d'endettement critique (${Math.round(txEndett * 100)}%)`,
        corps: `Vos mensualités de crédit (${fmt(mensTotal)}/mois) représentent ${Math.round(txEndett * 100)}% de vos revenus (${fmt(revMensuel)}/mois). À titre informatif, un taux supérieur à 40% est considéré comme à risque par les organismes de crédit marocains. Consultez un conseiller financier.`,
        action: 'Voir mes dettes', nav: 'actifs', sub: 'credits',
      });
    } else if (txEndett > 0.33) {
      // 2f. Endettement élevé : 33-40% (P2)
      conseils.push({
        id: 'endett_eleve', priority: 2, couleur: '#E67E22', icon: '!', impact: txEndett,
        titre: `Taux d'endettement élevé (${Math.round(txEndett * 100)}%)`,
        corps: `Vos mensualités de crédit (${fmt(mensTotal)}/mois) représentent ${Math.round(txEndett * 100)}% de vos revenus (${fmt(revMensuel)}/mois). À titre informatif, la norme prudentielle BAM recommande de ne pas dépasser 33%. Évaluez les options de renégociation avec votre banque.`,
        action: 'Voir mes dettes', nav: 'actifs', sub: 'credits',
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITÉ 2 — Optimisations importantes
  // ══════════════════════════════════════════════════════════════════════════

  // 2a. PEA sous le plafond — C1 : contrôle sur versements cumulés (pas la valorisation)
  if (versements < PEA_PLAFOND) {
    const reste = PEA_PLAFOND - versements;
    const plPct = peaCout > 0 ? pctDiff(peaVal, peaCout) : null;
    conseils.push({
      id: 'pea', priority: 2, couleur: C.pri, icon: '★', impact: reste,
      titre: `PEA : ${fmt(reste)} de plafond de versements disponible`,
      corps: `Vos versements cumulés sur PEA (${fmt(versements)}) restent sous le plafond légal de ${fmt(PEA_PLAFOND)}.${plPct !== null ? ` Performance actuelle : ${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%.` : ''} À titre informatif : l'enveloppe PEA offre un cadre fiscal avantageux au Maroc après 5 ans de détention.`,
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

  // 3d. PEA : plan exonéré (≥ 5 ans) — C2 : basé sur dateOuverturePEA du plan
  if (dateOuvPEA && moisOuvPEA !== null && moisOuvPEA >= 60) {
    conseils.push({
      id: 'pea_exo_ok', priority: 3, couleur: C.gpos, icon: '✓', impact: 1,
      titre: `PEA exonéré — ${moisOuvPEA} mois d'ancienneté`,
      corps: `Votre PEA (ouvert le ${dateOuvPEA}) a plus de 5 ans. À titre informatif, les plus-values sur PEA ouvert depuis 5 ans ou plus bénéficient d'une exonération d'IR au Maroc. Consultez un fiscaliste pour confirmer votre situation.`,
      action: 'Voir mon PEA', nav: 'actifs', sub: 'pea',
    });
  }

  // 3d-bis. PEA : date d'ouverture non renseignée (pea non vide) — inviter à la renseigner
  if (!dateOuvPEA && peaVal > 0) {
    conseils.push({
      id: 'pea_date_manquante', priority: 3, couleur: C.pri, icon: 'ℹ', impact: 0,
      titre: 'PEA : renseignez la date d\'ouverture du plan',
      corps: "La date d'ouverture de votre PEA n'est pas renseignée. Sans cette information, l'application ne peut pas calculer automatiquement votre exonération fiscale au seuil des 5 ans. Renseignez-la dans les détails du PEA.",
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

  // C14 — Filtrer les conseils ignorés + trier : priorité ASC, puis impact DESC
  const filtres = conseils
    .filter(c => !dismissed[c.id])
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.impact ?? 0) - (a.impact ?? 0);
    });

  return { conseils: filtres, total };
}
