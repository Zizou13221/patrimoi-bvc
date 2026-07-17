/**
 * PatriMoi — Supabase Edge Function : market-data-proxy-ingest
 * Phase 2 DAT v2.0 — ingest BVC quotidien (appelé par pg_cron à 01h00 UTC)
 *
 * Bug 4b fix : remplace GitHub raw (repo mort) par TradingView Scanner API.
 * Fetch les cours BVC en temps réel et met à jour market_cache.
 * Pas d'exposition publique — appelé uniquement par pg_cron via pg_net.
 *
 * Deploy: supabase functions deploy market-data-proxy-ingest
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  baseDelay = 800,
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      if (res.ok) return res;
    } catch (_) {
      if (i === retries - 1) return null;
    }
    await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
  }
  return null;
}

serve(async (req: Request) => {
  // Sécurité basique : vérifier la clé service_role (pg_cron envoie le header apikey)
  const authHeader = req.headers.get('authorization') ?? req.headers.get('apikey') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!authHeader.includes(serviceKey) && !authHeader.includes(anonKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // ── TradingView Scanner API — tous les titres Casablanca ─────────────────
    const body = {
      filter: [],
      options: { lang: 'en' },
      symbols: { query: { types: [] }, tickers: [] },
      columns: ['name', 'close', 'change'],
      sort: { sortBy: 'name', sortOrder: 'asc' },
      range: [0, 500],
    };

    const res = await fetchWithRetry(
      'https://scanner.tradingview.com/casablanca/scan',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.tradingview.com',
          'Origin': 'https://www.tradingview.com',
        },
        body: JSON.stringify(body),
      },
      3, 800,
    );

    if (!res) {
      return new Response(JSON.stringify({ error: 'bvc: TradingView unavailable' }), { status: 502 });
    }

    const json = await res.json() as {
      totalCount?: number;
      data?: Array<{ s: string; d: [string, number, number] }>;
    };

    if (!Array.isArray(json?.data) || json.data.length === 0) {
      return new Response(JSON.stringify({ error: 'bvc: réponse TradingView vide ou invalide' }), { status: 502 });
    }

    // ── Parser la réponse TradingView ─────────────────────────────────────────
    const cours: Record<string, { cours: number; var_pct: number }> = {};

    for (const item of json.data) {
      // item.s = "XCAS:ATW" | item.d = ["ATW", 450.50, -0.5]
      const symbol = item.s?.replace('XCAS:', '') ?? '';
      const [, close, change] = item.d;
      if (symbol && typeof close === 'number' && close > 0) {
        cours[symbol] = {
          cours:   Math.round(close   * 100) / 100,
          var_pct: typeof change === 'number' ? Math.round(change * 100) / 100 : 0,
        };
      }
    }

    if (Object.keys(cours).length === 0) {
      return new Response(JSON.stringify({ error: 'bvc: aucun cours parsé' }), { status: 502 });
    }

    const payload = { cours, updated: new Date().toISOString() };

    // ── Upsert dans market_cache ──────────────────────────────────────────────
    const { error } = await supabase
      .from('market_cache')
      .upsert({ source: 'bvc', payload }, { onConflict: 'source' });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({
      ok:      true,
      tickers: Object.keys(cours).length,
      updated: payload.updated,
      sample:  Object.entries(cours).slice(0, 3).map(([k, v]) => `${k}:${v.cours}`).join(', '),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
