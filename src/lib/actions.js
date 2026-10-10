/**
 * actions.js — every mutation in the app lives here, behind one interface with
 * two backends:
 *   • demo      → pure, immutable updates to in-memory state
 *   • supabase  → db.* calls followed by a reload
 *
 * Each action returns a truthy value on success and `undefined` on failure
 * (the error is surfaced through `notify`), so callers can simply do
 * `if (await actions.x()) closeModal()`.
 *
 * Account balances: demo mode adjusts them here; in Supabase mode a database
 * trigger does (supabase/05_hardening.sql), so we never write them from a
 * transaction change.
 */
import * as db from './db';
import { applyRules, parseTerms, STANDARD_RULES } from './rules';
import { dueOccurrences } from './repeats';
import { formatDisplayDate, round2, todayISO, PRESET_COLORS } from '../helpers';

const balanceDelta = (acc, amount) => (acc.type === 'credit' ? -amount : amount);
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

let demoSeq = 1_000_000;
const nextId = () => ++demoSeq;

/** Apply (dir = +1) or reverse (dir = -1) a transaction's effect on demo balances. */
function adjustBalances(accounts, tx, dir) {
  if (tx.deleted) return accounts;
  return accounts.map(a => {
    const hit = tx.accountId != null ? a.id === tx.accountId : a.name === tx.account;
    return hit ? { ...a, balance: round2(a.balance + dir * balanceDelta(a, tx.amount)) } : a;
  });
}

const defaultType = amount => (amount < 0 ? 'expense' : 'income');

export function createActions({ userId, demo, getRaw, setRaw, reload, notify }) {
  // ── helpers ────────────────────────────────────────────────────────────────
  const findAccount = (raw, { accountId, accountName }) =>
    [...raw.accounts, ...raw.archivedAccounts].find(a =>
      accountId != null ? a.id === accountId : accountName ? sameName(a.name, accountName) : false);

  /** Archived accounts are read-only: their history stays, but nothing new goes in. */
  const isArchived = (raw, acc) => !!acc && (raw.archivedAccounts ?? []).some(a => a.id === acc.id);
  const assertWritable = (raw, acc) => {
    if (isArchived(raw, acc)) throw new Error(`"${acc.name}" is archived. Unarchive it to add transactions.`);
  };

  /** Create any accounts that don't exist yet (CSV import auto-detect). */
  async function ensureAccounts(raw, names, currencyOf = () => 'USD') {
    const created = [];
    for (const name of [...new Set(names.filter(Boolean))]) {
      if (findAccount(raw, { accountName: name })) continue;
      const acc = { name, institution: '—', type: 'checking', balance: 0, currency: currencyOf(name) };
      acc.id = demo ? nextId() : await db.addAccount(userId, acc);
      created.push(acc);
    }
    return created;
  }

  /** Create any tags that don't exist yet; returns the created ones. */
  async function ensureTags(raw, names) {
    const created = [];
    const have = [...raw.tags];
    for (const name of [...new Set(names.filter(Boolean))]) {
      if (have.some(t => sameName(t.name, name))) continue;
      const color = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
      const tag = demo ? { id: nextId(), name, color } : await db.addTag(userId, { name, color });
      have.push(tag); created.push(tag);
    }
    return created;
  }

  const tagIdsOf = (tags, names) =>
    names.map(n => tags.find(t => sameName(t.name, n))?.id).filter(v => v != null);
  const canonicalTags = (tags, names) =>
    [...new Set(names.map(n => tags.find(t => sameName(t.name, n))?.name ?? n))];

  /** Expand UI inputs into concrete rows (transfer legs, rules, ids). */
  function buildRows(raw, accounts, tags, inputs, { rules = true } = {}) {
    const rows = [];
    for (const input of inputs) {
      const acc = findAccount({ accounts, archivedAccounts: raw.archivedAccounts }, input);
      if (!acc) throw new Error(`Unknown account "${input.accountName ?? input.accountId}".`);
      assertWritable(raw, acc);
      // 'transfer' is the UI's source→destination transfer; store it as the outgoing leg.
      const type = input.type === 'transfer' ? 'transfer_out' : (input.type ?? defaultType(input.amount));
      const names = canonicalTags(tags, rules ? applyRules(input.description, input.tags ?? [], raw.rules) : (input.tags ?? []));
      const base = {
        description: input.description, date: input.date, notes: input.notes ?? '',
        tags: names, tagIds: tagIdsOf(tags, names),
      };
      const row = {
        ...base, accountId: acc.id, accountName: acc.name, amount: input.amount, type, transferGroupId: null,
        status: input.status ?? 'cleared', url: input.url ?? '', details: input.details ?? {},
      };
      const counter = input.counterAccountId != null && (type === 'transfer_out' || type === 'transfer_in')
        ? findAccount(raw, { accountId: input.counterAccountId }) : null;
      if (counter) {
        if (counter.id === acc.id) throw new Error('Choose a different account for the transfer.');
        assertWritable(raw, counter);
        const group = uuid();
        row.transferGroupId = group;
        rows.push(row, {
          ...base, tags: [], tagIds: [], accountId: counter.id, accountName: counter.name,
          amount: -input.amount, type: type === 'transfer_out' ? 'transfer_in' : 'transfer_out', transferGroupId: group,
          status: row.status, url: row.url, details: {},
        });
      } else rows.push(row);
    }
    return rows;
  }

  const rowToTx = r => ({
    id: nextId(), date: formatDisplayDate(r.date), rawDate: r.date, amount: r.amount,
    description: r.description, notes: r.notes, tags: r.tags, tagIds: r.tagIds,
    account: r.accountName, accountId: r.accountId, deleted: false, untagged: r.tags.length === 0,
    type: r.type, transferGroupId: r.transferGroupId,
    status: r.status ?? 'cleared', url: r.url ?? '', details: r.details ?? {},
  });

  /** Commit rows (+ any newly created accounts/tags) to the active backend. */
  async function insertRows(rows, { newAccounts = [], newTags = [] } = {}) {
    if (demo) {
      const txs = rows.map(rowToTx);
      setRaw(prev => {
        let accounts = [...prev.accounts, ...newAccounts];
        for (const tx of txs) accounts = adjustBalances(accounts, tx, 1);
        return { ...prev, accounts, tags: [...prev.tags, ...newTags], transactions: [...txs, ...prev.transactions] };
      });
    } else {
      await db.addTransactions(userId, rows);
      await reload();
    }
  }

  const withSiblings = (raw, ids) => {
    const set = new Set(ids);
    const groups = new Set(raw.transactions.filter(t => set.has(t.id) && t.transferGroupId).map(t => t.transferGroupId));
    raw.transactions.forEach(t => { if (t.transferGroupId && groups.has(t.transferGroupId)) set.add(t.id); });
    return [...set];
  };

  // ── the actions ────────────────────────────────────────────────────────────
  const impl = {
    // Transactions ───────────────────────────────────────────────────────────
    async addTransactions(inputs, opts) {
      const raw = getRaw();
      // Rules first, so any tag they add is created/resolved like a user-typed one.
      if (opts?.rules !== false) inputs = inputs.map(i => ({ ...i, tags: applyRules(i.description, i.tags ?? [], raw.rules) }));
      const newAccounts = await ensureAccounts(raw, inputs.filter(i => i.accountId == null).map(i => i.accountName), n => inputs.find(i => i.accountName === n)?.currency ?? 'USD');
      const newTags = await ensureTags(raw, inputs.flatMap(i => i.tags ?? []));
      const accounts = [...raw.accounts, ...newAccounts];
      const tags = [...raw.tags, ...newTags];
      const rows = buildRows(raw, accounts, tags, inputs, { rules: false });
      await insertRows(rows, { newAccounts, newTags });
      return rows.length;
    },

    async updateTransaction({ id, accountId, amount, description, date, tags: tagNames = [], notes = '', type, status, url, details }) {
      if (type === 'transfer') type = 'transfer_out';
      const raw = getRaw();
      const old = raw.transactions.find(t => t.id === id);
      if (!old) throw new Error('Transaction not found.');
      const acc = findAccount(raw, { accountId });
      if (!acc) throw new Error('Unknown account.');
      if (acc.id !== (old.accountId ?? findAccount(raw, { accountName: old.account })?.id)) assertWritable(raw, acc);
      const newTags = await ensureTags(raw, tagNames);
      const tags = [...raw.tags, ...newTags];
      const names = canonicalTags(tags, tagNames);
      if (demo) {
        const updated = {
          ...old, accountId: acc.id, account: acc.name, amount, description, date: formatDisplayDate(date), rawDate: date,
          notes, tags: names, tagIds: tagIdsOf(tags, names), untagged: names.length === 0, type: type ?? old.type,
          status: status ?? old.status, url: url ?? old.url, details: details ?? old.details,
        };
        setRaw(prev => ({
          ...prev,
          tags: [...prev.tags, ...newTags],
          accounts: adjustBalances(adjustBalances(prev.accounts, old, -1), updated, 1),
          transactions: prev.transactions.map(t => (t.id === id ? updated : t)),
        }));
      } else {
        // Only send detail columns that changed, so un-migrated databases can still edit plain transactions.
        const changed = (v, prev, dflt) => (v !== undefined && JSON.stringify(v) !== JSON.stringify(prev ?? dflt) ? v : undefined);
        await db.updateTransaction(id, {
          accountId: acc.id, amount, description, date, notes, type, tagIds: tagIdsOf(tags, names),
          status: changed(status, old.status, 'cleared'), url: changed(url, old.url, ''), details: changed(details, old.details, {}),
        });
        await reload();
      }
      return true;
    },

    async duplicateTransactions(ids) {
      const raw = getRaw();
      const picked = raw.transactions.filter(t => ids.includes(t.id));
      for (const t of picked) assertWritable(raw, findAccount(raw, { accountId: t.accountId, accountName: t.account }));
      const today = todayISO(); // a duplicate is a new entry: always dated today
      const rows = picked.map(t => ({
        description: t.description, date: today, notes: t.notes ?? '', tags: t.tags ?? [], tagIds: t.tagIds ?? tagIdsOf(raw.tags, t.tags ?? []),
        accountId: t.accountId ?? findAccount(raw, { accountName: t.account })?.id, accountName: t.account,
        amount: t.amount, type: t.type === 'transfer_in' || t.type === 'transfer_out' ? defaultType(t.amount) : (t.type ?? defaultType(t.amount)),
        transferGroupId: null, status: t.status ?? 'cleared', url: t.url ?? '', details: t.details ?? {},
      }));
      await insertRows(rows);
      return rows.length;
    },

    async deleteTransactions(ids) {
      const all = withSiblings(getRaw(), ids);
      if (demo) {
        setRaw(prev => {
          const hit = prev.transactions.filter(t => all.includes(t.id) && !t.deleted);
          return {
            ...prev,
            accounts: hit.reduce((accs, t) => adjustBalances(accs, t, -1), prev.accounts),
            transactions: prev.transactions.map(t => (all.includes(t.id) ? { ...t, deleted: true } : t)),
          };
        });
      } else { await db.setTransactionsDeleted(all, true); await reload(); }
      return true;
    },

    async restoreTransactions(ids) {
      const all = withSiblings(getRaw(), ids);
      if (demo) {
        setRaw(prev => {
          const hit = prev.transactions.filter(t => all.includes(t.id) && t.deleted);
          return {
            ...prev,
            accounts: hit.reduce((accs, t) => adjustBalances(accs, { ...t, deleted: false }, 1), prev.accounts),
            transactions: prev.transactions.map(t => (all.includes(t.id) ? { ...t, deleted: false } : t)),
          };
        });
      } else { await db.setTransactionsDeleted(all, false); await reload(); }
      return true;
    },

    async purgeTransactions(ids) {
      const all = withSiblings(getRaw(), ids);
      if (demo) {
        setRaw(prev => {
          const hit = prev.transactions.filter(t => all.includes(t.id) && !t.deleted);
          return {
            ...prev,
            accounts: hit.reduce((accs, t) => adjustBalances(accs, t, -1), prev.accounts),
            transactions: prev.transactions.filter(t => !all.includes(t.id)),
          };
        });
      } else { await db.permanentlyDeleteTransactions(all); await reload(); }
      return true;
    },

    /** CSV/JSON import. Every row is added as-is (no duplicate detection). */
    async importTransactions(items, { accountId } = {}) {
      const raw = getRaw();
      const fixed = accountId != null ? findAccount(raw, { accountId }) : null;
      const inputs = items.map(it => ({
        accountName: fixed ? fixed.name : (it.account || raw.accounts[0]?.name || 'Imported'),
        currency: it.currency, amount: it.amount, description: it.description, date: it.date,
        tags: it.tags ?? [], type: it.type, notes: it.notes ?? '',
      }));
      const archived = [...new Set(inputs.map(i => findAccount(raw, { accountName: i.accountName })).filter(a => isArchived(raw, a)).map(a => a.name))];
      if (archived.length) throw new Error(`Can't import into archived account${archived.length > 1 ? 's' : ''} ${archived.map(n => `"${n}"`).join(', ')}. Unarchive ${archived.length > 1 ? 'them' : 'it'} first, then import.`);
      const added = inputs.length ? await impl.addTransactions(inputs) : 0;
      return { added };
    },

    // Accounts ───────────────────────────────────────────────────────────────
    async addAccount(a) {
      if (demo) setRaw(prev => ({ ...prev, accounts: [...prev.accounts, { ...a, id: nextId() }] }));
      else { await db.addAccount(userId, a); await reload(); }
      return true;
    },
    async updateAccount(a) {
      if (demo) {
        setRaw(prev => {
          const old = prev.accounts.find(x => x.id === a.id);
          const renamed = old && old.name !== a.name;
          return {
            ...prev,
            accounts: prev.accounts.map(x => (x.id === a.id ? { ...x, ...a } : x)),
            transactions: renamed ? prev.transactions.map(t => (t.account === old.name ? { ...t, account: a.name } : t)) : prev.transactions,
            repeats: renamed ? prev.repeats.map(r => (r.account === old.name ? { ...r, account: a.name } : r)) : prev.repeats,
          };
        });
      } else { await db.updateAccount(a.id, a); await reload(); }
      return true;
    },
    async archiveAccount(id) {
      if (demo) {
        setRaw(prev => {
          const acc = prev.accounts.find(a => a.id === id);
          if (!acc) return prev;
          return { ...prev, accounts: prev.accounts.filter(a => a.id !== id), archivedAccounts: [...prev.archivedAccounts, acc] };
        });
      } else { await db.archiveAccount(id, true); await reload(); }
      return true;
    },
    async deleteAccount(id) {
      const raw = getRaw();
      const acc = findAccount(raw, { accountId: id });
      const used = raw.transactions.filter(t => (t.accountId ?? findAccount(raw, { accountName: t.account })?.id) === id).length;
      if (used) throw new Error(`"${acc?.name}" has ${used} transaction${used > 1 ? 's' : ''}. Archive it instead of deleting.`);
      if (demo) setRaw(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id), archivedAccounts: prev.archivedAccounts.filter(a => a.id !== id) }));
      else { await db.deleteAccount(id); await reload(); }
      return true;
    },

    // Tags ───────────────────────────────────────────────────────────────────
    async addTag({ name, color }) {
      if (getRaw().tags.some(t => sameName(t.name, name))) throw new Error('Tag already exists.');
      if (demo) setRaw(prev => ({ ...prev, tags: [...prev.tags, { id: nextId(), name, color }] }));
      else { await db.addTag(userId, { name, color }); await reload(); }
      return true;
    },
    async updateTag({ id, name, color }) {
      const raw = getRaw();
      if (raw.tags.some(t => t.id !== id && sameName(t.name, name))) throw new Error('Tag already exists.');
      if (demo) {
        const old = raw.tags.find(t => t.id === id);
        const ren = tags => tags.map(n => (n === old?.name ? name : n));
        setRaw(prev => ({
          ...prev,
          tags: prev.tags.map(t => (t.id === id ? { ...t, name, color } : t)),
          transactions: prev.transactions.map(t => (t.tags?.includes(old.name) ? { ...t, tags: ren(t.tags) } : t)),
          repeats: prev.repeats.map(r => (r.tags?.includes(old.name) ? { ...r, tags: ren(r.tags) } : r)),
          budgets: prev.budgets.map(b => (b.tagId === id ? { ...b, tag: name } : b)),
          rules: prev.rules.map(r => (r.tagId === id ? { ...r, tagName: name } : r)),
        }));
      } else { await db.updateTag(id, { name, color }); await reload(); }
      return true;
    },
    async randomizeTagColors() {
      const raw = getRaw();
      const palette = [...PRESET_COLORS];
      for (let i = palette.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [palette[i], palette[j]] = [palette[j], palette[i]];
      }
      const colorFor = i => palette[i % palette.length];
      if (demo) {
        setRaw(prev => ({ ...prev, tags: prev.tags.map((t, i) => ({ ...t, color: colorFor(i) })) }));
      } else {
        await Promise.all(raw.tags.map((t, i) => db.updateTag(t.id, { name: t.name, color: colorFor(i) })));
        await reload();
      }
      return true;
    },
    async deleteTag(id) {
      if (demo) {
        setRaw(prev => {
          const old = prev.tags.find(t => t.id === id);
          const strip = tags => (tags ?? []).filter(n => n !== old?.name);
          return {
            ...prev,
            tags: prev.tags.filter(t => t.id !== id),
            transactions: prev.transactions.map(t => (t.tags?.includes(old?.name) ? { ...t, tags: strip(t.tags), untagged: strip(t.tags).length === 0 } : t)),
            repeats: prev.repeats.map(r => ({ ...r, tags: strip(r.tags) })),
            budgets: prev.budgets.filter(b => b.tagId !== id),
            rules: prev.rules.filter(r => r.tagId !== id),
          };
        });
      } else { await db.deleteTag(id); await reload(); }
      return true;
    },

    // IOUs ───────────────────────────────────────────────────────────────────
    async addIOU({ person, amount, direction, note, date }) {
      if (demo) {
        const signed = direction === 'i_owe' ? -Math.abs(amount) : Math.abs(amount);
        setRaw(prev => ({ ...prev, ious: [...prev.ious, { id: nextId(), person, amount: signed, direction, note, date: formatDisplayDate(date) }] }));
      } else { await db.addIOU(userId, { personName: person, amount, direction, note, date }); await reload(); }
      return true;
    },
    async settleIOU(id) {
      if (demo) setRaw(prev => ({ ...prev, ious: prev.ious.filter(i => i.id !== id) }));
      else { await db.settleIOU(id); await reload(); }
      return true;
    },

    // Repeats ────────────────────────────────────────────────────────────────
    async addRepeat({ description, amount, frequency, nextDate, tags: tagNames = [], accountId }) {
      const raw = getRaw();
      const acc = findAccount(raw, { accountId }) ?? raw.accounts[0];
      if (!acc) throw new Error('Add an account first.');
      assertWritable(raw, acc);
      if (demo) {
        setRaw(prev => ({
          ...prev,
          repeats: [...prev.repeats, {
            id: nextId(), description, amount, frequency, nextDate: formatDisplayDate(nextDate), nextDateISO: nextDate,
            account: acc.name, accountId: acc.id, tags: tagNames,
          }],
        }));
      } else {
        await db.addRepeat(userId, { accountId: acc.id, description, amount, frequency, nextDate, tagIds: tagIdsOf(raw.tags, tagNames) });
        await reload();
      }
      return true;
    },
    async deleteRepeat(id) {
      if (demo) setRaw(prev => ({ ...prev, repeats: prev.repeats.filter(r => r.id !== id) }));
      else { await db.deleteRepeat(id); await reload(); }
      return true;
    },
    /** Create transactions for every repeat that has come due. Safe to call repeatedly. */
    async processDueRepeats() {
      const raw = getRaw();
      const today = todayISO();
      const inputs = [];
      const advanced = new Map();
      for (const r of raw.repeats) {
        if (!r.nextDateISO || r.nextDateISO > today) continue;
        const acc = findAccount(raw, { accountId: r.accountId, accountName: r.account });
        if (!acc || isArchived(raw, acc)) continue; // archived accounts take no new transactions
        const { dates, next } = dueOccurrences(r, today);
        if (!dates.length) continue;
        if (!demo && !(await db.advanceRepeat(r.id, r.nextDateISO, next))) continue; // another tab got it
        advanced.set(r.id, next);
        for (const date of dates) {
          inputs.push({ accountId: r.accountId, accountName: r.account, amount: r.amount, description: r.description, date, tags: r.tags, type: defaultType(r.amount), notes: 'Recurring' });
        }
      }
      if (!inputs.length) return 0;
      try {
        await impl.addTransactions(inputs, { rules: false });
      } catch (e) {
        if (!demo) for (const [id, next] of advanced) await db.advanceRepeat(id, next, raw.repeats.find(r => r.id === id).nextDateISO);
        throw e;
      }
      if (demo) {
        setRaw(prev => ({
          ...prev,
          repeats: prev.repeats.map(r => (advanced.has(r.id) ? { ...r, nextDateISO: advanced.get(r.id), nextDate: formatDisplayDate(advanced.get(r.id)) } : r)),
        }));
      }
      return inputs.length;
    },

    // Budgets ────────────────────────────────────────────────────────────────
    async upsertBudget({ tagId, monthlyLimit }) {
      const raw = getRaw();
      const tag = raw.tags.find(t => t.id === tagId);
      if (!tag) throw new Error('Choose a tag.');
      if (!(monthlyLimit > 0)) throw new Error('Budget must be greater than zero.');
      if (demo) {
        setRaw(prev => {
          const existing = prev.budgets.find(b => b.tagId === tagId);
          return {
            ...prev,
            budgets: existing
              ? prev.budgets.map(b => (b.tagId === tagId ? { ...b, monthlyLimit } : b))
              : [...prev.budgets, { id: nextId(), tagId, tag: tag.name, color: tag.color, monthlyLimit }],
          };
        });
      } else { await db.upsertBudget(userId, tagId, monthlyLimit, tag.color); await reload(); }
      return true;
    },
    async deleteBudget(id) {
      if (demo) setRaw(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }));
      else { await db.deleteBudget(id); await reload(); }
      return true;
    },

    // Rules ──────────────────────────────────────────────────────────────────
    async addRule({ name, matchText: legacy, any = legacy ? [legacy] : [], all = [], none = [], tagId }) {
      const tag = getRaw().tags.find(t => t.id === tagId);
      if (!tag) throw new Error('Choose a tag.');
      if (!any.length && !all.length) throw new Error('Add at least one text to look for.');
      const matchText = any[0] ?? all[0];
      if (demo) setRaw(prev => ({ ...prev, rules: [...prev.rules, { id: nextId(), name, matchText, any, all, none, tagId, tagName: tag.name, active: true }] }));
      else { await db.addRule(userId, { name, matchText, tagId, any, all, none }); await reload(); }
      return true;
    },
    /** Add the starter rules that aren't there yet (by name), creating any missing tags. Returns how many were added. */
    async addStandardRules() {
      const raw = getRaw();
      const have = new Set(raw.rules.map(r => r.name.toLowerCase()));
      const todo = STANDARD_RULES.filter(r => !have.has(r.name.toLowerCase()));
      if (!todo.length) return 0;
      const newTags = await ensureTags(raw, todo.map(r => r.tag));
      const tags = [...raw.tags, ...newTags];
      const rules = todo.map(r => {
        const any = parseTerms((r.any ?? []).join(',')), all = parseTerms((r.all ?? []).join(',')), none = parseTerms((r.none ?? []).join(','));
        const tag = tags.find(t => sameName(t.name, r.tag));
        return { name: r.name, matchText: any[0] ?? all[0], any, all, none, tagId: tag.id, tagName: tag.name, active: true };
      });
      if (demo) setRaw(prev => ({ ...prev, tags: [...prev.tags, ...newTags], rules: [...prev.rules, ...rules.map(r => ({ ...r, id: nextId() }))] }));
      else { for (const r of rules) await db.addRule(userId, r); await reload(); }
      return rules.length;
    },
    async setRuleActive(id, active) {
      if (demo) setRaw(prev => ({ ...prev, rules: prev.rules.map(r => (r.id === id ? { ...r, active } : r)) }));
      else { await db.setRuleActive(id, active); await reload(); }
      return true;
    },
    async deleteRule(id) {
      if (demo) setRaw(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== id) }));
      else { await db.deleteRule(id); await reload(); }
      return true;
    },

    // Holdings ───────────────────────────────────────────────────────────────
    async saveHolding(h) {
      const { id, ...fields } = h;
      if (demo) {
        setRaw(prev => ({
          ...prev,
          holdings: id ? prev.holdings.map(x => (x.id === id ? { ...x, ...fields } : x)) : [...prev.holdings, { ...fields, id: nextId() }],
        }));
      } else { id ? await db.updateHolding(id, fields) : await db.addHolding(userId, fields); await reload(); }
      return true;
    },
    async deleteHolding(id) {
      if (demo) setRaw(prev => ({ ...prev, holdings: prev.holdings.filter(h => h.id !== id) }));
      else { await db.deleteHolding(id); await reload(); }
      return true;
    },
  };

  // Wrap: surface errors via notify, return undefined on failure.
  return Object.fromEntries(Object.entries(impl).map(([name, fn]) => [name, async (...args) => {
    try { return (await fn(...args)) ?? true; }
    catch (e) { console.error(`[actions/${name}]`, e); notify?.(e.message || 'Something went wrong.', 'error'); return undefined; }
  }]));
}
