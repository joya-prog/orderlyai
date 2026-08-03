-- Billing idempotency constraints
--
-- The application now routes every charge through billCallOnce(), which refuses
-- to bill a call that already has a usage_ledger row. That check is
-- read-then-write, so two webhook deliveries arriving at the same instant can
-- still both pass it. These unique indexes make the database the final arbiter:
-- the second concurrent insert fails instead of double-charging a customer.
--
-- Run this in the Neon SQL editor. Steps 1 and 2 clean up existing duplicates
-- and MUST be reviewed before running step 3 — inspect what they would delete.

-- ---------------------------------------------------------------------------
-- STEP 1 (read-only): find duplicates created before the application fix.
-- ---------------------------------------------------------------------------
-- Duplicate call logs for one call SID:
--   SELECT call_sid, count(*) FROM call_logs
--   WHERE call_sid IS NOT NULL GROUP BY call_sid HAVING count(*) > 1;
--
-- Duplicate ledger rows for one call (i.e. calls charged more than once):
--   SELECT call_log_id, count(*), sum(cost_cents::int) AS total_cents
--   FROM usage_ledger
--   WHERE call_log_id IS NOT NULL GROUP BY call_log_id HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- STEP 2: remove duplicate rows, keeping the earliest of each group.
-- Review the STEP 1 output first — any customer who was double-charged should
-- also be refunded in Stripe; deleting the ledger row alone does not do that.
-- ---------------------------------------------------------------------------
DELETE FROM usage_ledger a
USING usage_ledger b
WHERE a.call_log_id IS NOT NULL
  AND a.call_log_id = b.call_log_id
  AND a.created_at > b.created_at;

DELETE FROM call_logs a
USING call_logs b
WHERE a.call_sid IS NOT NULL
  AND a.call_sid = b.call_sid
  AND a.created_at > b.created_at;

-- ---------------------------------------------------------------------------
-- STEP 3: enforce uniqueness going forward.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS call_logs_call_sid_key
  ON call_logs (call_sid)
  WHERE call_sid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS usage_ledger_call_log_id_key
  ON usage_ledger (call_log_id)
  WHERE call_log_id IS NOT NULL;
