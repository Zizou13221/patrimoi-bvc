/**
 * PatriMoi — Module Analytics (PostHog)
 *
 * Self-hosted PostHog EU (Fly.io) — conforme CNDP/RGPD
 * Aucune donnée personnelle (email, prénom, montants) n'est envoyée.
 * Seuls des événements comportementaux anonymisés sont trackés.
 *
 * Setup :
 *   1. Déployer PostHog sur Fly.io (EU) : https://fly.io/docs/getting-started/
 *   2. Remplacer POSTHOG_HOST par l'URL de votre instance
 *   3. Remplacer POSTHOG_API_KEY par votre Project API Key
 *   4. npm install posthog-react-native
 *
 * Référence : https://posthog.com/docs/libraries/react-native
 */

// ── Configuration ─────────────────────────────────────────
// TODO: remplacer par votre instance PostHog self-hosted
const POSTHOG_HOST    = 'https://posthog.votre-instance.fly.dev'; // self-hosted EU
const POSTHOG_API_KEY = 'phc_VOTRE_CLE_ICI';                     // Project API Key (non secrète)

// ── Initialisation PostHog ─────────────────────────────────
let posthog = null;

try {
  const PostHog = require('posthog-react-native');
  posthog = new PostHog(POSTHOG_API_KEY, {
    host:               POSTHOG_HOST,
    captureMode:        'form',     // envoie les events en POST form (pas de XHR)
    flushAt:            5,          // batch de 5 events avant envoi
    flushInterval:      30 * 1000,  // flush toutes les 30s si batch non atteint
    optOut:             false,
    // Désactiver la capture automatique de session/écran — on le fait manuellement
    captureNativeAppLifecycleEvents:  false,
    captureDeepLinks:                 false,
    sendFeatureFlagEvent:             false,
  });
  posthog.identify('$anonymous'); // anonyme par défaut, identifié après login
} catch {
  // PostHog non installé — pas de tracking (fail-safe, silence volontaire)
}

// ── Helper interne ─────────────────────────────────────────
function track(event, properties = {}) {
  if (!posthog) return;
  try {
    // Ne jamais envoyer de données financières ou personnelles
    posthog.capture(event, {
      ...properties,
      $set_once: { platform: 'ios' },
    });
  } catch (e) {
    // fail silently
  }
}

// ── Identification (après login/register) ─────────────────
export function identifyUser(userId) {
  if (!posthog || !userId) return;
  try {
    // On envoie uniquement l'UUID Supabase (aucun email ni nom)
    posthog.identify(userId);
  } catch {}
}

// ── Reset (après logout/suppression) ─────────────────────
export function resetAnalytics() {
  if (!posthog) return;
  try { posthog.reset(); } catch {}
}

// ══════════════════════════════════════════════════════════
// 14 ÉVÉNEMENTS CLÉS — À brancher dans les pages
// ══════════════════════════════════════════════════════════

/**
 * E01 — Onboarding terminé (arrivée à PageAuth depuis PageOnboarding)
 * Brancher dans : PatriMoi_Native.jsx → onDone de PageOnboarding
 */
export function trackOnboardingCompleted() {
  track('onboarding_completed');
}

/**
 * E02 — Compte créé (inscription réussie)
 * Brancher dans : PageAuth.jsx → handleRegister (après succès signUp)
 */
export function trackAccountCreated() {
  track('account_created');
}

/**
 * E03 — Premier actif ajouté (toute catégorie)
 * Brancher dans : patrimoineStore.js → setData (quand total passe de 0 à >0)
 * ou dans chaque PageActif au moment du premier save.
 * @param {string} category — 'liquidites'|'banque'|'pea'|'ct'|'or'|'immobilier'|'transport'|'carnet'
 */
export function trackFirstAssetAdded(category) {
  track('first_asset_added', { category });
}

/**
 * E04 — 3 catégories renseignées (engagement)
 * Brancher dans : patrimoineStore.js → setData
 * Condition : compter les catégories non vides
 */
export function trackThreeCategoriesFilled() {
  track('three_categories_filled');
}

/**
 * E05 — Première saisie budget
 * Brancher dans : PageSuiviBudget.jsx → handleAddOperation (première fois)
 */
export function trackBudgetFirstEntry() {
  track('budget_first_entry');
}

/**
 * E06 — Paywall affiché (écran PatriMoi+ vu)
 * Brancher dans : tout endroit où le mur d'abonnement est montré
 * @param {string} trigger — ex: 'pdf_export'|'snapshots'|'bvc_alerts'
 */
export function trackPaywallViewed(trigger) {
  track('paywall_viewed', { trigger });
}

/**
 * E07 — Essai démarré (trial started)
 * Brancher dans : gestion StoreKit → après purchase réussie d'un trial
 */
export function trackTrialStarted() {
  track('trial_started');
}

/**
 * E08 — Abonnement actif (subscription_started)
 * Brancher dans : gestion StoreKit → après purchase/restore réussie
 * @param {string} period — 'monthly'|'annual'
 */
export function trackSubscriptionStarted(period = 'monthly') {
  track('subscription_started', { period });
}

/**
 * E09 — Conflit de sync détecté (outbox pattern)
 * Brancher dans : syncQueue.js → quand un conflit last-write-wins est résolu
 */
export function trackSyncConflict() {
  track('sync_conflict');
}

/**
 * E10 — Export PDF généré
 * Brancher dans : PageParams.jsx → handleExportPatrimoinePDF + handleExportBudgetPDF
 * @param {string} type — 'patrimoine'|'budget'
 */
export function trackExportPDF(type = 'patrimoine') {
  track('export_pdf', { type });
}

/**
 * E11 — Premier sync cloud réussi
 * Brancher dans : auth.js → savePatrimoineData (première fois avec succès)
 */
export function trackFirstSyncCompleted() {
  track('first_sync_completed');
}

/**
 * E12 — Score santé patrimoniale consulté
 * Brancher dans : PageConseils.jsx → useEffect ou onLayout de la section score
 */
export function trackScoreSanteViewed(score) {
  // On envoie le bucket de score (pas la valeur exacte pour préserver la vie privée)
  const bucket = score >= 75 ? 'excellent' : score >= 50 ? 'passable' : 'a_ameliorer';
  track('score_sante_viewed', { bucket });
}

/**
 * E13 — Mode démo utilisé (choix de continuer sans compte)
 * Brancher dans : PageAuth.jsx → onPress du bouton mode démo
 */
export function trackDemoModeUsed() {
  track('demo_mode_used');
}

/**
 * E14 — Alerte BVC ajoutée
 * Brancher dans : PageParams.jsx → handleSaveAlert
 */
export function trackBvcAlertAdded() {
  track('bvc_alert_added');
}
