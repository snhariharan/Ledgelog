/**
 * fx.js — lightweight currency-conversion layer.
 *
 * Rates are fetched from the free tier of exchangerate-api.com
 * (no API key needed for the open endpoint; 1,500 req/month).
 * Results are cached in localStorage for 6 hours so we never
 * hammer the endpoint.
 *
 * API: https://open.er-api.com/v6/latest/USD
 *
 * Usage:
 *   const rates = await getExchangeRates();   // { EUR: 0.92, INR: 84.1, … }
 *   const converted = convert(100, 'INR', 'EUR', rates);
 */

import { getStored, setStored, round2 } from '../helpers';

const CACHE_KEY   = 'fx_rates_cache';
const BASE        = 'USD';
const TTL_MS      = 6 * 60 * 60 * 1000; // 6 hours
const ENDPOINT    = `https://open.er-api.com/v6/latest/${BASE}`;

/** Read cached rates; returns null if missing or stale. */
function readCache() {
  try {
    const raw = getStored(CACHE_KEY, null);
    if (!raw) return null;
    const { ts, rates } = JSON.parse(raw);
    if (Date.now() - ts > TTL_MS) return null;
    return rates;
  } catch {
    return null;
  }
}

/** Write rates to cache with a timestamp. */
function writeCache(rates) {
  try {
    setStored(CACHE_KEY, JSON.stringify({ ts: Date.now(), rates }));
  } catch { /* ignore */ }
}

let inFlight = null;

/**
 * Returns an object mapping currency codes → rate relative to USD.
 * Falls back to stale cache if the network fails.
 */
export async function getExchangeRates() {
  const cached = readCache();
  if (cached) return cached;

  // Deduplicate concurrent calls
  if (!inFlight) {
    inFlight = fetch(ENDPOINT, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`FX ${r.status}`)))
      .then(data => {
        const rates = data.rates ?? {};
        writeCache(rates);
        return rates;
      })
      .catch(err => {
        console.warn('[fx] fetch failed, using stale or empty rates:', err.message);
        // Try stale cache even if expired
        try {
          const raw = getStored(CACHE_KEY, null);
          if (raw) return JSON.parse(raw).rates ?? {};
        } catch { /* ignore */ }
        return {};
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/**
 * Convert `amount` from `from` currency to `to` currency.
 * Returns the original amount unchanged if rates are missing.
 */
export function convert(amount, from, to, rates) {
  if (from === to || !rates || !Object.keys(rates).length) return amount;
  const inUSD = from === BASE ? amount : amount / (rates[from] ?? 1);
  const result = to === BASE ? inUSD : inUSD * (rates[to] ?? 1);
  return round2(result);
}

/**
 * Invalidate the cache (e.g. user presses "Refresh Rates").
 */
export function invalidateRatesCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Attempt to fetch a current stock/ETF price in USD from the Yahoo Finance
 * unofficial chart endpoint (no API key needed, but rate-limited).
 *
 * Returns null on any failure — prices must always be enterable manually.
 */
export async function fetchTickerPrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? round2(price) : null;
  } catch {
    return null;
  }
}
