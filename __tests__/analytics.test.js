/**
 * PatriMoi — Tests unitaires analytics.js
 * Vérifie que les 14 fonctions sont exportées et ne crashent pas
 * (PostHog non installé → fail-safe, posthog=null, track() est no-op)
 */

import {
  identifyUser,
  resetAnalytics,
  trackOnboardingCompleted,
  trackAccountCreated,
  trackFirstAssetAdded,
  trackThreeCategoriesFilled,
  trackBudgetFirstEntry,
  trackPaywallViewed,
  trackTrialStarted,
  trackSubscriptionStarted,
  trackSyncConflict,
  trackExportPDF,
  trackFirstSyncCompleted,
  trackScoreSanteViewed,
  trackDemoModeUsed,
  trackBvcAlertAdded,
} from '../src/utils/analytics';

// ── Exports ───────────────────────────────────────────────────────────────────

test('toutes les fonctions track sont exportées', () => {
  const fns = [
    trackOnboardingCompleted, trackAccountCreated, trackFirstAssetAdded,
    trackThreeCategoriesFilled, trackBudgetFirstEntry, trackPaywallViewed,
    trackTrialStarted, trackSubscriptionStarted, trackSyncConflict,
    trackExportPDF, trackFirstSyncCompleted, trackScoreSanteViewed,
    trackDemoModeUsed, trackBvcAlertAdded,
  ];
  expect(fns).toHaveLength(14);
  fns.forEach(fn => expect(typeof fn).toBe('function'));
});

test('identifyUser et resetAnalytics sont exportés', () => {
  expect(typeof identifyUser).toBe('function');
  expect(typeof resetAnalytics).toBe('function');
});

// ── No-crash (posthog=null) ───────────────────────────────────────────────────

test('trackOnboardingCompleted — pas de crash', () => {
  expect(() => trackOnboardingCompleted()).not.toThrow();
});

test('trackAccountCreated — pas de crash', () => {
  expect(() => trackAccountCreated()).not.toThrow();
});

test('trackFirstAssetAdded — pas de crash avec catégorie', () => {
  expect(() => trackFirstAssetAdded('pea')).not.toThrow();
});

test('trackPaywallViewed — pas de crash avec trigger', () => {
  expect(() => trackPaywallViewed('pdf_export')).not.toThrow();
});

test('trackSubscriptionStarted — pas de crash avec période', () => {
  expect(() => trackSubscriptionStarted('monthly')).not.toThrow();
});

test('trackExportPDF — pas de crash avec type', () => {
  expect(() => trackExportPDF('patrimoine')).not.toThrow();
  expect(() => trackExportPDF('budget')).not.toThrow();
});

test('trackScoreSanteViewed — pas de crash avec score', () => {
  expect(() => trackScoreSanteViewed(80)).not.toThrow();
  expect(() => trackScoreSanteViewed(50)).not.toThrow();
  expect(() => trackScoreSanteViewed(20)).not.toThrow();
});

test('identifyUser — pas de crash avec uuid', () => {
  expect(() => identifyUser('abc-123')).not.toThrow();
});

test('identifyUser — pas de crash avec null', () => {
  expect(() => identifyUser(null)).not.toThrow();
});

test('resetAnalytics — pas de crash', () => {
  expect(() => resetAnalytics()).not.toThrow();
});
