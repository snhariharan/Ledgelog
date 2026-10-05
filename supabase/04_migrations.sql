-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — Migrations (DDL + DML patches)
-- File: supabase/04_migrations.sql
-- Run this AFTER 01_schema.sql, 02_rls_policies.sql, 03_seed_data.sql
--
-- Covers:
--   1. Add `currency` column to accounts
--   2. Add `credit_limit` column to accounts (for credit cards)
--   3. Add 'loan' to accounts.type CHECK constraint
--   4. Fix v_net_worth: credit balances are liabilities (positive = debt)
--   5. Update seed data: currencies, HDFC balance sign, add ICICI Credit
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. accounts.currency ─────────────────────────────────────────────────────
-- ISO 4217 currency code per account.
-- DEFAULT 'USD' keeps existing rows valid.
-- CHECK ensures only supported codes are accepted.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD','EUR','GBP','INR','JPY','AUD','CAD'));


-- ── 2. accounts.credit_limit ─────────────────────────────────────────────────
-- Optional credit limit for credit-card accounts.
-- NULL means no limit is tracked (non-credit accounts).

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2) DEFAULT NULL;


-- ── 3. Extend accounts.type CHECK to include 'loan' ──────────────────────────
-- Original constraint missed 'loan'.  Drop and recreate to match
-- the UI ACCOUNT_TYPES constant: checking|savings|credit|investment|loan|cash|other

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('checking','savings','credit','investment','loan','cash','other'));


-- ── 4. Fix v_net_worth: credit accounts are liabilities ──────────────────────
-- Credit accounts store outstanding debt as a POSITIVE balance.
-- Net worth  =  sum(non-credit balances)  -  sum(credit balances)

CREATE OR REPLACE VIEW v_net_worth AS
SELECT
  user_id,
  SUM(
    CASE WHEN type = 'credit' THEN -balance
         ELSE                       balance
    END
  ) AS net_worth
FROM public.accounts
WHERE is_archived = FALSE
GROUP BY user_id;


-- ── 5a. Patch seed accounts: set correct currencies ──────────────────────────
-- Matches on (name, institution) so only demo rows are touched.

UPDATE public.accounts SET currency = 'EUR'
  WHERE name = 'OP Account'      AND institution = 'OnePoint Bank';

UPDATE public.accounts SET currency = 'EUR'
  WHERE name = 'Savings Account' AND institution = 'OnePoint Bank';

UPDATE public.accounts SET currency = 'INR'
  WHERE name = 'HDFC Credit'     AND institution = 'HDFC Bank';

UPDATE public.accounts SET currency = 'INR'
  WHERE name = 'SBI Savings'     AND institution = 'State Bank';


-- ── 5b. Fix HDFC Credit balance sign ─────────────────────────────────────────
-- Old seed stored debt as negative (-1240.55).
-- New convention: positive value = outstanding debt on credit card.

UPDATE public.accounts
  SET balance = ABS(balance)
  WHERE name = 'HDFC Credit'
    AND institution = 'HDFC Bank'
    AND balance < 0;


-- ── 5c. Insert ICICI Credit card (idempotent) ────────────────────────────────
-- Adds the ICICI card with a 3,00,000 INR limit for any user who has an
-- OP Account but no ICICI Credit yet.

INSERT INTO public.accounts
  (user_id, name, institution, type, balance, currency, credit_limit, is_archived, sort_order)
SELECT
  a.user_id,
  'ICICI Credit',
  'ICICI Bank',
  'credit',
  45000.00,
  'INR',
  300000.00,
  FALSE,
  5
FROM public.accounts a
WHERE a.name = 'OP Account'
  AND a.institution = 'OnePoint Bank'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts x
    WHERE x.user_id = a.user_id
      AND x.name   = 'ICICI Credit'
  );


-- ════════════════════════════════════════════════════════════════════════════
-- Run 05_hardening.sql next — required for the current app (tx_type,
-- transfer pairing, balance trigger, rules/holdings tables, etc.)
-- ════════════════════════════════════════════════════════════════════════════
