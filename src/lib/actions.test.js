import { describe, it, expect } from 'vitest';
import { createActions } from './actions';
import { todayISO, addDaysISO } from '../helpers';

/** Minimal harness: a state box + demo-mode actions. */
function setup(overrides = {}) {
  let raw = {
    accounts: [
      { id: 1, name: 'Checking', type: 'checking', currency: 'USD', balance: 1000 },
      { id: 2, name: 'Card', type: 'credit', currency: 'USD', balance: 200 },
      { id: 3, name: 'Savings', type: 'savings', currency: 'USD', balance: 500 },
    ],
    archivedAccounts: [],
    tags: [{ id: 1, name: 'Food', color: '#f00' }],
    budgets: [], transactions: [], ious: [], repeats: [], favorites: [], holdings: [],
    rules: [{ id: 1, name: 'r', matchText: 'netflix', tagId: 2, tagName: 'Subscription', active: true }],
    ...overrides,
  };
  const errors = [];
  const actions = createActions({
    userId: null, demo: true, getRaw: () => raw,
    setRaw: u => { raw = typeof u === 'function' ? u(raw) : u; },
    reload: async () => {}, notify: (m, k) => k === 'error' && errors.push(m),
  });
  return { actions, get: () => raw, errors };
}
const bal = (s, id) => s.get().accounts.find(a => a.id === id).balance;

describe('transactions & balances (demo)', () => {
  it('adds a transaction and updates the balance exactly once', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -25.1, description: 'Lunch', date: todayISO(), tags: ['Food'] }]);
    expect(s.get().transactions).toHaveLength(1);
    expect(bal(s, 1)).toBe(974.9);
  });

  it('credit-card spending increases the debt', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 2, amount: -50, description: 'Shoes', date: todayISO() }]);
    expect(bal(s, 2)).toBe(250);
  });

  it('applies auto-tag rules and creates missing tags', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -9, description: 'Netflix', date: todayISO() }]);
    expect(s.get().transactions[0].tags).toEqual(['Subscription']);
    expect(s.get().tags.map(t => t.name)).toContain('Subscription');
  });

  it("a 'transfer' becomes a paired transfer_out / transfer_in", async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, counterAccountId: 3, amount: -200, description: 'Move', date: todayISO(), type: 'transfer' }]);
    const legs = s.get().transactions;
    expect(legs.map(t => t.type).sort()).toEqual(['transfer_in', 'transfer_out']);
    expect(legs[0].transferGroupId).toBe(legs[1].transferGroupId);
    expect(bal(s, 1)).toBe(800);
    expect(bal(s, 3)).toBe(700);
  });

  it('keeps status, url and details through add and edit', async () => {
    const s = setup();
    await s.actions.addTransactions([{
      accountId: 1, amount: -60, description: 'Dinner', date: todayISO(), type: 'iou',
      status: 'uncleared', url: 'https://example.com/r', details: { iouType: 'shared_bill', paidBy: 'Me' },
    }]);
    const t = s.get().transactions[0];
    expect(t).toMatchObject({ type: 'iou', status: 'uncleared', url: 'https://example.com/r', details: { iouType: 'shared_bill', paidBy: 'Me' } });
    await s.actions.updateTransaction({ id: t.id, accountId: 1, amount: -60, description: 'Dinner', date: todayISO(), tags: [], status: 'cleared' });
    expect(s.get().transactions[0]).toMatchObject({ status: 'cleared', url: 'https://example.com/r', details: { paidBy: 'Me' } });
  });

  it('edit moves the balance effect between accounts', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -100, description: 'x', date: todayISO() }]);
    const t = s.get().transactions[0];
    await s.actions.updateTransaction({ id: t.id, accountId: 3, amount: -40, description: 'x', date: todayISO(), tags: [] });
    expect(bal(s, 1)).toBe(1000);
    expect(bal(s, 3)).toBe(460);
  });

  it('soft delete reverses the balance, restore re-applies it, purge of a deleted row changes nothing', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -100, description: 'x', date: todayISO() }]);
    const id = s.get().transactions[0].id;
    await s.actions.deleteTransactions([id]);
    expect(bal(s, 1)).toBe(1000);
    expect(s.get().transactions[0].deleted).toBe(true);
    await s.actions.restoreTransactions([id]);
    expect(bal(s, 1)).toBe(900);
    await s.actions.deleteTransactions([id]);
    await s.actions.purgeTransactions([id]);
    expect(bal(s, 1)).toBe(1000);
    expect(s.get().transactions).toHaveLength(0);
  });

  it('transfers create two linked legs and delete together', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, counterAccountId: 3, amount: -200, description: 'Move', date: todayISO(), type: 'transfer_out' }]);
    const txs = s.get().transactions;
    expect(txs).toHaveLength(2);
    expect(txs[0].transferGroupId).toBe(txs[1].transferGroupId);
    expect([bal(s, 1), bal(s, 3)]).toEqual([800, 700]);
    await s.actions.deleteTransactions([txs[0].id]);
    expect(s.get().transactions.every(t => t.deleted)).toBe(true);
    expect([bal(s, 1), bal(s, 3)]).toEqual([1000, 500]);
  });

  it('rejects a transfer to the same account', async () => {
    const s = setup();
    const r = await s.actions.addTransactions([{ accountId: 1, counterAccountId: 1, amount: -1, description: 'x', date: todayISO(), type: 'transfer_out' }]);
    expect(r).toBeUndefined();
    expect(s.errors[0]).toMatch(/different account/);
  });

  it('duplicate copies a transaction and its balance effect', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -10, description: 'x', date: todayISO(), tags: ['Food'] }]);
    await s.actions.duplicateTransactions([s.get().transactions[0].id]);
    expect(s.get().transactions).toHaveLength(2);
    expect(bal(s, 1)).toBe(980);
  });

  it('dates a duplicate today, whatever the original date was', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -10, description: 'old', date: '2024-03-05' }]);
    await s.actions.duplicateTransactions([s.get().transactions[0].id]);
    const dates = s.get().transactions.map(t => t.rawDate).sort();
    expect(dates).toEqual(['2024-03-05', todayISO()]);
  });
});

describe('import (demo)', () => {
  it('creates missing accounts and imports every row, without duplicate detection', async () => {
    const s = setup();
    const items = [
      { date: '2026-09-01', amount: -5, description: 'A', account: 'New Bank', tags: ['Food'] },
      { date: '2026-09-01', amount: -5, description: 'A', account: 'New Bank', tags: ['Food'] },
      { date: '2026-09-02', amount: 7, description: 'B', account: 'Checking' },
    ];
    const res = await s.actions.importTransactions(items);
    expect(res).toEqual({ added: 3 });
    expect(s.get().accounts.some(a => a.name === 'New Bank')).toBe(true);
    const again = await s.actions.importTransactions(items);
    expect(again).toEqual({ added: 3 });
  });
});

describe('rules (demo)', () => {
  it('creates a combined rule and uses it on new transactions', async () => {
    const s = setup();
    expect(await s.actions.addRule({ name: 'Market', any: ['market'], none: ['indian'], tagId: 1 })).toBe(true);
    await s.actions.addTransactions([
      { accountId: 1, amount: -1, description: 'S market', date: todayISO() },
      { accountId: 1, amount: -1, description: 'Indian market', date: todayISO() },
    ]);
    const byDesc = d => s.get().transactions.find(t => t.description === d).tags;
    expect(byDesc('S market')).toEqual(['Food']);
    expect(byDesc('Indian market')).toEqual([]);
  });

  it('refuses a rule with no positive condition', async () => {
    const s = setup();
    expect(await s.actions.addRule({ name: 'x', none: ['a'], tagId: 1 })).toBeUndefined();
    expect(s.errors.at(-1)).toMatch(/at least one/);
  });

  it('adds standard rules once, creating their tags', async () => {
    const s = setup();
    const n = await s.actions.addStandardRules();
    expect(n).toBeGreaterThan(5);
    expect(s.get().rules.length).toBe(1 + n);
    expect(s.get().tags.some(t => t.name === 'Grocery')).toBe(true);
    expect(await s.actions.addStandardRules()).toBe(0);
  });
});

describe('archived accounts (demo)', () => {
  const archivedSetup = () => setup({ archivedAccounts: [{ id: 9, name: 'Old Bank', type: 'checking', currency: 'USD', balance: 0 }] });

  it('refuses new, duplicated, imported and recurring transactions', async () => {
    const s = archivedSetup();
    expect(await s.actions.addTransactions([{ accountId: 9, amount: -1, description: 'x', date: todayISO() }])).toBeUndefined();
    expect(await s.actions.importTransactions([{ date: '2026-09-01', amount: -5, description: 'A', account: 'old bank' }])).toBeUndefined();
    expect(await s.actions.addRepeat({ description: 'r', amount: -1, frequency: 'monthly', nextDate: todayISO(), accountId: 9 })).toBeUndefined();
    expect(s.get().transactions).toHaveLength(0);
    expect(s.errors.at(-1)).toMatch(/archived/);
  });

  it('keeps existing transactions editable but not movable into an archived account', async () => {
    const s = archivedSetup();
    s.get().transactions.push({ id: 50, accountId: 9, account: 'Old Bank', amount: -3, description: 'old', rawDate: '2020-01-01', tags: [] });
    expect(await s.actions.updateTransaction({ id: 50, accountId: 9, amount: -4, description: 'old', date: '2020-01-01' })).toBe(true);
    expect(await s.actions.duplicateTransactions([50])).toBeUndefined();
    await s.actions.addTransactions([{ accountId: 1, amount: -1, description: 'new', date: todayISO() }]);
    const id = s.get().transactions.find(t => t.description === 'new').id;
    expect(await s.actions.updateTransaction({ id, accountId: 9, amount: -1, description: 'new', date: todayISO() })).toBeUndefined();
  });
});

describe('accounts, tags, budgets (demo)', () => {
  it('refuses to delete an account that has transactions', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -1, description: 'x', date: todayISO() }]);
    expect(await s.actions.deleteAccount(1)).toBeUndefined();
    expect(s.errors[0]).toMatch(/Archive it/);
    expect(await s.actions.deleteAccount(3)).toBe(true);
  });

  it('renaming an account/tag keeps transactions attached', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -1, description: 'x', date: todayISO(), tags: ['Food'] }]);
    await s.actions.updateAccount({ id: 1, name: 'Main' });
    await s.actions.updateTag({ id: 1, name: 'Meals', color: '#000' });
    expect(s.get().transactions[0]).toMatchObject({ account: 'Main', tags: ['Meals'] });
  });

  it('randomizes every tag color in one call, without touching names', async () => {
    const s = setup();
    const before = s.get().tags.map(t => ({ id: t.id, name: t.name, color: t.color }));
    await s.actions.randomizeTagColors();
    const after = s.get().tags;
    expect(after.map(t => ({ id: t.id, name: t.name }))).toEqual(before.map(({ id, name }) => ({ id, name })));
    expect(new Set(after.map(t => t.color)).size).toBe(after.length);
  });

  it('deleting a tag strips it from transactions and removes its budget', async () => {
    const s = setup();
    await s.actions.addTransactions([{ accountId: 1, amount: -1, description: 'x', date: todayISO(), tags: ['Food'] }]);
    await s.actions.upsertBudget({ tagId: 1, monthlyLimit: 50 });
    await s.actions.deleteTag(1);
    expect(s.get().transactions[0]).toMatchObject({ tags: [], untagged: true });
    expect(s.get().budgets).toHaveLength(0);
  });

  it('upsertBudget validates and updates in place', async () => {
    const s = setup();
    expect(await s.actions.upsertBudget({ tagId: 1, monthlyLimit: 0 })).toBeUndefined();
    await s.actions.upsertBudget({ tagId: 1, monthlyLimit: 50 });
    await s.actions.upsertBudget({ tagId: 1, monthlyLimit: 80 });
    expect(s.get().budgets).toHaveLength(1);
    expect(s.get().budgets[0].monthlyLimit).toBe(80);
  });
});

describe('recurring transactions (demo)', () => {
  it('materialises every missed occurrence once, then advances the schedule', async () => {
    const today = todayISO();
    const s = setup({ repeats: [{ id: 9, description: 'Rent', amount: -100, frequency: 'Weekly', nextDateISO: addDaysISO(today, -14), nextDate: '', account: 'Checking', accountId: 1, tags: [] }] });
    expect(await s.actions.processDueRepeats()).toBe(3);
    expect(s.get().transactions).toHaveLength(3);
    expect(bal(s, 1)).toBe(700);
    expect(s.get().repeats[0].nextDateISO).toBe(addDaysISO(today, 7));
    expect(await s.actions.processDueRepeats()).toBe(0);
  });
});
