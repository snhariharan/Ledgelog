// ── Persistence helpers (localStorage can throw in private windows) ──────────
export const getStored = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
export const setStored = (key, val) => {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
};

export const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$',
};
export const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

/** In the "All" display mode, cross-currency totals are converted to this currency. */
export const ALL_VIEW_CURRENCY = 'USD';

export const currencySymbol = code => {
  const c = code === 'All' ? ALL_VIEW_CURRENCY : code;
  return CURRENCY_SYMBOLS[c] || c || '$';
};

/** Round to 2 decimals, avoiding binary float drift (e.g. 0.1 + 0.2). */
export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const fmt = (n, showSign = false, currencyCode = 'USD') => {
  const val = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(val);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = currencySymbol(currencyCode);
  if (showSign && val > 0) return '+' + sym + str;
  if (val < 0) return '-' + sym + str;
  return sym + str;
};

/** Short form for tight spaces: ₹474.8K, €1.2M. */
export const fmtCompact = (n, currencyCode = 'USD') => {
  const val = Number.isFinite(n) ? Math.abs(n) : 0;
  const str = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val);
  return currencySymbol(currencyCode) + str;
};

// ── Dates (always local time, never UTC-shifted) ─────────────────────────────
const pad = n => String(n).padStart(2, '0');
export const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());

/** Parse 'YYYY-MM-DD' as a local date (no timezone surprises). */
export const parseISO = iso => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTHS_LOWER = MONTHS_SHORT.map(m => m.toLowerCase());
export const monthShort = i => MONTHS_SHORT[i];

/** 'YYYY-MM-DD' → '5 Sep 2026' */
export const formatDisplayDate = iso => {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

export const addMonthsISO = (iso, n) => {
  const d = parseISO(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISODate(t);
};

export const addDaysISO = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// ── Constants ────────────────────────────────────────────────────────────────
export const PERIODS = ['This Month','Last Month','Last 3 Months','This Year','Last Year','All Time'];
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const PAGE_SIZE = 25;
/** Dashboard tag list hides tags with smaller totals than this (per currency). */
export const TAG_MIN_AMOUNT = { INR: 2500 };
export const tagMinAmount = currency => TAG_MIN_AMOUNT[currency] ?? 200;

export const TX_TYPES = [
  {key:'expense',      label:'EXPENSE',      sign:'-', color:'#ef4444'},
  {key:'transfer',     label:'TRANSFER',     sign:'-', color:'#f59e0b'},
  {key:'transfer_out', label:'TRANSFER OUT', sign:'-', color:'#f59e0b'},
  {key:'income',       label:'INCOME',       sign:'+', color:'#10b981'},
  {key:'refund',       label:'REFUND',       sign:'+', color:'#3b82f6'},
  {key:'transfer_in',  label:'TRANSFER IN',  sign:'+', color:'#8b5cf6'},
  {key:'investment',   label:'INVESTMENT',   sign:'-', color:'#6366f1'},
  {key:'iou',          label:'IOU',          sign:'-', color:'#d946ef'},
];
export const PRESET_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#64748b'];
export const ACCOUNT_TYPES = ['checking','savings','credit','investment','loan','cash','other'];
export const REPEAT_FREQS = ['Daily','Weekly','Bi-weekly','Monthly','Yearly'];
