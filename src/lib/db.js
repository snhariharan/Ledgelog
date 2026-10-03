/**
 * db.js — Supabase database service layer
 * All reads/writes to the Expense Tracker database go through these functions.
 */
import { supabase } from './supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Throw a readable error from a Supabase response */
function assertOk({ error }, context = '') {
  if (error) throw new Error(`[db/${context}] ${error.message}`);
}

/** Format a JS Date or ISO string → 'DD Mon YYYY' for the UI */
function formatDisplayDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

export async function fetchAccounts(userId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, institution, type, balance, currency, credit_limit, is_archived')
    .eq('user_id', userId)
    .order('sort_order')
    .order('created_at');

  assertOk({ error }, 'fetchAccounts');
  // Normalise: expose credit_limit as `limit` to match the UI prop name
  return (data ?? []).map(a => ({
    ...a,
    currency:    a.currency    ?? 'USD',
    limit:       a.credit_limit ?? null,  // rename for UI
  }));
}

export async function addAccount(userId, { name, institution, type, balance, currency = 'USD', limit = null }) {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id:      userId,
      name,
      institution,
      type,
      balance:      balance ?? 0,
      currency,
      credit_limit: limit ?? null,
    })
    .select()
    .single();

  assertOk({ error }, 'addAccount');
  return { ...data, limit: data.credit_limit ?? null };
}

export async function updateAccountBalance(accountId, balance) {
  const { error } = await supabase
    .from('accounts')
    .update({ balance })
    .eq('id', accountId);

  assertOk({ error }, 'updateAccountBalance');
}

/**
 * Full account update — name, institution, type, balance, currency, credit_limit.
 */
export async function updateAccount(accountId, { name, institution, type, balance, currency, limit }) {
  const patch = {};
  if (name        !== undefined) patch.name         = name;
  if (institution !== undefined) patch.institution  = institution;
  if (type        !== undefined) patch.type         = type;
  if (balance     !== undefined) patch.balance      = balance;
  if (currency    !== undefined) patch.currency     = currency;
  if (limit       !== undefined) patch.credit_limit = limit;

  const { error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', accountId);

  assertOk({ error }, 'updateAccount');
}

export async function archiveAccount(accountId, isArchived = true) {
  const { error } = await supabase
    .from('accounts')
    .update({ is_archived: isArchived })
    .eq('id', accountId);

  assertOk({ error }, 'archiveAccount');
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
  return data;
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

export async function deleteTag(tagId) {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId);

  assertOk({ error }, 'deleteTag');
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

/**
 * Fetch all transactions for a user with their tags and account name.
 * Returns them in the flat format the UI components expect.
 */
export async function fetchTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      description,
      date,
      is_deleted,
      is_untagged,
      notes,
      account:accounts ( id, name, currency ),
      tags:transaction_tags (
        tag:tags ( id, name, color )
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  assertOk({ error }, 'fetchTransactions');

  // Transform nested Supabase structure -> flat shape the UI expects
  return (data ?? []).map(tx => ({
    id:          tx.id,
    date:        formatDisplayDate(tx.date),
    rawDate:     tx.date,
    amount:      Number(tx.amount),
    description: tx.description,
    notes:       tx.notes ?? '',
    tags:        (tx.tags ?? []).map(t => t.tag?.name).filter(Boolean),
    tagIds:      (tx.tags ?? []).map(t => t.tag?.id).filter(Boolean),
    account:     tx.account?.name     ?? 'Unknown',
    accountId:   tx.account?.id       ?? null,
    currency:    tx.account?.currency ?? 'USD',   // <-- per-account currency
    deleted:     tx.is_deleted,
    untagged:    tx.is_untagged,
  }));
}

/**
 * Add a new transaction with optional tags.
 * @param {string} userId
 * @param {{ accountId, amount, description, date, tagIds, notes }} payload
 */
export async function addTransaction(userId, { accountId, amount, description, date, tagIds = [], notes = '' }) {
  // 1. Insert the transaction row
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert({
      user_id:    userId,
      account_id: accountId ?? null,
      amount,
      description,
      date,
      notes,
      is_untagged: tagIds.length === 0,
    })
    .select('id')
    .single();

  assertOk({ error: txErr }, 'addTransaction');

  // 2. Insert junction rows for each tag
  if (tagIds.length > 0) {
    const { error: tagErr } = await supabase
      .from('transaction_tags')
      .insert(tagIds.map(tag_id => ({ transaction_id: tx.id, tag_id })));

    assertOk({ error: tagErr }, 'addTransaction/tags');
  }

  return tx.id;
}

/**
 * Soft-delete a transaction (sets is_deleted = true).
 */
export async function deleteTransaction(transactionId) {
  const { error } = await supabase
    .from('transactions')
    .update({ is_deleted: true })
    .eq('id', transactionId);

  assertOk({ error }, 'deleteTransaction');
}

/**
 * Permanently delete a transaction (use for already-deleted rows).
 */
export async function permanentlyDeleteTransaction(transactionId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  assertOk({ error }, 'permanentlyDeleteTransaction');
}

/**
 * Update a transaction's core fields.
 */
export async function updateTransaction(transactionId, updates) {
  const { error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId);

  assertOk({ error }, 'updateTransaction');
}

/**
 * Replace all tags on a transaction.
 */
export async function updateTransactionTags(transactionId, tagIds = []) {
  // Delete existing junction rows
  const { error: delErr } = await supabase
    .from('transaction_tags')
    .delete()
    .eq('transaction_id', transactionId);
  assertOk({ error: delErr }, 'updateTransactionTags/delete');

  // Insert new ones
  if (tagIds.length > 0) {
    const { error: insErr } = await supabase
      .from('transaction_tags')
      .insert(tagIds.map(tag_id => ({ transaction_id: transactionId, tag_id })));
    assertOk({ error: insErr }, 'updateTransactionTags/insert');
  }

  // Update is_untagged flag
  await updateTransaction(transactionId, { is_untagged: tagIds.length === 0 });
}

// ─── BUDGETS ─────────────────────────────────────────────────────────────────

/**
 * Fetch budget status using the v_budget_status view
 * (includes current-month spending computed server-side).
 */
export async function fetchBudgetStatus(userId) {
  const { data, error } = await supabase
    .from('v_budget_status')
    .select('budget_id, tag_id, tag_name, color, monthly_limit, spent, available, pct_used')
    .eq('user_id', userId);

  assertOk({ error }, 'fetchBudgetStatus');

  return (data ?? []).map(b => ({
    id:        b.budget_id,
    tagId:     b.tag_id,
    tag:       b.tag_name,
    color:     b.color,
    limit:     Number(b.monthly_limit),
    spent:     Number(b.spent),
    available: Number(b.available),
    pctUsed:   Number(b.pct_used),
  }));
}

export async function upsertBudget(userId, tagId, monthlyLimit, color) {
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, tag_id: tagId, monthly_limit: monthlyLimit, color },
      { onConflict: 'user_id,tag_id' }
    );

  assertOk({ error }, 'upsertBudget');
}

export async function deleteBudget(budgetId) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId);

  assertOk({ error }, 'deleteBudget');
}

// ─── EXPENSE SUMMARY (donut chart data) ──────────────────────────────────────

/**
 * Fetch expense totals by tag for the current calendar month.
 * Uses the v_expense_by_tag_current_month view.
 */
export async function fetchExpenseByTag(userId) {
  const { data, error } = await supabase
    .from('v_expense_by_tag_current_month')
    .select('tag_id, tag_name, tag_color, total_amount, transaction_count')
    .eq('user_id', userId);

  assertOk({ error }, 'fetchExpenseByTag');

  return (data ?? []).map((row, i) => ({
    id:     row.tag_id ?? i,
    name:   row.tag_name,
    color:  row.tag_color,
    amount: Number(row.total_amount),
    count:  Number(row.transaction_count),
  }));
}

// ─── MONTHLY SUMMARY ─────────────────────────────────────────────────────────

export async function fetchMonthlySummary(userId) {
  const { data, error } = await supabase
    .from('v_monthly_summary')
    .select('month, income, expense, net')
    .eq('user_id', userId)
    .limit(12);

  assertOk({ error }, 'fetchMonthlySummary');

  return (data ?? []).map(r => ({
    month:   r.month,
    income:  Number(r.income),
    expense: Number(r.expense),
    net:     Number(r.net),
  }));
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

  return (data ?? []).map(r => ({
    id:        r.id,
    person:    r.person_name,
    amount:    Number(r.amount),
    direction: r.direction,
    note:      r.note,
    date:      formatDisplayDate(r.date),
  }));
}

export async function addIOU(userId, { personName, amount, direction, note, date }) {
  const { data, error } = await supabase
    .from('ious')
    .insert({ user_id: userId, person_name: personName, amount, direction, note, date })
    .select('id')
    .single();

  assertOk({ error }, 'addIOU');
  return data.id;
}

export async function settleIOU(iouId) {
  const { error } = await supabase
    .from('ious')
    .update({ is_settled: true })
    .eq('id', iouId);

  assertOk({ error }, 'settleIOU');
}

// ─── REPEATING TRANSACTIONS ───────────────────────────────────────────────────

export async function fetchRepeatingTransactions(userId) {
  const { data, error } = await supabase
    .from('repeating_transactions')
    .select(`
      id,
      description,
      amount,
      frequency,
      next_date,
      is_active,
      account:accounts ( name ),
      tags:repeating_transaction_tags (
        tag:tags ( id, name, color )
      )
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
    account:     r.account?.name ?? 'Unknown',
    tags:        (r.tags ?? []).map(t => t.tag?.name).filter(Boolean),
  }));
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

export async function addFavorite(userId, { name, type, icon, config }) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, name, type, icon, config })
    .select('id')
    .single();

  assertOk({ error }, 'addFavorite');
  return data.id;
}

export async function deleteFavorite(favoriteId) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('id', favoriteId);

  assertOk({ error }, 'deleteFavorite');
}

// ─── LOAD ALL DASHBOARD DATA ──────────────────────────────────────────────────

/**
 * Single call to load everything the dashboard needs in parallel.
 * Returns an object with all data collections + computed values.
 */
export async function loadAllData(userId) {
  const [
    accounts,
    tags,
    transactions,
    budgets,
    expensesData,
    ious,
    repeats,
    favorites,
    monthlySummary,
  ] = await Promise.all([
    fetchAccounts(userId),
    fetchTags(userId),
    fetchTransactions(userId),
    fetchBudgetStatus(userId),
    fetchExpenseByTag(userId),
    fetchIOUs(userId),
    fetchRepeatingTransactions(userId),
    fetchFavorites(userId),
    fetchMonthlySummary(userId),
  ]);

  const activeAccounts   = accounts.filter(a => !a.is_archived);
  const archivedAccounts = accounts.filter(a => a.is_archived);
  const netWorth         = activeAccounts.reduce((s, a) => s + (a.type === 'credit' ? -a.balance : a.balance), 0);

  // Current month summary from the view (first row = most recent month)
  const currentMonthRow = monthlySummary[0] ?? { income: 0, expense: 0, net: 0 };
  const summaryData = {
    incomeThisMonth:  currentMonthRow.income,
    expenseThisMonth: currentMonthRow.expense,
  };

  return {
    accounts:         activeAccounts,
    archivedAccounts,
    netWorth,
    tags,
    budgets,
    transactions,
    expensesData,
    summaryData,
    ious,
    repeats,
    favorites,
    monthlySummary,
  };
}
