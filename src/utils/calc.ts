/**
 * PatriMoi — Fonctions de calcul typées (Phase 3 DAT v2.0)
 * Pures, sans effets de bord. Remplace calc.js.
 */

import type {
  Liquidites, CompteBanque, CarnetEpargne, TitrePEA, TitreCT,
  OPCVM, CT, BienImmobilier, Vehicule, Or, PatrimoineData,
} from '../types';

export const calcLiquide   = (liq: Liquidites): number =>
  liq.dh + liq.devises.reduce((s, d) => s + d.quantite * d.taux, 0);

export const calcBanque    = (arr: CompteBanque[]): number =>
  arr.reduce((s, b) => s + b.solde, 0);

export const calcCarnet    = (arr: CarnetEpargne[]): number =>
  arr.reduce((s, c) => s + c.solde, 0);

export const calcPEA       = (arr: TitrePEA[]): number =>
  arr.reduce((s, t) => s + t.cours * t.qty, 0);

export const calcPEACout   = (arr: TitrePEA[]): number =>
  arr.reduce((s, t) => s + t.pru * t.qty, 0);

export const calcCT        = (ct: CT): number =>
  ct.actions.reduce((s, t) => s + t.cours * t.qty, 0) +
  ct.opcvm.reduce((s, o) => s + o.vl * o.parts, 0);

export const calcCTCout    = (ct: CT): number =>
  ct.actions.reduce((s, t) => s + t.pru * t.qty, 0) +
  ct.opcvm.reduce((s, o) => s + (o.vl_achat ?? o.vl) * o.parts, 0);

export const valImmo       = (b: BienImmobilier): number =>
  b.meth === 'estimatif' ? b.prixM2 * b.surface : (b.prixOffert || b.prixM2 * b.surface);

export const calcImmo      = (arr: BienImmobilier[]): number =>
  arr.reduce((s, b) => s + valImmo(b), 0);

export const valTransport  = (t: Vehicule): number =>
  t.meth === 'estimatif' ? t.valEstim : (t.prixOffert || t.valEstim);

export const calcTransport = (arr: Vehicule[]): number =>
  arr.reduce((s, t) => s + valTransport(t), 0);

export const valOr         = (o: Or, px: number): number =>
  Math.max(o.quantite * px, o.prixOffert || 0);

export const calcOr        = (arr: Or[], px: number): number =>
  arr.reduce((s, o) => s + valOr(o, px), 0);

export const totalPatrimoine = (d: PatrimoineData): number =>
  calcLiquide(d.liquidites) + calcBanque(d.banque) + calcCarnet(d.carnet) +
  calcPEA(d.pea) + calcCT(d.ct) + calcImmo(d.immobilier) +
  calcTransport(d.transport) + calcOr(d.or, d.prixOr);

export const totalCout = (d: PatrimoineData): number =>
  calcPEACout(d.pea) + calcCTCout(d.ct) +
  d.immobilier.reduce((s, b) => s + (b.prixAchat || 0), 0) +
  d.transport.reduce((s, t) => s + (t.prixAchat || 0), 0) +
  d.or.reduce((s, o) => s + (o.prixAchat || 0), 0);
