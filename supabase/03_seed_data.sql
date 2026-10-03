-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — Seed / Demo Data (DML)
-- File: supabase/03_seed_data.sql
-- Run this THIRD in: Supabase Dashboard → SQL Editor → New Query
--
-- ⚠️  IMPORTANT — Before running:
--   1. Sign up / log in at your app (or via Supabase Auth dashboard)
--   2. Copy your User UUID from:
--      Supabase Dashboard → Authentication → Users → [your user] → User UID
--   3. Replace 'REPLACE_WITH_YOUR_USER_UUID' below with your actual UUID
--      Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── ⚠️  CHANGE THIS VALUE ─────────────────────────────────────────────
  uid         UUID := 'REPLACE_WITH_YOUR_USER_UUID';
  -- ────────────────────────────────────────────────────────────────────────

  -- Account ID variables
  acc_op      BIGINT;   -- OP Account (checking)
  acc_sav     BIGINT;   -- Savings Account
  acc_hdfc    BIGINT;   -- HDFC Credit Card
  acc_sbi     BIGINT;   -- SBI Savings
  acc_old     BIGINT;   -- Old Checking (archived)

  -- Tag ID variables
  tag_home    BIGINT;
  tag_car     BIGINT;
  tag_loan    BIGINT;
  tag_grocery BIGINT;
  tag_bill    BIGINT;
  tag_india   BIGINT;
  tag_ig      BIGINT;   -- Indian Grocery
  tag_dining  BIGINT;
  tag_ent     BIGINT;   -- Entertainment
  tag_travel  BIGINT;
  tag_health  BIGINT;
  tag_income  BIGINT;
  tag_utils   BIGINT;   -- Utilities
  tag_sub     BIGINT;   -- Subscription

  -- Repeating transaction ID (reused)
  rep_id      BIGINT;
  -- Transaction ID (reused)
  tx_id       BIGINT;

BEGIN
  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. PROFILE
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (uid, 'demo@ledgelog.app', 'Demo User')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  RAISE NOTICE '✓ Profile ready for user %', uid;


  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. ACCOUNTS
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.accounts (user_id, name, institution, type, balance, is_archived, sort_order)
  VALUES (uid, 'OP Account',      'OnePoint Bank', 'checking',  4521.38,  FALSE, 1)
  RETURNING id INTO acc_op;

  INSERT INTO public.accounts (user_id, name, institution, type, balance, is_archived, sort_order)
  VALUES (uid, 'Savings Account', 'OnePoint Bank', 'savings',   7950.00,  FALSE, 2)
  RETURNING id INTO acc_sav;

  INSERT INTO public.accounts (user_id, name, institution, type, balance, is_archived, sort_order)
  VALUES (uid, 'HDFC Credit',     'HDFC Bank',     'credit',   -1240.55, FALSE, 3)
  RETURNING id INTO acc_hdfc;

  INSERT INTO public.accounts (user_id, name, institution, type, balance, is_archived, sort_order)
  VALUES (uid, 'SBI Savings',     'State Bank',    'savings',   3100.00,  FALSE, 4)
  RETURNING id INTO acc_sbi;

  INSERT INTO public.accounts (user_id, name, institution, type, balance, is_archived, sort_order)
  VALUES (uid, 'Old Checking',    'Legacy Bank',   'checking',  0.00,     TRUE,  1)
  RETURNING id INTO acc_old;

  RAISE NOTICE '✓ Accounts created (op=%, sav=%, hdfc=%, sbi=%, old=%)',
    acc_op, acc_sav, acc_hdfc, acc_sbi, acc_old;


  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. TAGS
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Home',           '#ef4444',  1) RETURNING id INTO tag_home;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Car',            '#f59e0b',  2) RETURNING id INTO tag_car;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Loan',           '#8b5cf6',  3) RETURNING id INTO tag_loan;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Grocery',        '#10b981',  4) RETURNING id INTO tag_grocery;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Bill',           '#3b82f6',  5) RETURNING id INTO tag_bill;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'India',          '#ec4899',  6) RETURNING id INTO tag_india;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Indian Grocery', '#14b8a6',  7) RETURNING id INTO tag_ig;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Dining',         '#f97316',  8) RETURNING id INTO tag_dining;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Entertainment',  '#a855f7',  9) RETURNING id INTO tag_ent;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Travel',         '#0ea5e9', 10) RETURNING id INTO tag_travel;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Health',         '#84cc16', 11) RETURNING id INTO tag_health;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Income',         '#22c55e', 12) RETURNING id INTO tag_income;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Utilities',      '#64748b', 13) RETURNING id INTO tag_utils;

  INSERT INTO public.tags (user_id, name, color, sort_order)
  VALUES (uid, 'Subscription',   '#d946ef', 14) RETURNING id INTO tag_sub;

  RAISE NOTICE '✓ 14 tags created';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. BUDGETS  (monthly_limit per tag)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.budgets (user_id, tag_id, monthly_limit, color) VALUES
    (uid, tag_home,    600.00,  '#ef4444'),
    (uid, tag_car,     400.00,  '#f59e0b'),
    (uid, tag_grocery, 500.00,  '#10b981'),
    (uid, tag_loan,   1450.00,  '#8b5cf6'),
    (uid, tag_ig,      300.00,  '#14b8a6'),
    (uid, tag_dining,  250.00,  '#f97316'),
    (uid, tag_utils,   200.00,  '#64748b'),
    (uid, tag_sub,      80.00,  '#d946ef');

  RAISE NOTICE '✓ 8 budgets created';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. TRANSACTIONS — August 2026  (20 transactions)
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -465.40, 'Home maintenance', '2026-08-10')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -23.50, 'Swiggy order', '2026-08-10')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_dining);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -120.48, 'Loan 2 EMI', '2026-08-09')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -285.71, 'HDFC Loan 1', '2026-08-09')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -313.90, 'Car EMI', '2026-08-08')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -78.30, 'Weekly grocery run', '2026-08-08')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_grocery);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -45.99, 'Netflix annual', '2026-08-07')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_sub);

  -- Car Insurance bill — TWO tags: car + bill
  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -206.04, 'Car Insurance bill', '2026-08-07')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_bill);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, 5200.00, 'Salary August', '2026-08-06')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_income);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -119.00, 'Electricity bill', '2026-08-06')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_utils);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -88.50, 'Indian Grocery - Patel', '2026-08-05')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_ig);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -2000.00, 'Wire transfer to India', '2026-08-05')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_india);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -34.20, 'Movie tickets', '2026-08-04')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_ent);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -62.10, 'Restaurant - Olive Garden', '2026-08-04')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_dining);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -250.00, 'Home cleaning service', '2026-08-03')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -9.99, 'Spotify subscription', '2026-08-03')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_sub);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -55.90, 'Walmart grocery', '2026-08-02')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_grocery);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -24.75, 'Gas station', '2026-08-02')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_sbi, -870.00, 'Home insurance payment', '2026-08-01')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -36.35, 'Phone bill', '2026-08-01')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_bill);

  RAISE NOTICE '✓ August 2026 transactions inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 5b. TRANSACTIONS — July 2026  (20 transactions)
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -120.00, 'Home repair parts', '2026-07-31')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -87.40, 'Grocery - Costco', '2026-07-30')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_grocery);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -45.00, 'Gym membership', '2026-07-30')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_health);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -9.00, 'Amazon Prime', '2026-07-28')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_sub);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -156.20, 'Dining out - birthday', '2026-07-28')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_dining);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -889.17, 'Loan 1 EMI', '2026-07-27')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, 5200.00, 'Salary July', '2026-07-26')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_income);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_sav, -2000.00, 'India wire transfer', '2026-07-25')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_india);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -48.00, 'Car wash + detailing', '2026-07-24')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -115.00, 'Electricity + water bill', '2026-07-22')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_utils);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -73.10, 'Indian Grocery - weekly', '2026-07-22')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_ig);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -190.00, 'Home décor purchase', '2026-07-20')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -120.48, 'Loan 2 EMI', '2026-07-18')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -33.99, 'Hulu subscription', '2026-07-16')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_sub);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -313.90, 'Car EMI July', '2026-07-15')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -99.50, 'Doctor visit copay', '2026-07-12')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_health);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -102.20, 'Grocery - Whole Foods', '2026-07-10')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_grocery);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -55.75, 'Restaurant dinner', '2026-07-08')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_dining);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -88.50, 'Indian Grocery', '2026-07-05')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_ig);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -29.00, 'Phone bill July', '2026-07-03')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_bill);

  RAISE NOTICE '✓ July 2026 transactions inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 5c. TRANSACTIONS — June 2026  (10 transactions)
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, 5200.00, 'Salary June', '2026-06-30')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_income);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_sav, -2000.00, 'India remittance', '2026-06-28')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_india);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -889.17, 'Loan 1 EMI June', '2026-06-25')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -313.90, 'Car EMI June', '2026-06-22')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -120.48, 'Loan 2 EMI June', '2026-06-20')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_loan);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -250.00, 'Home repairs', '2026-06-18')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -87.60, 'Grocery run', '2026-06-15')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_grocery);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_hdfc, -62.50, 'Dining - sushi place', '2026-06-12')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_dining);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -115.00, 'Electric bill June', '2026-06-10')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_utils);

  INSERT INTO public.transactions (user_id, account_id, amount, description, date)
  VALUES (uid, acc_op, -38.40, 'Gas station', '2026-06-05')
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_car);

  RAISE NOTICE '✓ June 2026 transactions inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 5d. Special transactions — Untagged & Deleted
  -- ─────────────────────────────────────────────────────────────────────────

  -- Untagged (no tags, appears in UNTAGGED tab)
  INSERT INTO public.transactions (user_id, account_id, amount, description, date, is_untagged)
  VALUES (uid, acc_hdfc, -200.00, 'Unknown charge', '2026-07-15', TRUE)
  RETURNING id INTO tx_id;
  -- intentionally no transaction_tags row

  -- Soft-deleted (appears in DELETED tab only)
  INSERT INTO public.transactions (user_id, account_id, amount, description, date, is_deleted)
  VALUES (uid, acc_op, -500.00, 'Old transaction deleted', '2026-06-01', TRUE)
  RETURNING id INTO tx_id;
  INSERT INTO public.transaction_tags VALUES (tx_id, tag_home);

  RAISE NOTICE '✓ Special transactions (untagged + deleted) inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 6. IOUs
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.ious (user_id, person_name, amount, direction, note, date)
  VALUES
    (uid, 'Rahul Kumar', 250.00, 'owe_me', 'Dinner split',    '2026-08-05'),
    (uid, 'Priya S',      80.00, 'i_owe',  'Movie tickets',   '2026-08-04'),
    (uid, 'Arjun M',     120.50, 'owe_me', 'Grocery split',   '2026-07-28');

  RAISE NOTICE '✓ IOUs inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 7. REPEATING TRANSACTIONS
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_op, 'Loan 1 EMI', -889.17, 'Monthly', '2026-08-27')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_loan);

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_op, 'Car EMI', -313.90, 'Monthly', '2026-08-15')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_car);

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_op, 'Loan 2 EMI', -120.48, 'Monthly', '2026-08-18')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_loan);

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_hdfc, 'Netflix', -45.99, 'Monthly', '2026-09-07')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_sub);

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_op, 'India Wire Transfer', -2000.00, 'Monthly', '2026-09-05')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_india);

  INSERT INTO public.repeating_transactions (user_id, account_id, description, amount, frequency, next_date)
  VALUES (uid, acc_op, 'Salary', 5200.00, 'Monthly', '2026-09-06')
  RETURNING id INTO rep_id;
  INSERT INTO public.repeating_transaction_tags VALUES (rep_id, tag_income);

  RAISE NOTICE '✓ Repeating transactions inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  -- 8. FAVORITES
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.favorites (user_id, name, type, icon, sort_order)
  VALUES
    (uid, 'Monthly Expense Summary', 'report', 'bar-chart',    1),
    (uid, 'India Transfers',         'filter', 'filter',        2),
    (uid, 'Loan Tracker',            'report', 'trending-down', 3);

  RAISE NOTICE '✓ Favorites inserted';


  -- ─────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '';
  RAISE NOTICE '════ Seed data complete for user % ════', uid;
  RAISE NOTICE 'Totals: 5 accounts | 14 tags | 8 budgets | 52 transactions | 3 ious | 6 repeating | 3 favorites';
  RAISE NOTICE '';

END $$;


-- ─── Verify counts ────────────────────────────────────────────────────────
-- Uncomment these to verify after running:
-- SELECT 'accounts' AS tbl, COUNT(*) FROM public.accounts;
-- SELECT 'tags'     AS tbl, COUNT(*) FROM public.tags;
-- SELECT 'budgets'  AS tbl, COUNT(*) FROM public.budgets;
-- SELECT 'transactions' AS tbl, COUNT(*) FROM public.transactions;
-- SELECT 'ious'     AS tbl, COUNT(*) FROM public.ious;
-- SELECT * FROM public.v_budget_status   LIMIT 10;
-- SELECT * FROM public.v_monthly_summary LIMIT 6;
