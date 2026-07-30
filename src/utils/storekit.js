/**
 * PatriMoi — StoreKit / IAP
 *
 * Utilise react-native-iap (StoreKit 2 sur iOS 15+).
 * Fail-safe : si le module n'est pas installé, toutes les fonctions retournent
 * des résultats neutres — l'app ne crashe pas.
 *
 * Product ID App Store Connect : com.patrimoi.plus.monthly
 * Prix affiché : 49 DH / mois (localisation App Store Connect)
 *
 * Grace period : on lit expires_date_ms depuis le receipt, PAS l'événement
 * payment — tolérance 3 jours accordée si le renouvellement échoue.
 *
 * Installation :
 *   npm install react-native-iap
 *   cd ios && pod install
 *   Ajouter StoreKit.framework dans Xcode (automatique avec react-native-iap)
 */

import { Platform } from 'react-native';

// ── Constantes ────────────────────────────────────────────────────────────────
export const PRODUCT_ID         = 'com.patrimoi.plus.monthly';
const GRACE_PERIOD_MS           = 3 * 24 * 60 * 60 * 1000; // 3 jours

// ── Mode lancement : abonnement désactivé ─────────────────────────────────────
// Mettre à true quand l'IAP est configuré dans App Store Connect et prêt à facturer.
// false = tous les utilisateurs ont accès PatriMoi+ sans payer pendant cette phase.
export const SUBSCRIPTION_ENABLED = false;

// ── Résolution module ─────────────────────────────────────────────────────────
let RNIap = null;
try {
  RNIap = require('react-native-iap');
} catch {
  // Module non installé — toutes les fonctions renvoient des résultats neutres
}

const noop = () => Promise.resolve({ error: 'react-native-iap non installé — npm install react-native-iap' });

// ── Initialisation ────────────────────────────────────────────────────────────
/**
 * initIAP()
 * À appeler une fois au démarrage (App.js), après auth.
 * Retourne { ok, error }.
 */
export async function initIAP() {
  if (!SUBSCRIPTION_ENABLED) return { ok: false, error: 'abonnement désactivé' };
  if (!RNIap || Platform.OS !== 'ios') return { ok: false, error: 'ios uniquement' };
  try {
    await RNIap.initConnection();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Erreur initConnection' };
  }
}

/**
 * endIAP()
 * À appeler dans le cleanup (useEffect return) pour libérer la connexion StoreKit.
 */
export async function endIAP() {
  if (!RNIap || Platform.OS !== 'ios') return;
  try { await RNIap.endConnection(); } catch {}
}

// ── Produits ──────────────────────────────────────────────────────────────────
/**
 * fetchProducts()
 * Retourne { products: [...], error }.
 * products[0].localizedPrice contient le prix localisé (ex : "49,00 MAD").
 */
export async function fetchProducts() {
  if (!RNIap || Platform.OS !== 'ios') return { products: [], error: 'ios uniquement' };
  try {
    const products = await RNIap.getSubscriptions({ skus: [PRODUCT_ID] });
    return { products, error: null };
  } catch (e) {
    return { products: [], error: e?.message || 'Erreur fetchProducts' };
  }
}

// ── Achat ─────────────────────────────────────────────────────────────────────
/**
 * purchaseSubscription()
 * Lance le flux d'achat StoreKit.
 * Retourne { purchase, error }.
 *
 * Après un achat réussi, appeler finalizePurchase(purchase) puis
 * checkSubscriptionStatus() pour mettre à jour isPremium.
 */
export async function purchaseSubscription() {
  if (!SUBSCRIPTION_ENABLED) return { purchase: null, error: 'Paiement non encore disponible.' };
  if (!RNIap || Platform.OS !== 'ios') return noop();
  try {
    const purchase = await RNIap.requestSubscription({ sku: PRODUCT_ID });
    return { purchase, error: null };
  } catch (e) {
    // E_USER_CANCELLED = l'utilisateur a annulé, pas une vraie erreur
    if (e?.code === 'E_USER_CANCELLED') return { purchase: null, error: null };
    return { purchase: null, error: e?.message || 'Erreur achat' };
  }
}

/**
 * finalizePurchase(purchase)
 * Acknowledge la transaction côté StoreKit (obligatoire — sinon remboursement auto à 24h).
 */
export async function finalizePurchase(purchase) {
  if (!RNIap || !purchase) return;
  try {
    await RNIap.finishTransaction({ purchase, isConsumable: false });
  } catch {}
}

// ── Restauration ──────────────────────────────────────────────────────────────
/**
 * restorePurchases()
 * Retourne { purchases: [...], error }.
 * Filtrer sur PRODUCT_ID pour vérifier si PatriMoi+ est actif.
 */
export async function restorePurchases() {
  if (!RNIap || Platform.OS !== 'ios') return { purchases: [], error: 'ios uniquement' };
  try {
    const purchases = await RNIap.getAvailablePurchases();
    return { purchases, error: null };
  } catch (e) {
    return { purchases: [], error: e?.message || 'Erreur restauration' };
  }
}

// ── Statut abonnement ─────────────────────────────────────────────────────────
/**
 * checkSubscriptionStatus()
 * Vérifie si PatriMoi+ est actif en lisant les achats disponibles.
 * Retourne { isPremium: boolean, expiresDate: Date|null, error }.
 *
 * Grace period : si expires_date_ms est dans les 3 prochains jours (renouvellement
 * en cours), on considère toujours Premium pour éviter une interruption brutale.
 *
 * ⚠️ Validation côté serveur recommandée en production (via Supabase Edge Function)
 *    pour éviter la manipulation du receipt côté client.
 */
export async function checkSubscriptionStatus() {
  // Phase lancement : accès gratuit à toutes les features PatriMoi+
  if (!SUBSCRIPTION_ENABLED) {
    return { isPremium: true, expiresDate: null, error: null };
  }
  if (!RNIap || Platform.OS !== 'ios') {
    return { isPremium: false, expiresDate: null, error: 'ios uniquement' };
  }
  try {
    const purchases = await RNIap.getAvailablePurchases();

    // Filtrer sur notre produit
    const subs = purchases.filter(p => p.productId === PRODUCT_ID);
    if (subs.length === 0) {
      return { isPremium: false, expiresDate: null, error: null };
    }

    // Lire expires_date_ms depuis le receipt (pas l'événement payment)
    // react-native-iap expose transactionReceipt (base64) ou les champs décodés
    // selon la version. On tente les deux.
    const now = Date.now();
    let latestExpiry = 0;

    for (const sub of subs) {
      // Champ direct (react-native-iap v8+)
      if (sub.expirationDate) {
        const exp = new Date(sub.expirationDate).getTime();
        if (exp > latestExpiry) latestExpiry = exp;
        continue;
      }
      // Fallback : decoder le receipt JSON (react-native-iap v7)
      if (sub.transactionReceipt) {
        try {
          const decoded = JSON.parse(sub.transactionReceipt);
          const latest  = decoded?.latest_receipt_info?.[0];
          if (latest?.expires_date_ms) {
            const exp = parseInt(latest.expires_date_ms, 10);
            if (exp > latestExpiry) latestExpiry = exp;
          }
        } catch {}
      }
    }

    if (latestExpiry === 0) {
      // Receipt sans expires_date — considérer actif (achat récent sans expiry encore)
      return { isPremium: true, expiresDate: null, error: null };
    }

    // Grace period : actif si expiré depuis moins de 3 jours
    const isPremium  = latestExpiry + GRACE_PERIOD_MS > now;
    const expiresDate = new Date(latestExpiry);
    return { isPremium, expiresDate, error: null };

  } catch (e) {
    return { isPremium: false, expiresDate: null, error: e?.message || 'Erreur checkSubscription' };
  }
}
