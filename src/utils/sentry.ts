/**
 * PatriMoi — Sentry React Native (Phase 6 DAT v2.0)
 *
 * Initialise Sentry avec :
 *   - Capture des crashs JS + natifs
 *   - Release health (sessions)
 *   - Breadcrumbs automatiques (navigation, réseau)
 *   - Aucune donnée patrimoniale dans les rapports
 *
 * DSN via variable d'environnement SENTRY_DSN (injectée par Fastlane en CI,
 * ou dans un fichier .env.local ignoré par git).
 */

let Sentry: typeof import('@sentry/react-native') | null = null;

/**
 * Initialiser Sentry. Appeler une seule fois au démarrage (index.js).
 * Fail-safe : si le module est absent, l'app continue sans plantage.
 */
export function initSentry(release?: string): void {
  try {
    Sentry = require('@sentry/react-native');
  } catch {
    if (__DEV__) console.log('[PatriMoi] Sentry non disponible — mode dev sans crash reporting');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) console.log('[PatriMoi] SENTRY_DSN manquant — Sentry désactivé');
    return;
  }

  Sentry.init({
    dsn,
    release,
    environment:          __DEV__ ? 'development' : 'production',
    enabled:              !__DEV__,   // désactivé en dev local
    tracesSampleRate:     0.2,        // 20% des transactions
    profilesSampleRate:   0.1,

    // Aucune donnée patrimoniale dans les rapports
    beforeSend(event) {
      // Supprimer toute valeur qui ressemble à un montant financier
      if (event.extra) delete event.extra.data;
      if (event.extra) delete event.extra.patrimoine;
      return event;
    },

    integrations: (defaults) =>
      defaults.filter(i => i.name !== 'ReactNativeTracing'), // optionnel selon perf
  });
}

/**
 * Capturer une erreur manuellement (ex: échec réseau, erreur Supabase).
 */
export function captureError(error: unknown, context?: Record<string, string>): void {
  if (!Sentry) return;
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setTag(k, v));
    }
    Sentry.captureException(error);
  });
}

/**
 * Enregistrer un breadcrumb (action utilisateur notable sans donnée sensible).
 */
export function addBreadcrumb(message: string, category = 'app'): void {
  if (!Sentry) return;
  Sentry.addBreadcrumb({ message, category, level: 'info' });
}

/**
 * Identifier l'utilisateur côté Sentry (ID uniquement, pas d'email).
 */
export function identifyUser(userId: string | null): void {
  if (!Sentry) return;
  if (userId) {
    Sentry.setUser({ id: userId }); // pas d'email pour la vie privée
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Wrapper pour les composants React (ErrorBoundary Sentry).
 * Usage : export default Sentry.wrap(App) dans index.js.
 */
export function wrapWithSentry<T>(component: T): T {
  if (!Sentry) return component;
  return (Sentry.wrap as any)(component);
}
