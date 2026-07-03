-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Upgrade legacy customers (full_name / services) → personal-info model
-- Safe no-op if customers already uses first_name (new schema).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'full_name'
  ) THEN
    RETURN;
  END IF;

  CREATE TABLE customers__v2 (
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
    CONSTRAINT customers__v2_source_chk CHECK (source IN ('manual', 'veloxpays-sync'))
  );

  INSERT INTO customers__v2 (
    id,
    first_name,
    middle_name,
    last_name,
    dob,
    email,
    phone,
    address_line1,
    city,
    country,
    status,
    source,
    source_ref,
    created_by,
    created_at,
    modified_at,
    deleted_at
  )
  SELECT
    c.id,
    COALESCE(NULLIF(trim(split_part(c.full_name, ' ', 1)), ''), 'Unknown'),
    NULL,
    COALESCE(
      NULLIF(
        trim(substring(c.full_name from length(trim(split_part(c.full_name, ' ', 1))) + 2)),
        ''
      ),
      'Customer'
    ),
    NULL,
    lower(trim(c.email)),
    NULL,
    NULL,
    NULL,
    NULL,
    CASE WHEN c.kyc_completed THEN 'verified' ELSE 'pending' END,
    'manual',
    c.customer_uid,
    c.created_by,
    c.created_at,
    COALESCE(c.updated_at, c.created_at),
    NULL
  FROM customers c
  ORDER BY c.id;

  DROP TABLE customers CASCADE;
  ALTER TABLE customers__v2 RENAME TO customers;

  PERFORM setval(
    pg_get_serial_sequence('customers', 'id'),
    COALESCE((SELECT MAX(id) FROM customers), 1),
    true
  );

  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
  CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
  CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
  CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(id) WHERE deleted_at IS NULL;
END $$;
