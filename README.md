# Ledgelog

A personal finance tracker: accounts, transactions, tags, budgets, recurring transactions, rules, IOUs,
insights, a 6-month forecast, manual investment tracking and a retirement calculator.

React 19 + Vite, with Supabase (Postgres + Auth + RLS) as the backend. With no Supabase
credentials the app runs in **demo mode** on in-memory sample data.

## Quick start

```bash
npm install
npm run dev          # demo mode, nothing to configure
```

### With Supabase

1. Create a Supabase project and run the SQL files in [`supabase/`](./supabase/README.md) **in order, 01 → 05**.
2. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the **anon** key — never the service-role key).
3. `npm run dev`, sign up, and start adding accounts.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + UI smoke tests) |

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push and PR.

## How it's organised

```
src/
  lib/
    actions.js   every mutation, one interface, two backends (demo state / Supabase)
    db.js        Supabase queries (paged, throws readable errors)
    derive.js    pure: periods, summaries, budgets, trends  → the period selector is real
    csv.js       RFC-4180 import/export + row validation
    rules.js     auto-tag rules          repeats.js   recurring schedule maths
  pages/         one file per screen        components/   shared UI
  mockData.js    demo data (dates shift so "This Month" always has data)
supabase/        schema, RLS, seed, migrations
```

Key design points:

- **Account balances** are maintained by a database trigger in Supabase mode (and by `actions.js` in demo mode) — never recomputed ad hoc in the UI.
- **Credit cards** store debt as a *positive* balance; spending raises it, and net worth subtracts it.
- **Currencies are never added together.** Dashboard totals, charts and budgets use the first account's currency; other currencies are excluded and the UI says so. Net worth is shown per currency.
- **Transfers** are two linked transactions (`transfer_group_id`) and are excluded from income/expense.
- **Recurring transactions** are materialised when the app loads (guarded so two tabs can't both create them). There is no server-side scheduler.
- **Investment prices are manual** — there is no market-data feed.

## Known limitations

- Money is handled as JS numbers rounded to 2 dp (the DB uses `NUMERIC(14,2)`); fine for personal use, not for ledgers needing exact sub-cent arithmetic.
- No FX conversion.
- Recurring transactions only run when someone opens the app.
- `src/index.css` is a single large stylesheet and many components still use inline styles.
