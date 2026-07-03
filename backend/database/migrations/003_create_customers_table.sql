-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Customers (end-customer personal info, system of record)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL        PRIMARY KEY,
  first_name      VARCHAR(100)  NOT NULL,
  middle_name     VARCHAR(100),
  last_name       VARCHAR(100)  NOT NULL,
  dob             DATE,
  email           VARCHAR(255)  NOT NULL,
  phone           VARCHAR(40),
  address_line1   VARCHAR(255),
  city            VARCHAR(120),
  country         VARCHAR(100),
  status          VARCHAR(40)   NOT NULL DEFAULT 'active',
  source          VARCHAR(32)   NOT NULL DEFAULT 'manual',
  source_ref      VARCHAR(255),
  created_by      INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  modified_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_customers_source CHECK (source IN ('manual', 'veloxpays-sync'))
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(id) WHERE deleted_at IS NULL;
