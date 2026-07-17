/**
 * PatriMoi — Supabase Edge Function : market-data-proxy
 * Phase 2 DAT v2.0 — lit market_cache (Supabase) en priorité
 *
 * Routes (query param ?source=):
 *   or      → api.metals.live + open.er-api.com  → { prixOr: number }
 *   devises → open.er-api.com                    → { [code]: number }
 *   bvc     → market_cache (Supabase) ou GitHub raw → { cours: {...}, updated: string }
 *
 * BVC : lecture market_cache d'abord (mis à jour par pg_cron via market-data-proxy-ingest).
 *       Si absent/périmé (> 30 min), fetch GitHub raw + écriture dans market_cache.
 *
 * Deploy: supabase functions deploy market-data-proxy
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

// ── Sentry (Phase 6 DAT v2.0) ─────────────────────────────────────────────────
const SENTRY_DSN = Deno.env.get('SENTRY_DSN_EDGE');
if (SENTRY_DSN) {
  Sentry.init({
    dsn:              SENTRY_DSN,
    environment:      Deno.env.get('ENVIRONMENT') ?? 'production',
    tracesSampleRate: 0.1,
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Validation JWT (Phase 1 DAT v2.0) ────────────────────────────────────────
// verify_jwt = true est activé dans supabase/config.toml (défaut Supabase).
// Cette fonction valide en plus que le token appartient à un utilisateur réel
// et applique un rate-limit léger pour les appels non-authentifiés (démo).
async function validateRequest(req: Request): Promise<{ ok: boolean; isDemo: boolean; userId: string | null }> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return { ok: false, isDemo: false, userId: null };

  // Token anon pur (démo) : autorisé mais marqué
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (token === anonKey) {
    return { ok: true, isDemo: true, userId: null };
  }

  // Token JWT utilisateur — vérification via Supabase
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { ok: false, isDemo: false, userId: null };
    return { ok: true, isDemo: false, userId: user.id };
  } catch {
    return { ok: false, isDemo: false, userId: null };
  }
}

// ── Supabase client (service role — accès lecture/écriture market_cache) ──────
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Retry avec backoff exponentiel (800/1600/3200 ms) ─────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  baseDelay = 800,
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
      if (res.ok) return res;
    } catch (_) {
      if (i === retries - 1) return null;
    }
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
  }
  return null;
}

// ── Cache mémoire léger (survit à plusieurs appels dans la même instance) ─────
const cache = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL: Record<string, number> = {
  or:      5  * 60 * 1000,  // 5 min
  devises: 15 * 60 * 1000,  // 15 min
  bvc:     30 * 60 * 1000,  // 30 min
};

function fromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > (CACHE_TTL[key] ?? 30 * 60 * 1000)) return null;
  return entry.data;
}
function toCache(key: string, data: unknown) {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ── Handlers par source ────────────────────────────────────────────────────────

// ── Source 0 : 18k.ma — prix de l'or en DH/gramme direct (AN_003) ─────────────
async function fetchGoldMADFrom18kMa(): Promise<number | null> {
  const res = await fetchWithRetry('https://www.18k.ma/prix-de-lor', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  }, 2, 600);
  if (!res) return null;
  try {
    const html = await res.text();
    // 18k.ma affiche le prix en DH/gramme pour l'or 24K
    // Patterns testés : "458,50", "458.50", "458 DH" dans les balises data/prix
    const patterns = [
      /(?:24k?|gram[^<]*?)[\s:]*(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad|dirham)/gi,
      /prix[^<]*?(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad)/gi,
      /(\d{3,4}(?:[.,]\d{1,2})?)\s*(?:dh|mad).*?gram/gi,
      /"price"[^\d]*(\d{3,4}(?:[.,]\d{1,2})?)/gi,
    ];
    for (const pat of patterns) {
      const matches = [...html.matchAll(pat)];
      for (const m of matches) {
        const raw = (m[1] || '').replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (val >= 300 && val <= 1500) return val; // fourchette raisonnable DH/g
      }
    }
  } catch (_) {}
  return null;
}

async function fetchGoldUSD(): Promise<number | null> {
  // Source 1 : metals.live
  const res1 = await fetchWithRetry('https://api.metals.live/v1/spot/gold');
  if (res1) {
    try {
      const d = await res1.json();
      const v = Array.isArray(d) ? d[0]?.gold : d?.gold;
      if (v && typeof v === 'number' && v > 100) return v;
    } catch (_) {}
  }

  // Source 2 : goldapi.io (clé publique gratuite)
  const res2 = await fetchWithRetry('https://www.goldapi.io/api/XAU/USD', {
    headers: { 'x-access-token': 'goldapi-public', 'Content-Type': 'application/json' },
  });
  if (res2) {
    try {
      const d = await res2.json();
      if (d?.price && typeof d.price === 'number' && d.price > 100) return d.price;
    } catch (_) {}
  }

  // Source 3 : metals-api via open endpoint
  const res3 = await fetchWithRetry('https://api.gold-api.com/price/XAU');
  if (res3) {
    try {
      const d = await res3.json();
      const v = d?.price ?? d?.Price ?? d?.gold;
      if (v && typeof v === 'number' && v > 100) return v;
    } catch (_) {}
  }

  return null;
}

async function handleOr(): Promise<unknown> {
  const cached = fromCache('or');
  if (cached) return cached;

  // Source 0 : 18k.ma — cours direct en DH/gramme (AN_003)
  const goldMAD18k = await fetchGoldMADFrom18kMa();
  if (goldMAD18k) {
    const result = { prixOr: Math.round(goldMAD18k), source: '18k.ma' };
    toCache('or', result);
    return result;
  }

  // Fallback : sources USD + conversion MAD
  const [goldUSD, fxRes] = await Promise.all([
    fetchGoldUSD(),
    fetchWithRetry('https://open.er-api.com/v6/latest/USD'),
  ]);
  if (!goldUSD || !fxRes) throw new Error('or: upstream unavailable');

  const fxData = await fxRes.json();
  const usdMad = fxData?.rates?.MAD;
  if (!usdMad) throw new Error('or: MAD rate manquant');

  const prixOr = Math.round((goldUSD / 31.1035) * usdMad);
  const result = { prixOr, source: 'proxy' };
  toCache('or', result);
  return result;
}

async function handleDevises(codes: string[]): Promise<unknown> {
  const cached = fromCache('devises');
  let fxData: Record<string, unknown> | null = null;

  if (cached) {
    fxData = cached as Record<string, unknown>;
  } else {
    const res = await fetchWithRetry('https://open.er-api.com/v6/latest/USD');
    if (!res) throw new Error('devises: upstream unavailable');
    fxData = await res.json();
    toCache('devises', fxData);
  }

  const mad = (fxData as { rates?: Record<string, number> })?.rates?.MAD;
  if (!mad) throw new Error('devises: MAD rate manquant');

  const result: Record<string, number> = {};
  const rates = (fxData as { rates?: Record<string, number> })?.rates ?? {};
  for (const code of codes) {
    const usdRate = rates[code];
    if (usdRate) result[code] = Math.round((mad / usdRate) * 100) / 100;
  }
  return result;
}

const BVC_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// ── TradingView Scanner API — cours BVC en temps réel ─────────────────────────
// POST https://scanner.tradingview.com/casablanca/scan
// Retourne tous les titres cotés à la Bourse de Casablanca (préfixe XCAS:)
async function fetchBVCFromTradingView(): Promise<{
  cours: Record<string, { cours: number; var_pct: number }>;
  updated: string;
} | null> {
  const body = {
    filter: [],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['name', 'close', 'change'],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 500],
  };

  const res = await fetchWithRetry('https://scanner.tradingview.com/casablanca/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.tradingview.com',
      'Origin': 'https://www.tradingview.com',
    },
    body: JSON.stringify(body),
  }, 3, 800);

  if (!res) return null;

  try {
    const json = await res.json() as { totalCount?: number; data?: Array<{ s: string; d: [string, number, number] }> };
    if (!Array.isArray(json?.data) || json.data.length === 0) return null;

    const cours: Record<string, { cours: number; var_pct: number }> = {};

    for (const item of json.data) {
      // item.s = "XCAS:ATW", item.d = ["ATW", 450.50, -0.5]
      const symbol = item.s?.replace('XCAS:', '') ?? '';
      const [, close, change] = item.d;
      if (symbol && typeof close === 'number' && close > 0) {
        cours[symbol] = {
          cours:   Math.round(close   * 100) / 100,
          var_pct: typeof change === 'number' ? Math.round(change * 100) / 100 : 0,
        };
      }
    }

    if (Object.keys(cours).length === 0) return null;

    // Fetch MASI index séparément (AN_002) — pas dans le scan général
    try {
      const masiBody = {
        symbols: { tickers: ['XCAS:MASI'] },
        columns: ['name', 'close', 'change'],
      };
      const masiRes = await fetchWithRetry('https://scanner.tradingview.com/casablanca/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.tradingview.com',
          'Origin': 'https://www.tradingview.com',
        },
        body: JSON.stringify(masiBody),
      }, 2, 600);
      if (masiRes) {
        const masiJson = await masiRes.json() as { data?: Array<{ d: [string, number, number] }> };
        const item = masiJson?.data?.[0];
        if (item) {
          const [, close, change] = item.d;
          if (close && close > 0) {
            cours['MASI'] = {
              cours:   Math.round(close * 100) / 100,
              var_pct: typeof change === 'number' ? Math.round(change * 100) / 100 : 0,
            };
          }
        }
      }
    } catch (_) {} // MASI optionnel — échec silencieux

    return { cours, updated: new Date().toISOString() };
  } catch (_) {
    return null;
  }
}

async function handleBVC(): Promise<unknown> {
  // 1. Cache mémoire en-process (même Edge Function instance)
  const memCached = fromCache('bvc');
  if (memCached) return memCached;

  // 2. market_cache Supabase (source primaire — mise à jour par pg_cron)
  try {
    const { data: row } = await supabase
      .from('market_cache')
      .select('payload, updated_at')
      .eq('source', 'bvc')
      .single();

    // Valide seulement si cours non-vide et récent (< 30 min)
    const hasCours = row?.payload?.cours && Object.keys(row.payload.cours).length > 0;
    if (hasCours && row?.updated_at) {
      const ageMs = Date.now() - new Date(row.updated_at).getTime();
      if (ageMs < BVC_CACHE_TTL_MS) {
        const result = { ...row.payload, _source: 'market_cache' };
        toCache('bvc', result);
        return result;
      }
    }
  } catch (_) {
    // Supabase indisponible → fetch TradingView direct
  }

  // 3. TradingView Scanner API — cours en temps réel
  const tvData = await fetchBVCFromTradingView();
  if (!tvData || Object.keys(tvData.cours).length === 0) {
    throw new Error('bvc: TradingView unavailable ou données vides');
  }

  // Mise à jour market_cache (fire-and-forget, ne bloque pas la réponse)
  supabase
    .from('market_cache')
    .upsert({ source: 'bvc', payload: tvData }, { onConflict: 'source' })
    .then(() => {})
    .catch(() => {});

  toCache('bvc', tvData);
  return tvData;
}

// ── Handler principal ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // ── Auth check (Phase 1) ────────────────────────────────────────────────────
  const { ok, isDemo, userId } = await validateRequest(req);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── Rate limiting (Phase 1) ─────────────────────────────────────────────────
  // Identifier = user_id si authentifié, sinon IP
  const identifier = userId
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'anonymous';

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: limited } = await adminClient.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint:   'market-data-proxy',
      p_max_hits:   60,   // 60 requêtes / minute
      p_window_sec: 60,
    });
    if (limited) {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
  } catch {
    // Rate limit DB indisponible → on laisse passer (fail-open)
  }

  const url    = new URL(req.url);
  const source = url.searchParams.get('source') ?? '';
  const codes  = (url.searchParams.get('codes') ?? '').split(',').filter(Boolean);

  // Mode démo : limiter aux données BVC/MASI uniquement (pas or/devises temps réel)
  if (isDemo && source !== 'bvc' && source !== 'masi') {
    return new Response(JSON.stringify({ error: 'demo_restricted', prixOr: null }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();
  try {
    let data: unknown;
    switch (source) {
      case 'or':      data = await handleOr();          break;
      case 'devises': data = await handleDevises(codes); break;
      case 'bvc':     data = await handleBVC();          break;
      case 'masi': {
        // Source dédiée MASI pour compléter les données GitHub (AN_002)
        const masiBody = { symbols:{ tickers:['XCAS:MASI'] }, columns:['name','close','change'] };
        const mr = await fetchWithRetry('https://scanner.tradingview.com/casablanca/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.tradingview.com',
            'Origin': 'https://www.tradingview.com',
          },
          body: JSON.stringify(masiBody),
        }, 2, 600);
        if (!mr) throw new Error('masi: TradingView unavailable');
        const mj = await mr.json() as { data?: Array<{ d: [string, number, number] }> };
        const item = mj?.data?.[0];
        if (!item) throw new Error('masi: no data');
        const [, close, change] = item.d;
        data = { cours: close, var_pct: typeof change === 'number' ? change : 0 };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'source invalide' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
    // Breadcrumb Sentry : latence par source
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: 'market',
        message:  `${source} OK`,
        data:     { latency_ms: Date.now() - t0 },
        level:    'info',
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (err) {
    // Capture Sentry avec contexte source
    if (SENTRY_DSN) {
      Sentry.withScope((scope: any) => {
        scope.setTag('source', source);
        scope.setTag('latency_ms', String(Date.now() - t0));
        Sentry.captureException(err);
      });
    }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
