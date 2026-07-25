// =========================================================
// HELPERS DE FORMATAGE
// =========================================================

export const fmt     = (n) => Math.round(n).toLocaleString('fr-FR') + ' DH';
export const fmtN    = (n) => Math.round(n).toLocaleString('fr-FR');
export const fmtCours = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
export const pctDiff = (v, base) => base === 0 ? 0 : (v - base) / base * 100;
export const fmtDate = () => new Date().toLocaleString('fr-FR', {
  day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
});
