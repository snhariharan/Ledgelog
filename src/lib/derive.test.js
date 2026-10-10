import { describe, it, expect } from 'vitest';
import { periodRange, previousRange, summarize, expenseByTag, budgetStatus, monthlySeries, withDerived } from './derive';

const NOW = new Date(2026, 9, 15); // 15 Oct 2026
const tx = (rawDate, amount, tags = [], extra = {}) => ({ id: Math.random(), rawDate, amount, tags, description: 'x', account: 'A', ...extra });
const TAGS = [{ id: 1, name: 'Food', color: '#f00' }, { id: 2, name: 'Rent', color: '#0f0' }];

describe('periodRange', () => {
  it('computes calendar ranges', () => {
    expect(periodRange('This Month', NOW)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('Last Month', NOW)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(periodRange('Last 3 Months', NOW)).toEqual({ start: '2026-08-01', end: '2026-10-31' });
    expect(periodRange('This Year', NOW)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(periodRange('Last Year', NOW)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    expect(periodRange('All Time', NOW)).toBeNull();
  });
  it('crosses year boundaries', () => {
    expect(periodRange('Last Month', new Date(2026, 0, 5))).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
  it('previousRange is the equally long range before', () => {
    expect(previousRange('This Month', NOW)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(previousRange('Last 3 Months', NOW)).toEqual({ start: '2026-05-01', end: '2026-07-31' });
    expect(previousRange('This Year', NOW)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    expect(previousRange('All Time', NOW)).toBeNull();
  });
});

describe('summarize / expenseByTag', () => {
  const txns = [
    tx('2026-10-01', 1000, ['Rent'], { type: 'income' }),
    tx('2026-10-02', -40.1, ['Food']),
    tx('2026-10-03', -0.2, ['Food']),
    tx('2026-10-04', 10, ['Food'], { type: 'refund' }),
    tx('2026-10-05', -500, [], { type: 'transfer_out' }),
    tx('2026-10-05', 500, [], { type: 'transfer_in' }),
  ];
  it('ignores transfers and nets refunds against spending', () => {
    expect(summarize(txns)).toEqual({ income: 1000, expense: -30.3 });
  });
  it('groups spending by tag, largest first, as negatives', () => {
    expect(expenseByTag(txns, TAGS)).toEqual([{ id: 1, name: 'Food', color: '#f00', amount: -30.3 }]);
  });
  it('counts a multi-tag expense toward each tag', () => {
    const r = expenseByTag([tx('2026-10-01', -10, ['Food', 'Rent'])], TAGS);
    expect(r.map(e => e.name).sort()).toEqual(['Food', 'Rent']);
  });
  it('buckets untagged spending', () => {
    expect(expenseByTag([tx('2026-10-01', -10, [])], TAGS)[0].name).toBe('Untagged');
  });
});

describe('budgetStatus', () => {
  const budgets = [{ id: 1, tagId: 1, tag: 'Food', color: '#f00', monthlyLimit: 100 }];
  it('scales monthly limits to the period length', () => {
    const byTag = [{ name: 'Food', amount: -50 }];
    expect(budgetStatus(budgets, byTag, periodRange('Last 3 Months', NOW), [])[0]).toMatchObject({ limit: 300, spent: 50 });
    expect(budgetStatus(budgets, byTag, periodRange('This Month', NOW), [])[0]).toMatchObject({ limit: 100, spent: 50 });
  });
});

describe('monthlySeries', () => {
  it('returns n months oldest-first with totals', () => {
    const s = monthlySeries([tx('2026-10-02', -5), tx('2026-09-02', 100, [], { type: 'income' })], 3, NOW);
    expect(s.map(r => r.key)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(s[1].income).toBe(100);
    expect(s[2].expense).toBe(5);
  });
});

describe('withDerived', () => {
  const raw = {
    accounts: [{ id: 1, name: 'A', currency: 'EUR', type: 'checking', balance: 10 }, { id: 2, name: 'B', currency: 'INR', type: 'credit', balance: 5 }],
    archivedAccounts: [], tags: TAGS, budgets: [],
    transactions: [
      tx('2026-10-02', -10, ['Food'], { account: 'A' }),
      tx('2026-10-02', -9999, ['Food'], { account: 'B' }),
      tx('2026-09-02', -7, ['Food'], { account: 'A' }),
      tx('2026-10-03', -1, ['Food'], { account: 'A', deleted: true }),
    ],
  };
  it('never mixes currencies or counts deleted rows', () => {
    const v = withDerived(raw, 'This Month', NOW);
    expect(v.baseCurrency).toBe('EUR');
    expect(v.multiCurrency).toBe(true);
    expect(v.summaryData.expense).toBe(-10);
  });
  it('follows the period', () => {
    expect(withDerived(raw, 'All Time', NOW).summaryData.expense).toBe(-17);
  });
  it('treats credit balances as liabilities in net worth', () => {
    expect(withDerived(raw, 'This Month', NOW).netWorthByCurrency).toEqual([['EUR', 10], ['INR', -5]]);
  });
});

describe('withDerived multi-currency (FX)', () => {
  const RATES = { EUR: 0.9, INR: 90 }; // per 1 USD
  const raw = {
    accounts: [{ id: 1, name: 'A', currency: 'EUR', type: 'checking', balance: 100 }, { id: 2, name: 'B', currency: 'INR', type: 'checking', balance: 9000 }],
    archivedAccounts: [], tags: TAGS, budgets: [],
    transactions: [tx('2026-10-02', -10, ['Food'], { account: 'A' }), tx('2026-10-02', -900, ['Food'], { account: 'B' })],
  };
  it('defaults to first currency and filters to it', () => {
    const v = withDerived(raw, 'This Month', NOW);
    expect(v.baseCurrency).toBe('EUR');
    expect(v.accounts).toHaveLength(1); // only EUR accounts
    expect(v.summaryData.expense).toBe(-10);
    expect(v.rangedTransactions).toHaveLength(1);
    expect(v.foreignExcluded).toBe(false); // rates not provided, but filtering single currency
  });
  it('filters to selected currency when rates available', () => {
    const v = withDerived(raw, 'This Month', NOW, RATES, 'INR');
    expect(v.baseCurrency).toBe('INR');
    expect(v.accounts).toHaveLength(1);
    expect(v.summaryData.expense).toBe(-900);
    expect(v.rangedTransactions).toHaveLength(1);
  });
  it('with "All" currency, shows all accounts and converts with rates', () => {
    const v = withDerived(raw, 'This Month', NOW, RATES, 'All');
    expect(v.baseCurrency).toBe('All');
    expect(v.accounts).toHaveLength(2); // both accounts
    expect(v.rangedTransactions).toHaveLength(2); // both transactions
    // EUR -10 + INR -900 converted to USD: -10/0.9 + -900/90 ≈ -11.11 - 10 = -21.11
    expect(v.summaryData.expense).toBe(-21.11);
    expect(v.netWorthConverted).not.toBeNull(); // total net worth in USD
  });
  it('without rates, marks foreignExcluded when aggregating "All"', () => {
    const v = withDerived(raw, 'This Month', NOW, {}, 'All');
    expect(v.baseCurrency).toBe('All');
    expect(v.foreignExcluded).toBe(true); // can't convert without rates
    expect(v.summaryData.expense).toBe(0); // neither account is in USD, so nothing can be combined
  });
});

describe('archived accounts in the list', () => {
  it('shows archived accounts\' transactions, filtered by currency like active ones', () => {
    const raw = {
      accounts: [{ id: 1, name: 'A', currency: 'EUR', balance: 0 }],
      archivedAccounts: [{ id: 2, name: 'Old', currency: 'EUR', balance: 0 }, { id: 3, name: 'OldUSD', currency: 'USD', balance: 0 }],
      tags: [], budgets: [],
      transactions: [
        { id: 1, account: 'A', accountId: 1, amount: -1, rawDate: '2020-01-01', description: 'a' },
        { id: 2, account: 'Old', accountId: 2, amount: -2, rawDate: '2020-01-01', description: 'b' },
        { id: 3, account: 'OldUSD', accountId: 3, amount: -3, rawDate: '2020-01-01', description: 'c' },
      ],
    };
    expect(withDerived(raw, 'All Time', new Date(), {}, 'EUR').transactions.map(t => t.id)).toEqual([1, 2]);
    expect(withDerived(raw, 'All Time', new Date(), {}, 'All').transactions.map(t => t.id)).toEqual([1, 2, 3]);
  });
});
