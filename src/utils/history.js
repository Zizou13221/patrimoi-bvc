/**
 * PatriMoi — Utilitaires historique patrimoine (Phase 5 DAT v1.6)
 */

/**
 * Fusionne deux tableaux d'historique en dédupliquant par date.
 * En cas de doublon, le plus récent (remoteHist prioritaire) l'emporte.
 * @param {Array<{date:string, val:number}>} localHist
 * @param {Array<{date:string, val:number}>} remoteHist
 * @param {number} maxEntries - limite max (défaut 400)
 * @returns {Array<{date:string, val:number}>} trié par date ASC, limité à maxEntries
 */
export function mergeHistory(localHist = [], remoteHist = [], maxEntries = 400) {
  const byDate = {};
  [...localHist, ...remoteHist].forEach(h => {
    if (h && h.date) byDate[h.date] = h;
  });
  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxEntries);
}

/**
 * Ajoute ou met à jour un snapshot journalier.
 * @param {Array<{date:string, val:number}>} history
 * @param {string} date - format 'YYYY-MM-DD'
 * @param {number} val
 * @param {number} maxEntries
 * @returns {Array<{date:string, val:number}>}
 */
export function upsertSnapshot(history = [], date, val, maxEntries = 400) {
  const filtered = history.filter(h => h.date !== date);
  return [...filtered, { date, val }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxEntries);
}
