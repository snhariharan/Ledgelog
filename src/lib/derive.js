/**
 * derive.js — pure functions that turn raw data (transactions, budgets, …)
 * into everything the pages display. Works identically in demo and Supabase
 * mode, and makes the period selector real.
 */
import { ALL_VIEW_CURRENCY, addMonthsISO, monthShort, parseISO, round2, toISODate } from '../helpers';

const pad = n => String(n).padStart(2, '0');

// ── Transaction classification ───────────────────────────────────────────────
export const txKind = t => t.type || (t.amount < 0 ? 'expense' : 'income');
export const isTransfer = t => { const k = txKind(t); return k === 'transfer_in' || k === 'transfer_out'; };
/** Amount this transaction adds to spending (refunds reduce it); transfers ignored. */
export const spendDelta = t => {
  const k = txKind(t);
  return k === 'expense' || k === 'refund' ? -t.amount : 0;
};
export const incomeDelta = t => (txKind(t) === 'income' ? t.amount : 0);

// ── Periods ──────────────────────────────────────────────────────────────────
const monthStart = (y, m) => `${y}-${pad(m + 1)}-01`;
const monthEnd = (y, m) => toISODate(new Date(y, m + 1, 0));

/** Inclusive ISO range for a period label, or null for "All Time". */
export function periodRange(period, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'This Month':    return { start: monthStart(y, m), end: monthEnd(y, m) };
    case 'Last Month': {
      const d = new Date(y, m - 1, 1);
      return { start: monthStart(d.getFullYear(), d.getMonth()), end: monthEnd(d.getFullYear(), d.getMonth()) };
    }
    case 'Last 3 Months': {
      const d = new Date(y, m - 2, 1);
      return { start: monthStart(d.getFullYear(), d.getMonth()), end: monthEnd(y, m) };
    }
    case 'This Year':     return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'Last Year':     return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default:              return null;
  }
}

/** The range immediately before the given period (for "top movers"). */
export function previousRange(period, now = new Date()) {
  const r = periodRange(period, now);
  if (!r) return null;
  const start = addMonthsISO(r.start, -monthsInRange(r));
  const d = parseISO(r.start);
  d.setDate(d.getDate() - 1);
  return { start, end: toISODate(d) };
}

export function monthsInRange(range) {
  if (!range) return 1;
  const a = parseISO(range.start), b = parseISO(range.end);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

export const inRange = (iso, range) => !range || (iso >= range.start && iso <= range.end);

// ── Aggregations ─────────────────────────────────────────────────────────────
export function summarize(txns) {
  let income = 0, expense = 0;
  for (const t of txns) { income += incomeDelta(t); expense -= spendDelta(t); }
  return { income: round2(income), expense: round2(expense) };
}

/** Expense by tag → [{id,name,color,amount(negative)}] sorted largest first. */
export function expenseByTag(txns, tags) {
  const totals = new Map();
  for (const t of txns) {
    const d = spendDelta(t);
    if (!d) continue;
    const names = t.tags?.length ? t.tags : ['Untagged'];
    for (const n of names) totals.set(n, (totals.get(n) || 0) + d);
  }
  const colorOf = new Map(tags.map(t => [t.name, t.color]));
  const idOf = new Map(tags.map(t => [t.name, t.id]));
  return [...totals.entries()]
    .filter(([, v]) => v > 0)
    .map(([name, v]) => ({ id: idOf.get(name) ?? name, name, color: colorOf.get(name) ?? '#94a3b8', amount: -round2(v) }))
    .sort((a, b) => a.amount - b.amount);
}

export function incomeByTag(txns, tags) {
  const totals = new Map();
  for (const t of txns) {
    const d = incomeDelta(t);
    if (!d) continue;
    const names = t.tags?.length ? t.tags : ['Untagged'];
    for (const n of names) totals.set(n, (totals.get(n) || 0) + d);
  }
  const colorOf = new Map(tags.map(t => [t.name, t.color]));
  return [...totals.entries()]
    .map(([name, v], i) => ({ id: name + i, name, color: colorOf.get(name) ?? '#94a3b8', amount: round2(v) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Monthly budget limits scaled to the number of months in the period. */
export function budgetStatus(budgets, byTag, range, txns) {
  let months = monthsInRange(range);
  if (!range && txns.length) {
    const first = txns.reduce((m, t) => (t.rawDate < m ? t.rawDate : m), txns[0].rawDate);
    const a = parseISO(first), now = new Date();
    months = Math.max(1, (now.getFullYear() - a.getFullYear()) * 12 + now.getMonth() - a.getMonth() + 1);
  }
  const spentOf = new Map(byTag.map(e => [e.name, -e.amount]));
  return budgets.map(b => ({ ...b, limit: round2(b.monthlyLimit * months), spent: spentOf.get(b.tag) ?? 0 }));
}

/** Last `n` calendar months of income/expense, oldest first. */
export function monthlySeries(txns, n = 12, now = new Date()) {
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    rows.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: monthShort(d.getMonth()), income: 0, expense: 0 });
  }
  const idx = new Map(rows.map((r, i) => [r.key, i]));
  for (const t of txns) {
    const i = idx.get(t.rawDate.slice(0, 7));
    if (i === undefined) continue;
    rows[i].income += incomeDelta(t);
    rows[i].expense += spendDelta(t);
  }
  return rows.map(r => ({ ...r, income: round2(r.income), expense: round2(r.expense) }));
}

/** Cumulative expense per day for a month (`'YYYY-MM'`). */
export function dailyCumulative(txns, ym) {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const perDay = Array(days).fill(0);
  for (const t of txns) if (t.rawDate.slice(0, 7) === ym) perDay[Number(t.rawDate.slice(8, 10)) - 1] += spendDelta(t);
  let run = 0;
  return perDay.map(v => (run += v));
}

/** Tag-level change between two ranges → [{name,color,current,previous,delta}] */
export function topMovers(current, previous, tags) {
  const cur = new Map(expenseByTag(current, tags).map(e => [e.name, { v: -e.amount, color: e.color }]));
  const prev = new Map(expenseByTag(previous, tags).map(e => [e.name, { v: -e.amount, color: e.color }]));
  const names = new Set([...cur.keys(), ...prev.keys()]);
  return [...names].map(name => {
    const c = cur.get(name)?.v ?? 0, p = prev.get(name)?.v ?? 0;
    return { name, color: (cur.get(name) ?? prev.get(name)).color, current: c, previous: p, delta: round2(c - p) };
  }).filter(r => r.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── Master derivation ────────────────────────────────────────────────────────
/**
 * Raw → view model. `raw.transactions` rows need `rawDate`, `amount`, `account`.
 *
 * Multi-currency: every transaction gets a `normalizedAmount` in the display
 * currency (`displayCurrency`, default: first account's) using `fxRates`.
 * Without rates, foreign-currency transactions are excluded from aggregates
 * (`foreignExcluded` = true) rather than added up as if they were the same unit.
 * Lists (`rangedTransactions`) always keep every currency, in its own units.
 */
export function withDerived(raw, period, now = new Date(), fxRates = {}, displayCurrency = null) {
  const allAccounts = raw.accounts ?? [];
  const curOf = new Map([...allAccounts, ...(raw.archivedAccounts ?? [])].map(a => [a.name, a.currency || 'USD']));
  const currencies = [...new Set(allAccounts.map(a => a.currency || 'USD'))];
  const isMultiCurrency = currencies.length > 1;
  const hasRates = !!fxRates && Object.keys(fxRates).length > 0;

  // Determine base currency: "All" = multi-currency view, otherwise filter to specific currency
  const baseCurrency = displayCurrency === 'All' ? 'All' :
    (displayCurrency && currencies.includes(displayCurrency) ? displayCurrency : (currencies[0] || 'USD'));

  const filterSingleCurrency = baseCurrency !== 'All';
  const selectedCurrency = filterSingleCurrency ? baseCurrency : null;

  // Normalize all transactions to the aggregation currency ("All" combines into ALL_VIEW_CURRENCY)
  const aggCurrency = selectedCurrency ?? ALL_VIEW_CURRENCY;
  const transactions = raw.transactions.map(t => {
    const currency = curOf.get(t.account) ?? t.currency ?? 'USD';
    const foreign = currency !== aggCurrency;
    const normalizedAmount = !foreign ? t.amount : (hasRates ? convertFX(t.amount, currency, aggCurrency, fxRates) : null);
    return { ...t, currency, normalizedAmount };
  });

  // Filter accounts: if single currency selected, show only those; if "All", show all
  const accounts = filterSingleCurrency
    ? allAccounts.filter(a => (a.currency || 'USD') === selectedCurrency)
    : allAccounts;
  const accountNames = new Set(accounts.map(a => a.name));

  // Transactions: show all from filtered accounts
  const filtered = transactions.filter(t => accountNames.has(t.account));
  const live = filtered.filter(t => !t.deleted);
  const range = periodRange(period, now);
  const allRanged = live.filter(t => inRange(t.rawDate, range));

  // For aggregations, use normalized amounts where available; exclude foreign if rates missing
  const foreignExcluded = !hasRates && isMultiCurrency && baseCurrency === 'All';
  const aggregationTxns = allRanged.map(t => {
    if (foreignExcluded && t.normalizedAmount === null) return null;
    return { ...t, amount: t.normalizedAmount ?? t.amount };
  }).filter(Boolean);

  const expensesData = expenseByTag(aggregationTxns, raw.tags);
  const { income, expense } = summarize(aggregationTxns);

  return {
    ...raw,
    accounts,
    transactions: filtered,
    baseCurrency,
    currencies,
    fxRates,
    multiCurrency: isMultiCurrency,
    foreignExcluded,
    range,
    rangedTransactions: allRanged,
    normalizedRanged: aggregationTxns,
    baseTransactions: live,
    expensesData,
    incomeData: incomeByTag(aggregationTxns, raw.tags),
    summaryData: { income, expense },
    budgets: budgetStatus(raw.budgets ?? [], expensesData, range, live),
    netWorthByCurrency: netWorthByCurrency(allAccounts),
    netWorthConverted: baseCurrency === 'All' ? netWorthConverted(allAccounts, ALL_VIEW_CURRENCY, fxRates) : null,
  };
}

export function netWorthByCurrency(accounts) {
  const map = {};
  for (const a of accounts) {
    const cur = a.currency || 'USD';
    map[cur] = round2((map[cur] || 0) + (a.type === 'credit' ? -a.balance : a.balance));
  }
  return Object.entries(map);
}

/**
 * Convert each per-currency net-worth figure to a single target currency using
 * the supplied rates object (as returned by fx.getExchangeRates).
 * Returns null when rates is empty / unavailable.
 */
export function netWorthConverted(accounts, targetCurrency, rates) {
  if (!rates || !Object.keys(rates).length) return null;
  let total = 0;
  for (const a of accounts) {
    const cur = a.currency || 'USD';
    const signed = a.type === 'credit' ? -a.balance : a.balance;
    total += convertFX(signed, cur, targetCurrency, rates);
  }
  return round2(total);
}


/** Stand-alone converter (avoids circular import with fx.js). */
export function convertFX(amount, from, to, rates) {
  if (from === to || !rates || !Object.keys(rates).length) return amount;
  const inUSD = from === 'USD' ? amount : amount / (rates[from] ?? 1);
  const result = to === 'USD' ? inUSD : inUSD * (rates[to] ?? 1);
  return round2(result);
}
