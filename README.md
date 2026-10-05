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
2. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the **publishable** key — never the secret key).
3. `npm run dev`, sign up, and start adding accounts.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + UI smoke tests) |

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push and PR.

## Deployment

See [**DEPLOYMENT.md**](./DEPLOYMENT.md) for:
- How to deploy to Vercel
- How to add data to Supabase (seed data, UI, CSV import)
- Environment variables setup
- Post-deployment checklist

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
- **Multi-currency normalization.** When FX rates are available, transactions are normalized to your base currency for aggregations (dashboard totals, charts, budgets). Without rates, currencies are kept separate and the UI indicates missing conversions. Net worth shows totals per currency.
- **Transfers** are two linked transactions (`transfer_group_id`) and are excluded from income/expense.
- **Recurring transactions** are materialised when the app loads (guarded so two tabs can't both create them). There is no server-side scheduler.
- **Investment prices are manual** — there is no market-data feed.

## Features

- **Live FX rates** — automatic currency conversion using live market data; normalization for aggregations when rates are available
- **Investment tracking** — manual price tracking and portfolio management
- **Recurring transactions** — automated scheduling that materializes on app load
- **Auto-tagging rules** — rule engine for automatic transaction categorization
- **Budget management** — per-tag spending limits with real-time tracking
- **CSV import/export** — RFC-4180 format with row validation

## Known limitations

- Money is handled as JS numbers rounded to 2 dp (the DB uses `NUMERIC(14,2)`); fine for personal use, not for ledgers needing exact sub-cent arithmetic.
- Recurring transactions only run when someone opens the app (no server-side scheduler).
- `src/index.css` is a single large stylesheet and many components still use inline styles.
- FX rates are fetched on demand; historical conversions use the rate at transaction time if available, otherwise the most recent rate.
