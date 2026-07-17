/**
 * PatriMoi — Zod schemas (Phase 3 DAT v2.0)
 * Validation aux frontières : réponse DB + réponse Edge Function
 */

import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

const DeviseSchema = z.object({
  code:      z.string(),
  nom:       z.string(),
  quantite:  z.number(),
  taux:      z.number(),
  variation: z.number(),
});

const LiquiditesSchema = z.object({
  dh:      z.number(),
  devises: z.array(DeviseSchema),
});

const CompteBanqueSchema = z.object({
  banque:  z.string(),
  solde:   z.number(),
  compte:  z.string(),
});

const RappelSchema = z.object({
  montant:   z.number(),
  freq:      z.string(),
  prochaine: z.string(),
});

const CarnetEpargneSchema = z.object({
  banque:  z.string(),
  solde:   z.number(),
  taux:    z.number(),
  rappel:  RappelSchema.optional(),
});

const TitrePEASchema = z.object({
  ticker: z.string(),
  nom:    z.string(),
  pru:    z.number(),
  cours:  z.number(),
  qty:    z.number(),
});

const TitreCTSchema = TitrePEASchema;

const OPCVMSchema = z.object({
  code:     z.string(),
  nom:      z.string(),
  vl:       z.number(),
  vl_achat: z.number().optional(),
  parts:    z.number(),
  type:     z.string(),
});

const CTSchema = z.object({
  actions: z.array(TitreCTSchema),
  opcvm:   z.array(OPCVMSchema),
});

const MethodeValuationSchema = z.enum(['estimatif', 'offert']);

const BienImmobilierSchema = z.object({
  id:         z.number(),
  nom:        z.string(),
  type:       z.string(),
  ville:      z.string(),
  surface:    z.number(),
  unite:      z.string(),
  prixAchat:  z.number(),
  datAchat:   z.string(),
  prixM2:     z.number(),
  prixOffert: z.number().nullable(),
  meth:       MethodeValuationSchema,
});

const VehiculeSchema = z.object({
  id:         z.number(),
  nom:        z.string(),
  type:       z.string(),
  annee:      z.number(),
  immat:      z.string(),
  prixAchat:  z.number(),
  dateAchat:  z.string(),
  valEstim:   z.number(),
  prixOffert: z.number().nullable(),
  meth:       MethodeValuationSchema,
});

const OrSchema = z.object({
  id:         z.number(),
  nom:        z.string(),
  quantite:   z.number(),
  unite:      z.string(),
  prixAchat:  z.number(),
  prixOffert: z.number().nullable(),
});

// ── Données patrimoine ─────────────────────────────────────────────────────────

export const PatrimoineDataSchema = z.object({
  schemaVersion: z.number().optional(),
  liquidites:    LiquiditesSchema,
  banque:        z.array(CompteBanqueSchema),
  carnet:        z.array(CarnetEpargneSchema),
  pea:           z.array(TitrePEASchema),
  ct:            CTSchema,
  immobilier:    z.array(BienImmobilierSchema),
  transport:     z.array(VehiculeSchema),
  or:            z.array(OrSchema),
  prixOr:        z.number(),
  lastUpdate:    z.string(),
  bvcUpdated:    z.string().nullable().optional(),
});

// ── Réponse DB (row patrimoine_data) ─────────────────────────────────────────

export const DbPatrimoineRowSchema = z.object({
  data:       PatrimoineDataSchema,
  updated_at: z.string().optional(),
});

// ── Réponse Edge Function BVC ─────────────────────────────────────────────────

const CoursEntrySchema = z.object({
  cours:    z.number(),
  variation:z.number().optional(),
});

export const BvcResponseSchema = z.object({
  cours:   z.record(z.string(), CoursEntrySchema),
  updated: z.string().optional(),
  source:  z.string().optional(),
});

// ── Réponse Edge Function Or ──────────────────────────────────────────────────

export const OrResponseSchema = z.object({
  prixOr: z.number(),
  source: z.string().optional(),
});

// ── Réponse Edge Function Devises ────────────────────────────────────────────

export const DevisesResponseSchema = z.record(z.string(), z.number());

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse safely — retourne null si invalide (pas de crash)
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (__DEV__) console.warn('[PatriMoi][Zod]', result.error.issues);
    return null;
  }
  return result.data;
}
