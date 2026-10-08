-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — 06 Transaction details
-- Run AFTER 05. Safe to re-run.
--
-- Adds the extra fields captured by the Add Transaction form:
--   status   'cleared' | 'uncleared'
--   url      optional link (receipt, order page, …)
--   details  type-specific extras as JSON, e.g.
--            investment → { "investmentType": "buy" }
--            iou        → { "iouType": "shared_bill", "paidBy": "Me",
--                           "sharedBy": "Me", "sharedByEmail": "…" }
--
-- Existing RLS policies on public.transactions cover the new columns.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status  TEXT  NOT NULL DEFAULT 'cleared',
  ADD COLUMN IF NOT EXISTS url     TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_status_check') THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_status_check CHECK (status IN ('cleared', 'uncleared'));
  END IF;
END $$;
