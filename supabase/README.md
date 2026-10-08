# Supabase Backend Setup

## Quick Start (5 SQL files + 1 env update)

### Prerequisites
- A free [Supabase](https://supabase.com) account and project
- The Supabase project URL and publishable key (from **Project Settings → API Keys**)

---

## Step 1 — Run the SQL scripts (in order)

Go to **Supabase Dashboard → SQL Editor → New Query** and run each file:

### 01 — Schema (DDL)
Paste and run [`01_schema.sql`](./01_schema.sql)

Creates:
| Object | Description |
|---|---|
| `profiles` | User profiles (auto-created on signup) |
| `accounts` | Bank accounts, credit cards, etc. |
| `tags` | Expense/income categories |
| `transactions` | All financial transactions |
| `transaction_tags` | Many-to-many: transactions ↔ tags |
| `budgets` | Monthly spending limits per tag |
| `ious` | Money lent/borrowed |
| `repeating_transactions` | Recurring scheduled transactions |
| `repeating_transaction_tags` | Many-to-many: repeating ↔ tags |
| `favorites` | Saved reports/filter views |
| `rules` | Auto-tag rules (added in 05) |
| `holdings` | Manual investment holdings (added in 05) |
| `v_budget_status` | View: budget + current-month spending |
| `v_expense_by_tag_current_month` | View: donut chart data |
| `v_net_worth` | View: sum of account balances |
| `v_monthly_summary` | View: income/expense by month |

### 02 — Row Level Security
Paste and run [`02_rls_policies.sql`](./02_rls_policies.sql)

Locks every table so users can only read/write their own data.

### 03 — Seed Data (DML)

> ⚠️ **Before running** — replace the UUID in line ~20:
> ```sql
> uid UUID := 'REPLACE_WITH_YOUR_USER_UUID';
> ```
> Find your UUID at: **Authentication → Users → [your email] → User UID**

Paste and run [`03_seed_data.sql`](./03_seed_data.sql)

Inserts: 5 accounts · 14 tags · 8 budgets · 52 transactions · 3 IOUs · 6 recurring · 3 favorites

### 04 — Migrations
Paste and run [`04_migrations.sql`](./04_migrations.sql) — currency, credit limit, `loan` account type.

### 05 — Hardening & feature tables
Paste and run [`05_hardening.sql`](./05_hardening.sql). **Required** for the current app. It:

| Change | Why |
|---|---|
| Views get `security_invoker = true` | Without it a view runs as its owner and **bypasses RLS** — any signed-in user could read everyone's totals |
| `transactions.tx_type`, `transfer_group_id` | Refunds and paired transfers; transfers no longer count as income/expense |
| Balance trigger on `transactions` | `accounts.balance` stays correct on insert / edit / soft-delete / delete |
| Repeat frequencies `Daily, Weekly, Bi-weekly, Monthly, Yearly` | Matches the UI |
| Ownership checks on `account_id` / `tag_id` | A user can't attach rows to someone else's accounts or tags |
| New tables `rules`, `holdings` | Persisted auto-tag rules and manual investment holdings |
| Seeds demo `rules` & `holdings` | For the demo user from step 03 — mirrors local demo-mode data |

> The balance trigger only affects writes made **after** it is installed. If you use the seed file, run it **before** `05`.

### 06 — Transaction details
Paste and run [`06_transaction_details.sql`](./06_transaction_details.sql). Adds `status`, `url` and `details` (JSON) to `transactions`, used by the Add Transaction form's Status, URL, Investment-type and IOU fields.

> Until it's run, ordinary transactions still save normally; saving one with any of those fields set fails with a "column does not exist" error.

#### Verify RLS (recommended)
Sign in as two different users and, from the browser console of the app, confirm the second user gets zero rows from the first user's data:
```js
await supabase.from('v_monthly_summary').select('*')   // only your own rows, even without .eq('user_id', …)
```

---

## Step 2 — Configure the app

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in your values from **Supabase → Project Settings → API Keys**:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

---

## Step 3 — Run the app

```bash
npm run dev
```

Open `http://localhost:5173` → sign up with the same email used in the seed data, and your data will appear instantly.

---

## Database Schema Diagram

```
profiles (1)──────< accounts (N)
profiles (1)──────< tags (N)
profiles (1)──────< transactions (N) >─── transaction_tags ──< tags
profiles (1)──────< budgets (N) >──────── tags
profiles (1)──────< ious (N)
profiles (1)──────< repeating_transactions (N) >─ repeating_transaction_tags ──< tags
profiles (1)──────< favorites (N)
profiles (1)──────< rules (N) >──────── tags
profiles (1)──────< holdings (N)
```

---

## Useful Queries

```sql
-- Check budget status for current month (the app derives this client-side; the view is for ad-hoc SQL)
SELECT * FROM v_budget_status WHERE user_id = auth.uid();

-- Monthly income vs expense
SELECT * FROM v_monthly_summary WHERE user_id = auth.uid() LIMIT 6;

-- Expense breakdown by tag (for donut chart)
SELECT * FROM v_expense_by_tag_current_month WHERE user_id = auth.uid();

-- Net worth
SELECT * FROM v_net_worth WHERE user_id = auth.uid();
```

---

## Re-seeding

If you want to clear and re-seed:

```sql
-- Delete all data for your user (cascades to all child tables)
DELETE FROM profiles WHERE id = 'YOUR_USER_UUID';
-- Then re-run 03_seed_data.sql
```
