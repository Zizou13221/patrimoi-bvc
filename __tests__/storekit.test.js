/**
 * PatriMoi — Tests unitaires storekit.js
 * Vérifie le comportement en mode SUBSCRIPTION_ENABLED=false (phase lancement)
 */

import {
  SUBSCRIPTION_ENABLED,
  PRODUCT_ID,
  checkSubscriptionStatus,
  purchaseSubscription,
  initIAP,
} from '../src/utils/storekit';

// ── Constantes ────────────────────────────────────────────────────────────────

test('SUBSCRIPTION_ENABLED est false (mode lancement)', () => {
  expect(SUBSCRIPTION_ENABLED).toBe(false);
});

test('PRODUCT_ID est correctement défini', () => {
  expect(PRODUCT_ID).toBe('com.patrimoi.plus.monthly');
});

// ── checkSubscriptionStatus en mode désactivé ─────────────────────────────────

test('checkSubscriptionStatus — retourne isPremium:true quand désactivé', async () => {
  const result = await checkSubscriptionStatus();
  expect(result.isPremium).toBe(true);
  expect(result.error).toBe(null);
  expect(result.expiresDate).toBe(null);
});

// ── purchaseSubscription en mode désactivé ────────────────────────────────────

test('purchaseSubscription — retourne erreur lisible quand désactivé', async () => {
  const result = await purchaseSubscription();
  expect(result.purchase).toBe(null);
  expect(typeof result.error).toBe('string');
  expect(result.error.length).toBeGreaterThan(0);
});

// ── initIAP en mode désactivé ─────────────────────────────────────────────────

test('initIAP — retourne ok:false quand désactivé', async () => {
  const result = await initIAP();
  expect(result.ok).toBe(false);
  expect(typeof result.error).toBe('string');
});

// ── Pas de crash sur imports multiples ────────────────────────────────────────

test('module importable sans crash', () => {
  expect(() => require('../src/utils/storekit')).not.toThrow();
});
