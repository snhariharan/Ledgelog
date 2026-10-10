-- ════════════════════════════════════════════════════════════════════════════
-- EXPENSE TRACKER — 07 Rule conditions (AND / OR / EXCEPT)
-- Run AFTER 05. Safe to re-run.
--
-- Auto-tag rules can combine several description conditions:
--   any   (OR)     at least one of these appears
--   all   (AND)    every one of these appears
--   none  (EXCEPT) none of these appear
-- stored as JSON: { "any": [...], "all": [...], "none": [...] }
--
-- Existing rules (single match_text) keep working unchanged: when
-- `conditions` is NULL the app treats match_text as one "any" term.
-- match_text still holds the first term, as a short label.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS conditions JSONB;
