/**
 * PatriMoi — API utils (Phase 3 DAT v2.0)
 *
 * Changements v3.0 :
 *   - BVC cache persisté via MMKV (synchrone) à la place d'AsyncStorage
 *   - USE_PROXY supprimé : le proxy est TOUJOURS utilisé (pas de fallback direct)
 *   - market_cache (Supabase) est la source de vérité pour BVC (mis à jour par pg_cron)
 */

import { storage } from './storage';
import { BVC_CACHE_MS, BVC_STORAGE_KEY } from '../constants/data';

const PROXY_BASE_URL   = 'https://fwgsdjhavrqrqwmydwxf.supabase.co/functions/v1/market-data-proxy';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z3NkamhhdnJxcnF3bXlkd3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNjg1MTIsImV4cCI6MjA5ODg0NDUxMn0.qAjD61kxDe374QCs90-k-rTQRWxpkPOD1tN7Ic8Vsvg';

// =========================================================
// HELPER TIMEOUT — AbortSignal.timeout non supporté par Hermes
// Crée un AbortController qui s'annule après `ms` millisecondes.
// =========================================================
function makeTimeoutSignal(ms) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  // On attache le clearTimeout au signal pour éviter les fuites
  ctrl.signal.addEventListener('abort', () => clearTimeout(tid), { once: true });
  return ctrl.signal;
}

// =========================================================
// FETCH AVEC RETRY — 3 tentatives, backoff exponentiel
// =========================================================
export async function fetchWithRetry(url, options = {}, retries = 3, baseDelay = 800) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch (e) {
      if (i === retries - 1) throw e;
    }
    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
  }
  return null;
}

// =========================================================
// HELPER PROXY INTERNE — Edge Function via fetch + Bearer
// =========================================================
async function proxyFetch(source, params = '') {
  try {
    const qs  = params ? `?source=${source}&${params}` : `?source=${source}`;
    const res = await fetchWithRetry(`${PROXY_BASE_URL}${qs}`, {
      signal:  makeTimeoutSignal(8000),
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (res) {
      const json = await res.json();
      if (__DEV__) console.log('[BVC] proxy réponse source=' + source + ' ok=', !json?.error, 'keys=', Object.keys(json || {}).join(','));
      if (!json?.error) return json;
    }
  } catch (e) {
    if (__DEV__) console.warn('[BVC] proxyFetch erreur source=' + source + ':', e?.message);
  }
  return null;
}

// =========================================================
// PRIX OR — via proxy uniquement (Edge Function)
// =========================================================
export async function fetchPrixOr() {
  const data = await proxyFetch('or');
  return data?.prixOr ?? null;
}

// =========================================================
// COURS BVC — Source : GitHub Actions (patrimoi-bvc repo)
// Flux : GitHub raw JSON (mis à jour par le workflow GH Actions)
//        → fallback proxy Supabase Edge Function
// Format GitHub : { cours: { ATW: { cours, ouverture, haut, bas, volume, date }, ... }, updated }
// =========================================================
const GITHUB_BVC_URL = 'https://raw.githubusercontent.com/Zizou13221/patrimoi-bvc/main/bvc_cours.json';

let _bvcCache = null; // { data, fetchedAt }

/**
 * Fetch BVC depuis le repo GitHub (bvc_cours.json mis à jour par GH Actions).
 * Retourne { cours: { ATW: { cours, var_pct }, ... }, updated, _source } ou null.
 */
async function fetchBVCFromGitHub() {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    let res;
    try {
      res = await fetch(GITHUB_BVC_URL, { signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }
    if (!res?.ok) {
      if (__DEV__) console.warn('[BVC] GitHub status=', res?.status);
      return null;
    }
    const json = await res.json();
    if (!json?.cours || Object.keys(json.cours).length === 0) return null;

    // Normaliser : { cours, var_pct } par ticker
    // Compatibilité : ancien format JSON utilise "variation", nouveau utilise "var_pct"
    const cours = {};
    for (const [ticker, d] of Object.entries(json.cours)) {
      if (typeof d.cours === 'number' && d.cours > 0) {
        cours[ticker] = { cours: d.cours, var_pct: d.var_pct ?? d.variation ?? 0 };
      }
    }
    if (__DEV__) console.log('[BVC] GitHub:', Object.keys(cours).length, 'tickers. ATW=', cours['ATW']?.cours, 'updated=', json.updated);
    return Object.keys(cours).length > 0
      ? { cours, updated: json.updated ?? new Date().toISOString(), _source: 'github_bvc' }
      : null;
  } catch (e) {
    if (__DEV__) console.warn('[BVC] fetchBVCFromGitHub erreur:', e?.message);
    return null;
  }
}

export async function fetchBVC(forceRefresh = false) {
  if (!forceRefresh && _bvcCache && (Date.now() - _bvcCache.fetchedAt) < BVC_CACHE_MS) {
    if (__DEV__) console.log('[BVC] cache in-memory utilisé');
    return _bvcCache.data;
  }

  // 1. GitHub Actions JSON (source principale — pas de CORS, public, no auth)
  if (__DEV__) console.log('[BVC] fetchBVC: GitHub...');
  let data = await fetchBVCFromGitHub();

  // 2. Fallback : proxy Supabase Edge Function
  if (!data?.cours || Object.keys(data.cours).length === 0) {
    if (__DEV__) console.log('[BVC] GitHub vide → proxy Supabase...');
    data = await proxyFetch('bvc');
    if (data?.cours && __DEV__) console.log('[BVC] proxy:', Object.keys(data.cours).length, 'tickers');
  }

  if (data?.cours && Object.keys(data.cours).length > 0) {
    // Si MASI absent (cas typique avec source GitHub), on le récupère séparément (AN_002)
    // Await synchrone (avec timeout 3s) pour que MASI soit dans le résultat retourné
    if (!data.cours.MASI) {
      try {
        const masiResult = await Promise.race([
          fetchMASI(),
          new Promise(resolve => setTimeout(() => resolve(null), 3000)),
        ]);
        if (masiResult) {
          data = { ...data, cours: { ...data.cours, MASI: masiResult } };
        }
      } catch (_) {}
    }
    _bvcCache = { data, fetchedAt: Date.now() };
    storage.set(BVC_STORAGE_KEY, _bvcCache);
    return data;
  }

  return null;
}

export function getBvcCache() { return _bvcCache; }
export function setBvcCache(c) { _bvcCache = c; }

// =========================================================
// MASI — via proxy Supabase (AN_002)
// Appelé pour compléter les données GitHub qui n'incluent pas l'indice MASI.
// =========================================================
export async function fetchMASI() {
  try {
    const data = await proxyFetch('masi');
    if (data && !data.error && typeof data.cours === 'number') return data;
  } catch (_) {}
  return null;
}

// =========================================================
// TAUX DE CHANGE — via proxy uniquement
// =========================================================
export async function fetchDevises(codes) {
  const raw = await proxyFetch('devises', `codes=${codes.join(',')}`);
  if (raw && !raw.error && Object.keys(raw).length > 0) return raw;
  return null;
}

// =========================================================
// APPLIQUE LES COURS BVC SUR LE STATE DATA
// (inchangé — pure function)
// =========================================================
export function applyBVCCours(data, bvcData) {
  if (!bvcData?.cours) return data;
  const c = bvcData.cours;

  const pea = data.pea.map(t =>
    c[t.ticker] ? { ...t, cours: c[t.ticker].cours } : t
  );
  const ctActions = data.ct.actions.map(t =>
    c[t.ticker] ? { ...t, cours: c[t.ticker].cours } : t
  );

  return {
    ...data,
    pea,
    ct: { ...data.ct, actions: ctActions },
    bvcUpdated: bvcData.updated ?? null,
  };
}
