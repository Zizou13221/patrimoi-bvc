/**
 * PatriMoi — Tests unitaires fmt.js
 * Formatage : montants DH, pourcentages, nombres
 *
 * Note : les tests de chaîne évitent les comparaisons strictes sur les
 * séparateurs (espace insécable fr-FR varie selon les données ICU du runtime).
 */

import { fmt, fmtN, fmtCours, pctDiff } from '../src/utils/fmt';

// ── fmt ───────────────────────────────────────────────────────────────────────

test('fmt — se termine par " DH"', () => {
  expect(fmt(5000)).toMatch(/ DH$/);
});

test('fmt — zéro retourne "0 DH"', () => {
  expect(fmt(0)).toBe('0 DH');
});

test('fmt — arrondit correctement (1500.7 → 1501)', () => {
  const r = fmt(1500.7);
  expect(r).toContain('1');
  expect(r).toContain('501');
  expect(r).toContain('DH');
});

test('fmt — grand nombre contient les bons chiffres', () => {
  const r = fmt(1000000);
  expect(r).toContain('1');
  expect(r).toContain('000');
  expect(r).toMatch(/ DH$/);
});

// ── fmtN ──────────────────────────────────────────────────────────────────────

test('fmtN — ne contient pas "DH"', () => {
  expect(fmtN(1000)).not.toContain('DH');
});

test('fmtN — arrondit (999.9 → 1000)', () => {
  const r = fmtN(999.9);
  expect(r).toContain('1');
  expect(r).toContain('000');
});

test('fmtN — zéro retourne "0"', () => {
  expect(fmtN(0)).toBe('0');
});

// ── fmtCours ─────────────────────────────────────────────────────────────────

test('fmtCours — se termine par " DH"', () => {
  expect(fmtCours(681)).toMatch(/ DH$/);
});

test('fmtCours — contient "681"', () => {
  expect(fmtCours(681)).toContain('681');
});

test('fmtCours — contient 2 chiffres après le séparateur décimal', () => {
  const r = fmtCours(681);
  // fr-FR utilise ',' comme séparateur décimal — on vérifie ,00 ou .00
  expect(r).toMatch(/681[,.]00/);
});

// ── pctDiff ──────────────────────────────────────────────────────────────────

test('pctDiff — base zéro → 0 (pas de division par zéro)', () => {
  expect(pctDiff(100, 0)).toBe(0);
});

test('pctDiff — hausse 50%', () => {
  expect(pctDiff(150, 100)).toBe(50);
});

test('pctDiff — baisse 25%', () => {
  expect(pctDiff(75, 100)).toBe(-25);
});

test('pctDiff — variation nulle', () => {
  expect(pctDiff(100, 100)).toBe(0);
});

test('pctDiff — doublement (+100%)', () => {
  expect(pctDiff(200, 100)).toBe(100);
});

test('pctDiff — moitié (-50%)', () => {
  expect(pctDiff(50, 100)).toBe(-50);
});
