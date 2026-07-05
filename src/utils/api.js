import AsyncStorage from '@react-native-async-storage/async-storage';
import { BVC_COURS_URL, BVC_CACHE_MS, BVC_STORAGE_KEY } from '../constants/data';

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
    // backoff : 800ms, 1600ms, 3200ms
    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
  }
  return null;
}

// =========================================================
// API COURS OR EN TEMPS RÉEL
// =========================================================
export async function fetchPrixOr() {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetchWithRetry('https://api.metals.live/v1/spot/gold', { signal: AbortSignal.timeout(6000) }),
      fetchWithRetry('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) }),
    ]);
    if (!goldRes || !fxRes) return null;
    const goldData = await goldRes.json();
    const fxData   = await fxRes.json();
    const goldUSD  = Array.isArray(goldData) ? goldData[0]?.gold : goldData?.gold;
    const usdMad   = fxData?.rates?.MAD;
    if (!goldUSD || !usdMad) return null;
    // 1 troy once = 31.1035 g → prix par gramme en DH
    return Math.round((goldUSD / 31.1035) * usdMad);
  } catch {
    return null;
  }
}

// =========================================================
// API COURS BVC — cache 30 min + persistance AsyncStorage
// =========================================================
let _bvcCache = null; // { data, fetchedAt }

export async function fetchBVC(forceRefresh = false) {
  if (!forceRefresh && _bvcCache && (Date.now() - _bvcCache.fetchedAt) < BVC_CACHE_MS) {
    return _bvcCache.data;
  }
  try {
    const res = await fetchWithRetry(BVC_COURS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res) return null;
    const json = await res.json();
    if (!json?.cours || typeof json.cours !== 'object') return null;
    _bvcCache = { data: json, fetchedAt: Date.now() };
    // Persist cache : survit au redémarrage de l'app
    AsyncStorage.setItem(BVC_STORAGE_KEY, JSON.stringify(_bvcCache)).catch(() => {});
    return json;
  } catch {
    return null;
  }
}

export function getBvcCache() { return _bvcCache; }
export function setBvcCache(c) { _bvcCache = c; }

// =========================================================
// APPLIQUE LES COURS BVC SUR LE STATE DATA
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
