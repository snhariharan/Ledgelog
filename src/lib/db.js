/**
 * db.js — Supabase database service layer.
 * All reads/writes go through these functions; every function throws a
 * readable Error on failure. Account balances are maintained by a database
 * trigger (see supabase/05_hardening.sql), not by this layer.
 */
import { supabase } from './supabase';
import { formatDisplayDate } from '../helpers';

function assertOk({ error }, context = '') {
  if (error) throw new Error(`[db/${context}] ${error.message}`);
}

const PAGE = 1000; // Supabase's default max rows per request

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

export async function fetchAccounts(userId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, institution, type, balance, currency, credit_limit, is_archived')
    .eq('user_id', userId)
    .order('sort_order')
    .order('created_at');
  assertOk({ error }, 'fetchAccounts');
  return (data ?? []).map(a => ({
    ...a,
    balance:  Number(a.balance),
    currency: a.currency ?? 'USD',
    limit:    a.credit_limit ?? null,
  }));
}

export async function addAccount(userId, { name, institution, type, balance, currency = 'USD', limit = null }) {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: userId, name, institution, type, balance: balance ?? 0, currency, credit_limit: limit ?? null })
    .select()
    .single();
  assertOk({ error }, 'addAccount');
  return data.id;
}

export async function updateAccount(accountId, { name, institution, type, balance, currency, limit }) {
  const patch = {};
  if (name        !== undefined) patch.name         = name;
  if (institution !== undefined) patch.institution  = institution;
  if (type        !== undefined) patch.type         = type;
  if (balance     !== undefined) patch.balance      = balance;
  if (currency    !== undefined) patch.currency     = currency;
  if (limit       !== undefined) patch.credit_limit = limit;
  const { error } = await supabase.from('accounts').update(patch).eq('id', accountId);
  assertOk({ error }, 'updateAccount');
}

export async function archiveAccount(accountId, isArchived = true) {
  const { error } = await supabase.from('accounts').update({ is_archived: isArchived }).eq('id', accountId);
  assertOk({ error }, 'archiveAccount');
}

export async function deleteAccount(accountId) {
  const { error } = await supabase.from('accounts').delete().eq('id', accountId);
  assertOk({ error }, 'deleteAccount');
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────

export async function fetchTags(userId) {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, color, sort_order')
    .eq('user_id', userId)
    .order('sort_order')
    .order('name');
  assertOk({ error }, 'fetchTags');
  return data ?? [];
}

export async function addTag(userId, { name, color }) {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name, color: color ?? '#94a3b8' })
    .select()
    .single();
  assertOk({ error }, 'addTag');
  return data;
}

export async function updateTag(tagId, { name, color }) {
  const { error } = await supabase.from('tags').update({ name, color }).eq('id', tagId);
  assertOk({ error }, 'updateTag');
}

export async function deleteTag(tagId) {
  const { error } = await supabase.from('tags').delete().eq('id', tagId);
  assertOk({ error }, 'deleteTag');
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// `*` (not an explicit list) so the app still loads before 06_transaction_details.sql adds status/url/details.
const TX_SELECT = `
  *,
  account:accounts ( id, name, currency ),
  tags:transaction_tags ( tag:tags ( id, name, color ) )
`;

const mapTx = tx => {
  const tags = (tx.tags ?? []).map(t => t.tag).filter(Boolean);
  return {
    id:              tx.id,
    date:            formatDisplayDate(tx.date),
    rawDate:         tx.date,
    amount:          Number(tx.amount),
    description:     tx.description,
    notes:           tx.notes ?? '',
    tags:            tags.map(t => t.name),
    tagIds:          tags.map(t => t.id),
    account:         tx.account?.name ?? 'Unknown',
    accountId:       tx.account?.id ?? null,
    currency:        tx.account?.currency ?? 'USD',
    deleted:         tx.is_deleted,
    untagged:        tags.length === 0,
    type:            tx.tx_type,
    transferGroupId: tx.transfer_group_id ?? null,
    status:          tx.status ?? 'cleared',
    url:             tx.url ?? '',
    details:         tx.details ?? {},
  };
};

/** status/url/details columns, sent only when non-default so un-migrated databases keep working. */
const detailColumns = ({ status, url, details }) => ({
  ...(status && status !== 'cleared' ? { status } : {}),
  ...(url ? { url } : {}),
  ...(details && Object.keys(details).length ? { details } : {}),
});

/** Fetch ALL transactions, paging past Supabase's 1000-row response cap. */
export async function fetchTransactions(userId) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select(TX_SELECT)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1);
    assertOk({ error }, 'fetchTransactions');
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map(mapTx);
}

/**
 * Insert many transactions (with tags) in two round-trips.
 * @param rows [{accountId, amount, description, date, tagIds, notes, type, transferGroupId, status, url, details}]
 * @returns inserted ids, in input order
 */
export async function addTransactions(userId, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('transactions')
    .insert(rows.map(r => ({
      user_id:           userId,
      account_id:        r.accountId ?? null,
      amount:            r.amount,
      description:       r.description,
      date:              r.date,
      notes:             r.notes ?? '',
      tx_type:           r.type ?? (r.amount < 0 ? 'expense' : 'income'),
      transfer_group_id: r.transferGroupId ?? null,
      is_untagged:       !(r.tagIds?.length),
      ...detailColumns(r),
    })))
    .select('id');
  assertOk({ error }, 'addTransactions');

  const junction = [];
  data.forEach((row, i) => (rows[i].tagIds ?? []).forEach(tag_id => junction.push({ transaction_id: row.id, tag_id })));
  if (junction.length) {
    const { error: tagErr } = await supabase.from('transaction_tags').insert(junction);
    assertOk({ error: tagErr }, 'addTransactions/tags');
  }
  return data.map(r => r.id);
}

export async function setTransactionsDeleted(ids, isDeleted) {
  if (!ids.length) return;
  const { error } = await supabase.from('transactions').update({ is_deleted: isDeleted }).in('id', ids);
  assertOk({ error }, 'setTransactionsDeleted');
}

export async function permanentlyDeleteTransactions(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from('transactions').delete().in('id', ids);
  assertOk({ error }, 'permanentlyDeleteTransactions');
}

/** Update core fields; pass tagIds to also replace the tag set. */
/** Fields left undefined are untouched; pass status/url/details only when they changed. */
export async function updateTransaction(transactionId, { accountId, amount, description, date, notes, type, tagIds, status, url, details }) {
  const patch = {};
  if (accountId   !== undefined) patch.account_id  = accountId;
  if (amount      !== undefined) patch.amount      = amount;
  if (description !== undefined) patch.description = description;
  if (date        !== undefined) patch.date        = date;
  if (notes       !== undefined) patch.notes       = notes;
  if (type        !== undefined) patch.tx_type     = type;
  if (tagIds      !== undefined) patch.is_untagged = tagIds.length === 0;
  if (status      !== undefined) patch.status      = status;
  if (url         !== undefined) patch.url         = url || null;
  if (details     !== undefined) patch.details     = details;

  const { error } = await supabase.from('transactions').update(patch).eq('id', transactionId);
  assertOk({ error }, 'updateTransaction');
  if (tagIds !== undefined) await updateTransactionTags(transactionId, tagIds);
}

export async function updateTransactionTags(transactionId, tagIds = []) {
  const { error: delErr } = await supabase.from('transaction_tags').delete().eq('transaction_id', transactionId);
  assertOk({ error: delErr }, 'updateTransactionTags/delete');
  if (tagIds.length) {
    const { error: insErr } = await supabase
      .from('transaction_tags')
      .insert(tagIds.map(tag_id => ({ transaction_id: transactionId, tag_id })));
    assertOk({ error: insErr }, 'updateTransactionTags/insert');
  }
}

// ─── BUDGETS ─────────────────────────────────────────────────────────────────

export async function fetchBudgets(userId) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, tag_id, monthly_limit, color, tag:tags ( name, color )')
    .eq('user_id', userId);
  assertOk({ error }, 'fetchBudgets');
  return (data ?? []).map(b => ({
    id:           b.id,
    tagId:        b.tag_id,
    tag:          b.tag?.name ?? '?',
    color:        b.color ?? b.tag?.color ?? '#94a3b8',
    monthlyLimit: Number(b.monthly_limit),
  }));
}

export async function upsertBudget(userId, tagId, monthlyLimit, color) {
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, tag_id: tagId, monthly_limit: monthlyLimit, color }, { onConflict: 'user_id,tag_id' });
  assertOk({ error }, 'upsertBudget');
}

export async function deleteBudget(budgetId) {
  const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
  assertOk({ error }, 'deleteBudget');
}

// ─── IOUs ─────────────────────────────────────────────────────────────────────

export async function fetchIOUs(userId) {
  const { data, error } = await supabase
    .from('ious')
    .select('id, person_name, amount, direction, note, date, is_settled')
    .eq('user_id', userId)
    .eq('is_settled', false)
    .order('date', { ascending: false });
  assertOk({ error }, 'fetchIOUs');
  // UI convention: positive = they owe me, negative = I owe them
  return (data ?? []).map(r => ({
    id:        r.id,
    person:    r.person_name,
    amount:    r.direction === 'i_owe' ? -Number(r.amount) : Number(r.amount),
    direction: r.direction,
    note:      r.note,
    date:      formatDisplayDate(r.date),
  }));
}

export async function addIOU(userId, { personName, amount, direction, note, date }) {
  const { error } = await supabase
    .from('ious')
    .insert({ user_id: userId, person_name: personName, amount: Math.abs(amount), direction, note, date });
  assertOk({ error }, 'addIOU');
}

export async function settleIOU(iouId) {
  const { error } = await supabase.from('ious').update({ is_settled: true }).eq('id', iouId);
  assertOk({ error }, 'settleIOU');
}

// ─── REPEATING TRANSACTIONS ───────────────────────────────────────────────────

export async function fetchRepeatingTransactions(userId) {
  const { data, error } = await supabase
    .from('repeating_transactions')
    .select(`
      id, description, amount, frequency, next_date, is_active,
      account:accounts ( id, name ),
      tags:repeating_transaction_tags ( tag:tags ( id, name, color ) )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('next_date');
  assertOk({ error }, 'fetchRepeatingTransactions');
  return (data ?? []).map(r => ({
    id:          r.id,
    description: r.description,
    amount:      Number(r.amount),
    frequency:   r.frequency,
    nextDate:    formatDisplayDate(r.next_date),
    nextDateISO: r.next_date,
    account:     r.account?.name ?? 'Unknown',
    accountId:   r.account?.id ?? null,
    tags:        (r.tags ?? []).map(t => t.tag?.name).filter(Boolean),
  }));
}

export async function addRepeat(userId, { accountId, description, amount, frequency, nextDate, tagIds = [] }) {
  const { data, error } = await supabase
    .from('repeating_transactions')
    .insert({ user_id: userId, account_id: accountId ?? null, description, amount, frequency, next_date: nextDate })
    .select('id')
    .single();
  assertOk({ error }, 'addRepeat');
  if (tagIds.length) {
    const { error: tagErr } = await supabase
      .from('repeating_transaction_tags')
      .insert(tagIds.map(tag_id => ({ repeating_transaction_id: data.id, tag_id })));
    assertOk({ error: tagErr }, 'addRepeat/tags');
  }
}

/** Advance a schedule only if nobody else already did (guards against double-runs). */
export async function advanceRepeat(id, fromDate, toDate) {
  const { data, error } = await supabase
    .from('repeating_transactions')
    .update({ next_date: toDate })
    .eq('id', id)
    .eq('next_date', fromDate)
    .select('id');
  assertOk({ error }, 'advanceRepeat');
  return (data ?? []).length > 0;
}

export async function deleteRepeat(id) {
  const { error } = await supabase.from('repeating_transactions').delete().eq('id', id);
  assertOk({ error }, 'deleteRepeat');
}

// ─── FAVORITES ────────────────────────────────────────────────────────────────

export async function fetchFavorites(userId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('id, name, type, icon, config')
    .eq('user_id', userId)
    .order('sort_order');
  assertOk({ error }, 'fetchFavorites');
  return data ?? [];
}

// ─── RULES ────────────────────────────────────────────────────────────────────

export async function fetchRules(userId) {
  const { data, error } = await supabase
    .from('rules')
    .select('id, name, match_text, tag_id, is_active, tag:tags ( name )')
    .eq('user_id', userId)
    .order('sort_order')
    .order('id');
  assertOk({ error }, 'fetchRules');
  return (data ?? []).map(r => ({
    id: r.id, name: r.name, matchText: r.match_text, tagId: r.tag_id, tagName: r.tag?.name ?? '?', active: r.is_active,
  }));
}

export async function addRule(userId, { name, matchText, tagId }) {
  const { error } = await supabase.from('rules').insert({ user_id: userId, name, match_text: matchText, tag_id: tagId });
  assertOk({ error }, 'addRule');
}

export async function setRuleActive(id, active) {
  const { error } = await supabase.from('rules').update({ is_active: active }).eq('id', id);
  assertOk({ error }, 'setRuleActive');
}

export async function deleteRule(id) {
  const { error } = await supabase.from('rules').delete().eq('id', id);
  assertOk({ error }, 'deleteRule');
}

// ─── HOLDINGS ─────────────────────────────────────────────────────────────────

export async function fetchHoldings(userId) {
  const { data, error } = await supabase
    .from('holdings')
    .select('id, name, ticker, kind, shares, price, cost, currency, color')
    .eq('user_id', userId)
    .order('id');
  assertOk({ error }, 'fetchHoldings');
  return (data ?? []).map(h => ({ ...h, shares: Number(h.shares), price: Number(h.price), cost: Number(h.cost) }));
}

export async function addHolding(userId, h) {
  const { error } = await supabase.from('holdings').insert({ user_id: userId, ...h });
  assertOk({ error }, 'addHolding');
}

export async function updateHolding(id, h) {
  const { error } = await supabase.from('holdings').update(h).eq('id', id);
  assertOk({ error }, 'updateHolding');
}

export async function deleteHolding(id) {
  const { error } = await supabase.from('holdings').delete().eq('id', id);
  assertOk({ error }, 'deleteHolding');
}

// ─── LOAD EVERYTHING ──────────────────────────────────────────────────────────

/**
 * Loads the raw data collections in parallel. Aggregates (summaries, budget
 * spend, donut data) are derived client-side by lib/derive.js, so they follow
 * the selected period and never double-count.
 */
export async function loadAllData(userId) {
  const [accounts, tags, transactions, budgets, ious, repeats, favorites, rules, holdings] = await Promise.all([
    fetchAccounts(userId),
    fetchTags(userId),
    fetchTransactions(userId),
    fetchBudgets(userId),
    fetchIOUs(userId),
    fetchRepeatingTransactions(userId),
    fetchFavorites(userId),
    fetchRules(userId),
    fetchHoldings(userId),
  ]);
  return {
    accounts:         accounts.filter(a => !a.is_archived),
    archivedAccounts: accounts.filter(a => a.is_archived),
    tags, transactions, budgets, ious, repeats, favorites, rules, holdings,
  };
}
