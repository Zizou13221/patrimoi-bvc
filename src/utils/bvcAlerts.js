/**
 * PatriMoi — Alertes cours BVC
 *
 * Logique :
 *   - loadAlerts / saveAlerts : CRUD sur MMKV
 *   - checkAndFireAlerts(bvcData, onFire) : appelé après chaque refresh BVC
 *   - fireAlertNotification : notification locale iOS (PushNotificationIOS)
 *
 * Format alerte : { id, ticker, seuilHaut, seuilBas, enabled }
 * Cooldown : 4h entre deux déclenchements identiques (ticker + type)
 */

import { storage } from './storage';

const ALERTS_KEY = '@patrimoi_bvc_alerts';
const FIRED_KEY  = '@patrimoi_bvc_alerts_fired';
const COOLDOWN   = 4 * 60 * 60 * 1000; // 4h

export function loadAlerts()    { return storage.get(ALERTS_KEY) || []; }
export function saveAlerts(arr) { storage.set(ALERTS_KEY, arr); }

/**
 * Vérifie les cours contre les seuils et appelle onFire pour chaque déclenchement.
 * onFire(ticker, seuilHaut|seuilBas, type, cours, seuil)
 */
export function checkAndFireAlerts(bvcData, onFire) {
  if (!bvcData?.cours || typeof onFire !== 'function') return;

  const alerts  = loadAlerts();
  if (!alerts.length) return;

  const fired   = storage.get(FIRED_KEY) || {};
  const now     = Date.now();
  let   changed = false;

  for (const alert of alerts) {
    if (!alert.enabled) continue;
    const entry = bvcData.cours[alert.ticker];
    if (!entry || typeof entry.cours !== 'number') continue;
    const cours = entry.cours;

    // ── Seuil haut ────────────────────────────────────────
    if (alert.seuilHaut > 0 && cours >= alert.seuilHaut) {
      const key = `${alert.ticker}_haut`;
      if (!fired[key] || now - fired[key] > COOLDOWN) {
        fired[key] = now;
        changed    = true;
        onFire(alert.ticker, alert.seuilHaut, 'haut', cours, alert.seuilHaut);
      }
    }

    // ── Seuil bas ─────────────────────────────────────────
    if (alert.seuilBas > 0 && cours <= alert.seuilBas) {
      const key = `${alert.ticker}_bas`;
      if (!fired[key] || now - fired[key] > COOLDOWN) {
        fired[key] = now;
        changed    = true;
        onFire(alert.ticker, alert.seuilBas, 'bas', cours, alert.seuilBas);
      }
    }
  }

  if (changed) storage.set(FIRED_KEY, fired);
}

/**
 * Déclenche une notification locale iOS immédiate.
 * Utilise le même pattern try/catch que PageParams.
 */
export function fireAlertNotification(ticker, _seuilRef, type, cours, seuil) {
  try {
    let PNI = null;
    try {
      PNI = require('@react-native-community/push-notification-ios').default;
    } catch {
      try { PNI = require('react-native').PushNotificationIOS; } catch {}
    }
    if (!PNI || typeof PNI.presentLocalNotification !== 'function') return;

    const arrow = type === 'haut' ? '📈' : '📉';
    const verb  = type === 'haut' ? 'dépassé' : 'passé sous';
    PNI.presentLocalNotification({
      alertTitle: `${arrow} PatriMoi — Alerte ${ticker}`,
      alertBody:  `${ticker} a ${verb} ${seuil.toLocaleString('fr-FR')} DH (cours actuel : ${cours.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 })} DH)`,
      soundName:  'default',
    });
  } catch {}
}
