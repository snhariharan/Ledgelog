-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — 05 Hardening & feature tables
-- Run AFTER 01–04. Safe to re-run.
--
-- 1. Views run with the caller's rights (security_invoker) so RLS applies
-- 2. transactions.tx_type + transfer_group_id (paired transfers)
-- 3. Account balances maintained by a trigger
-- 4. Repeat frequencies aligned with the UI
-- 5. Ownership checks on foreign keys (account_id / tag_id)
-- 6. New tables: rules, holdings
--
-- NOTE: the balance trigger only affects writes made AFTER this migration.
-- If you load 03_seed_data.sql, run it BEFORE this file.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 2. Transaction type + transfer pairing ───────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tx_type TEXT,
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

-- Rows inserted without a type (e.g. 03_seed_data.sql) get one from the sign.
CREATE OR REPLACE FUNCTION public.default_tx_type()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tx_type IS NULL THEN
    NEW.tx_type := CASE WHEN NEW.amount < 0 THEN 'expense' ELSE 'income' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_default_type ON public.transactions;
CREATE TRIGGER trg_transactions_default_type
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.default_tx_type();

UPDATE public.transactions
   SET tx_type = CASE WHEN amount < 0 THEN 'expense' ELSE 'income' END
 WHERE tx_type IS NULL;

ALTER TABLE public.transactions ALTER COLUMN tx_type SET NOT NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_tx_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_tx_type_check
  CHECK (tx_type IN ('expense','income','refund','transfer_in','transfer_out'));

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group
  ON public.transactions(transfer_group_id) WHERE transfer_group_id IS NOT NULL;


-- ── 1. Views: security_invoker + exclude transfers ───────────────────────────
-- Without security_invoker a view runs as its owner and bypasses RLS, so any
-- signed-in user could read every user's rows by dropping the user_id filter.
CREATE OR REPLACE VIEW public.v_expense_by_tag_current_month
WITH (security_invoker = true) AS
SELECT
  t.user_id,
  tg.id           AS tag_id,
  tg.name         AS tag_name,
  tg.color        AS tag_color,
  SUM(t.amount)   AS total_amount,
  COUNT(*)        AS transaction_count
FROM public.transactions t
JOIN public.transaction_tags tt ON tt.transaction_id = t.id
JOIN public.tags tg             ON tg.id = tt.tag_id
WHERE t.is_deleted = FALSE
  AND t.tx_type = 'expense'
  AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY t.user_id, tg.id, tg.name, tg.color;

-- Per-tag budget: a transaction with several tags counts toward each tag's
-- budget (intended), so do not sum `spent` across rows for a grand total.
CREATE OR REPLACE VIEW public.v_budget_status
WITH (security_invoker = true) AS
SELECT
  b.user_id,
  b.id                                                         AS budget_id,
  tg.id                                                        AS tag_id,
  tg.name                                                      AS tag_name,
  COALESCE(b.color, tg.color)                                  AS color,
  b.monthly_limit,
  COALESCE(ABS(SUM(tx.amount)), 0)                             AS spent,
  b.monthly_limit - COALESCE(ABS(SUM(tx.amount)), 0)           AS available,
  ROUND(COALESCE(ABS(SUM(tx.amount)), 0) / b.monthly_limit * 100, 1) AS pct_used
FROM public.budgets b
JOIN public.tags tg ON tg.id = b.tag_id
LEFT JOIN public.transaction_tags tt ON tt.tag_id = b.tag_id
LEFT JOIN public.transactions tx
       ON tx.id = tt.transaction_id
      AND tx.user_id = b.user_id
      AND tx.is_deleted = FALSE
      AND tx.tx_type = 'expense'
      AND DATE_TRUNC('month', tx.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY b.user_id, b.id, tg.id, tg.name, tg.color, b.color, b.monthly_limit;

CREATE OR REPLACE VIEW public.v_net_worth
WITH (security_invoker = true) AS
SELECT
  user_id,
  SUM(CASE WHEN type = 'credit' THEN -balance ELSE balance END) AS net_worth
FROM public.accounts
WHERE is_archived = FALSE
GROUP BY user_id;

CREATE OR REPLACE VIEW public.v_monthly_summary
WITH (security_invoker = true) AS
SELECT
  user_id,
  DATE_TRUNC('month', date)                                      AS month,
  SUM(CASE WHEN tx_type = 'income'  THEN amount ELSE 0 END)      AS income,
  SUM(CASE WHEN tx_type IN ('expense','refund') THEN amount ELSE 0 END) AS expense,
  SUM(CASE WHEN tx_type IN ('income','expense','refund') THEN amount ELSE 0 END) AS net
FROM public.transactions
WHERE is_deleted = FALSE
GROUP BY user_id, DATE_TRUNC('month', date);


-- ── 3. Balance maintenance ───────────────────────────────────────────────────
-- Credit-card balances are stored as positive debt, so a negative transaction
-- INCREASES the balance. Runs as the caller, so RLS still applies.
CREATE OR REPLACE FUNCTION public.apply_transaction_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND NOT OLD.is_deleted AND OLD.account_id IS NOT NULL THEN
    UPDATE public.accounts
       SET balance = balance - (CASE WHEN type = 'credit' THEN -OLD.amount ELSE OLD.amount END)
     WHERE id = OLD.account_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NOT NEW.is_deleted AND NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts
       SET balance = balance + (CASE WHEN type = 'credit' THEN -NEW.amount ELSE NEW.amount END)
     WHERE id = NEW.account_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_balance ON public.transactions;
CREATE TRIGGER trg_transactions_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_balance();


-- ── 4. Repeat frequencies ────────────────────────────────────────────────────
ALTER TABLE public.repeating_transactions
  DROP CONSTRAINT IF EXISTS repeating_transactions_frequency_check;
ALTER TABLE public.repeating_transactions
  ADD CONSTRAINT repeating_transactions_frequency_check
  CHECK (frequency IN ('Daily','Weekly','Bi-weekly','Monthly','Yearly'));


-- ── 5. Ownership checks on referenced rows ───────────────────────────────────
DROP POLICY IF EXISTS "transactions: all own" ON public.transactions;
CREATE POLICY "transactions: all own"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (account_id IS NULL OR EXISTS (
          SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "transaction_tags: all via transaction owner" ON public.transaction_tags;
CREATE POLICY "transaction_tags: all via transaction owner"
  ON public.transaction_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.tags g WHERE g.id = tag_id AND g.user_id = auth.uid())
  );


-- ── 6a. rules ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rules (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  match_text  TEXT        NOT NULL,          -- description contains …
  tag_id      BIGINT      NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON public.rules(user_id);
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rules: all own" ON public.rules;
CREATE POLICY "rules: all own" ON public.rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.tags g WHERE g.id = tag_id AND g.user_id = auth.uid()));


-- ── 6b. holdings (manual investment tracking; prices are user-entered) ───────
CREATE TABLE IF NOT EXISTS public.holdings (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  ticker      TEXT        NOT NULL,
  kind        TEXT        NOT NULL DEFAULT 'Stock',
  shares      NUMERIC(18, 6) NOT NULL CHECK (shares >= 0),
  price       NUMERIC(14, 4) NOT NULL CHECK (price >= 0),   -- current price / share
  cost        NUMERIC(14, 4) NOT NULL CHECK (cost >= 0),    -- average cost / share
  currency    TEXT        NOT NULL DEFAULT 'USD'
              CHECK (currency IN ('USD','EUR','GBP','INR','JPY','AUD','CAD')),
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.holdings(user_id);
DROP TRIGGER IF EXISTS trg_holdings_updated_at ON public.holdings;
CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "holdings: all own" ON public.holdings;
CREATE POLICY "holdings: all own" ON public.holdings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT ON public.v_expense_by_tag_current_month,
                public.v_budget_status,
                public.v_net_worth,
                public.v_monthly_summary TO authenticated;
