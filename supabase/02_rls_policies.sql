-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — Row Level Security (RLS) Policies
-- File: supabase/02_rls_policies.sql
-- Run this SECOND in: Supabase Dashboard → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════════════════════
-- RLS ensures every user can only see and modify their own data.
-- All policies use auth.uid() which resolves to the currently signed-in user.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enable RLS on all tables ──────────────────────────────────────────────
ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ious                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeating_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeating_transaction_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites                   ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "profiles: select own"  ON profiles;
DROP POLICY IF EXISTS "profiles: update own"  ON profiles;
DROP POLICY IF EXISTS "profiles: insert own"  ON profiles;

CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ════════════════════════════════════════════════════════════════════════════
-- accounts
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "accounts: all own" ON accounts;

CREATE POLICY "accounts: all own"
  ON accounts FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- tags
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "tags: all own" ON tags;

CREATE POLICY "tags: all own"
  ON tags FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- transactions
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transactions: all own" ON transactions;

CREATE POLICY "transactions: all own"
  ON transactions FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- transaction_tags
-- Access is granted when the parent transaction belongs to the current user.
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transaction_tags: all via transaction owner" ON transaction_tags;

CREATE POLICY "transaction_tags: all via transaction owner"
  ON transaction_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_tags.transaction_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_tags.transaction_id
        AND t.user_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- budgets
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "budgets: all own" ON budgets;

CREATE POLICY "budgets: all own"
  ON budgets FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- ious
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "ious: all own" ON ious;

CREATE POLICY "ious: all own"
  ON ious FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- repeating_transactions
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "repeating_transactions: all own" ON repeating_transactions;

CREATE POLICY "repeating_transactions: all own"
  ON repeating_transactions FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- repeating_transaction_tags
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "repeating_transaction_tags: all via owner" ON repeating_transaction_tags;

CREATE POLICY "repeating_transaction_tags: all via owner"
  ON repeating_transaction_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM repeating_transactions rt
      WHERE rt.id = repeating_transaction_tags.repeating_transaction_id
        AND rt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repeating_transactions rt
      WHERE rt.id = repeating_transaction_tags.repeating_transaction_id
        AND rt.user_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- favorites
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "favorites: all own" ON favorites;

CREATE POLICY "favorites: all own"
  ON favorites FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- Grant SELECT on views to authenticated role
-- ════════════════════════════════════════════════════════════════════════════
GRANT SELECT ON v_expense_by_tag_current_month TO authenticated;
GRANT SELECT ON v_budget_status                TO authenticated;
GRANT SELECT ON v_net_worth                    TO authenticated;
GRANT SELECT ON v_monthly_summary              TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- Done — RLS policies applied.
-- Next: run 03_seed_data.sql  (after creating your Supabase account)
-- ════════════════════════════════════════════════════════════════════════════
