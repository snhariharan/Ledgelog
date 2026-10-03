-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — Supabase Schema (DDL)
-- File: supabase/01_schema.sql
-- Run this FIRST in: Supabase Dashboard → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════════════════════

-- ── Utility: auto-update updated_at column ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: profiles
-- Extends auth.users — created automatically on user signup via trigger
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: accounts
-- Bank accounts, credit cards, savings, etc.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS accounts (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  institution TEXT,
  type        TEXT        NOT NULL DEFAULT 'checking'
              CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash', 'other')),
  balance     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_archived ON accounts(user_id, is_archived);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: tags
-- Expense/income categories (unique per user)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tags (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#94a3b8',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, LOWER(name));


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: transactions
-- All financial transactions
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transactions (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id  BIGINT      REFERENCES accounts(id) ON DELETE SET NULL,
  amount      NUMERIC(14, 2) NOT NULL,           -- negative = expense, positive = income
  description TEXT        NOT NULL,
  date        DATE        NOT NULL,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE, -- soft delete
  is_untagged BOOLEAN     NOT NULL DEFAULT FALSE, -- flag for untagged filter
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted    ON transactions(user_id, is_deleted);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: transaction_tags  (junction / many-to-many)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id         BIGINT NOT NULL REFERENCES tags(id)         ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tt_tag_id ON transaction_tags(tag_id);


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: budgets
-- Monthly spending limits per tag (one per tag per user)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS budgets (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag_id        BIGINT      NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  monthly_limit NUMERIC(14, 2) NOT NULL CHECK (monthly_limit > 0),
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX  IF NOT EXISTS idx_budgets_user_id  ON budgets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_tag ON budgets(user_id, tag_id);

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: ious
-- Money lent to / borrowed from people
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ious (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  person_name TEXT        NOT NULL,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  direction   TEXT        NOT NULL CHECK (direction IN ('owe_me', 'i_owe')),
  note        TEXT,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_settled  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ious_user_id ON ious(user_id);

CREATE TRIGGER trg_ious_updated_at
  BEFORE UPDATE ON ious
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: repeating_transactions
-- Scheduled / recurring transactions
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS repeating_transactions (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id  BIGINT      REFERENCES accounts(id)          ON DELETE SET NULL,
  description TEXT        NOT NULL,
  amount      NUMERIC(14, 2) NOT NULL,
  frequency   TEXT        NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Monthly', 'Yearly')),
  next_date   DATE        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repeating_user_id ON repeating_transactions(user_id);

CREATE TRIGGER trg_repeating_updated_at
  BEFORE UPDATE ON repeating_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: repeating_transaction_tags  (junction)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS repeating_transaction_tags (
  repeating_transaction_id BIGINT NOT NULL REFERENCES repeating_transactions(id) ON DELETE CASCADE,
  tag_id                   BIGINT NOT NULL REFERENCES tags(id)                   ON DELETE CASCADE,
  PRIMARY KEY (repeating_transaction_id, tag_id)
);


-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: favorites
-- Saved dashboard views / report filters
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS favorites (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  type       TEXT,                  -- 'report' | 'filter'
  icon       TEXT,
  config     JSONB,                 -- flexible filter/report config
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════════════════

-- View: expense totals by tag for current calendar month
CREATE OR REPLACE VIEW v_expense_by_tag_current_month AS
SELECT
  t.user_id,
  tg.id           AS tag_id,
  tg.name         AS tag_name,
  tg.color        AS tag_color,
  SUM(t.amount)   AS total_amount,
  COUNT(*)        AS transaction_count
FROM transactions t
JOIN transaction_tags tt ON tt.transaction_id = t.id
JOIN tags tg             ON tg.id = tt.tag_id
WHERE t.is_deleted = FALSE
  AND t.amount < 0
  AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY t.user_id, tg.id, tg.name, tg.color
ORDER BY total_amount ASC;  -- most negative (highest expense) first


-- View: budget status with current-month spending
CREATE OR REPLACE VIEW v_budget_status AS
SELECT
  b.user_id,
  b.id                                                         AS budget_id,
  tg.id                                                        AS tag_id,
  tg.name                                                      AS tag_name,
  COALESCE(b.color, tg.color)                                  AS color,
  b.monthly_limit,
  COALESCE(ABS(SUM(tx.amount)), 0)                             AS spent,
  b.monthly_limit - COALESCE(ABS(SUM(tx.amount)), 0)           AS available,
  ROUND(
    COALESCE(ABS(SUM(tx.amount)), 0) / b.monthly_limit * 100, 1
  )                                                            AS pct_used
FROM budgets b
JOIN tags tg ON tg.id = b.tag_id
LEFT JOIN transaction_tags tt ON tt.tag_id = b.tag_id
LEFT JOIN transactions tx
       ON tx.id = tt.transaction_id
      AND tx.user_id = b.user_id
      AND tx.is_deleted = FALSE
      AND tx.amount < 0
      AND DATE_TRUNC('month', tx.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY b.user_id, b.id, tg.id, tg.name, tg.color, b.color, b.monthly_limit;


-- View: account net worth per user
CREATE OR REPLACE VIEW v_net_worth AS
SELECT
  user_id,
  SUM(balance) AS net_worth
FROM accounts
WHERE is_archived = FALSE
GROUP BY user_id;


-- View: monthly income and expense summary
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date)               AS month,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
  SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS expense,
  SUM(amount)                             AS net
FROM transactions
WHERE is_deleted = FALSE
GROUP BY user_id, DATE_TRUNC('month', date)
ORDER BY month DESC;


-- ════════════════════════════════════════════════════════════════════════════
-- Done — schema created successfully.
-- Next: run 02_rls_policies.sql
-- ════════════════════════════════════════════════════════════════════════════
