// =========================================================
// FONCTIONS DE CALCUL — pures, sans effets de bord
// =========================================================

export const calcLiquide   = (liq) => liq.dh + liq.devises.reduce((s, d) => s + d.quantite * d.taux, 0);
export const calcBanque    = (arr) => arr.reduce((s, b) => s + b.solde, 0);
export const calcCarnet    = (arr) => arr.reduce((s, c) => s + c.solde, 0);
export const calcPEA       = (arr) => arr.reduce((s, t) => s + t.cours * t.qty, 0);
export const calcPEACout   = (arr) => arr.reduce((s, t) => s + t.pru   * t.qty, 0);
export const calcCT        = (ct)  => ct.actions.reduce((s, t) => s + t.cours * t.qty, 0) + ct.opcvm.reduce((s, o) => s + o.vl * o.parts, 0);
export const calcCTCout    = (ct)  => ct.actions.reduce((s, t) => s + t.pru   * t.qty, 0) + ct.opcvm.reduce((s, o) => s + (o.vl_achat ?? o.vl) * o.parts, 0);
export const valImmo       = (b)   => b.meth === 'estimatif' ? b.prixM2 * b.surface : (b.prixOffert || b.prixM2 * b.surface);
export const calcImmo      = (arr) => arr.reduce((s, b) => s + valImmo(b), 0);
export const valTransport  = (t)   => t.meth === 'estimatif' ? t.valEstim : (t.prixOffert || t.valEstim);
export const calcTransport = (arr) => arr.reduce((s, t) => s + valTransport(t), 0);
export const valOr         = (o, px) => Math.max(o.quantite * px, o.prixOffert || 0);
export const calcOr        = (arr, px) => arr.reduce((s, o) => s + valOr(o, px), 0);

export const totalPatrimoine = (d) =>
  calcLiquide(d.liquidites) + calcBanque(d.banque) + calcCarnet(d.carnet) +
  calcPEA(d.pea) + calcCT(d.ct) + calcImmo(d.immobilier) +
  calcTransport(d.transport) + calcOr(d.or, d.prixOr);

// Coût total investi (pour calcul P&L global)
export const totalCout = (d) =>
  calcPEACout(d.pea) + calcCTCout(d.ct) +
  d.immobilier.reduce((s, b) => s + (b.prixAchat || 0), 0) +
  d.transport.reduce((s, t) => s + (t.prixAchat || 0), 0) +
  d.or.reduce((s, o) => s + (o.prixAchat || 0), 0);
