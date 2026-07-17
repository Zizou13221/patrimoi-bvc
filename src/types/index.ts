/**
 * PatriMoi — Interfaces TypeScript (Phase 3 DAT v2.0)
 * Source de vérité pour tous les types de l'app.
 */

// ── Actifs ────────────────────────────────────────────────────
export interface Devise {
  code: string;
  nom: string;
  quantite: number;
  taux: number;
  variation: number;
}

export interface Liquidites {
  dh: number;
  devises: Devise[];
}

export interface CompteBanque {
  banque: string;
  solde: number;
  compte: string;
}

export interface Rappel {
  montant: number;
  freq: string;
  prochaine: string;
}

export interface CarnetEpargne {
  banque: string;
  solde: number;
  taux: number;
  rappel?: Rappel;
}

export interface TitrePEA {
  ticker: string;
  nom: string;
  pru: number;
  cours: number;
  qty: number;
}

export interface TitreCT {
  ticker: string;
  nom: string;
  pru: number;
  cours: number;
  qty: number;
}

export interface OPCVM {
  code: string;
  nom: string;
  vl: number;
  vl_achat?: number;
  parts: number;
  type: string;
}

export interface CT {
  actions: TitreCT[];
  opcvm: OPCVM[];
}

export type MethodeValuation = 'estimatif' | 'offert';

export interface BienImmobilier {
  id: number;
  nom: string;
  type: string;
  ville: string;
  surface: number;
  unite: string;
  prixAchat: number;
  datAchat: string;
  prixM2: number;
  prixOffert: number | null;
  meth: MethodeValuation;
}

export interface Vehicule {
  id: number;
  nom: string;
  type: string;
  annee: number;
  immat: string;
  prixAchat: number;
  dateAchat: string;
  valEstim: number;
  prixOffert: number | null;
  meth: MethodeValuation;
}

export interface Or {
  id: number;
  nom: string;
  quantite: number;
  unite: string;
  prixAchat: number;
  prixOffert: number | null;
}

// ── Données patrimoine ────────────────────────────────────────
export interface PatrimoineData {
  schemaVersion?: number;
  liquidites: Liquidites;
  banque: CompteBanque[];
  carnet: CarnetEpargne[];
  pea: TitrePEA[];
  ct: CT;
  immobilier: BienImmobilier[];
  transport: Vehicule[];
  or: Or[];
  prixOr: number;
  lastUpdate: string;
  bvcUpdated?: string | null;
  _history?: HistoryEntry[];
}

// ── Historique ────────────────────────────────────────────────
export interface HistoryEntry {
  date: string;   // 'YYYY-MM-DD'
  val: number;
}

export interface Objectif {
  montant: number;
  label?: string;
  date?: string;
}

// ── Auth ──────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

// ── Store ─────────────────────────────────────────────────────
export type Page = 'proverbe' | 'dashboard' | 'actifs' | 'conseils' | 'apropos' | 'params';
export type BvcStatus = 'loading' | 'ok' | 'error';
