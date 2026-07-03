-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — partial unique index on customers.email
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_active
  ON customers (LOWER(email))
  WHERE deleted_at IS NULL;
