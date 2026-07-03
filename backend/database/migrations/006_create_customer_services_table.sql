-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Customer ↔ Service mapping (row-based, normalized)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_services (
  id           SERIAL        PRIMARY KEY,
  customer_id  INTEGER       NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id   INTEGER       NOT NULL REFERENCES services(id)  ON DELETE RESTRICT,
  status       VARCHAR(40)   NOT NULL DEFAULT 'active',
  enabled_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source       VARCHAR(32)   NOT NULL DEFAULT 'manual',
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  modified_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_customer_services_source CHECK (source IN ('manual', 'veloxpays-sync')),
  CONSTRAINT uq_customer_service UNIQUE (customer_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_services_customer ON customer_services(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_services_service  ON customer_services(service_id);
CREATE INDEX IF NOT EXISTS idx_customer_services_status   ON customer_services(status);
