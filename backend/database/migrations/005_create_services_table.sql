-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Services (master service catalog)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS services (
  id           SERIAL        PRIMARY KEY,
  code         VARCHAR(32)   NOT NULL UNIQUE,
  name         VARCHAR(120)  NOT NULL,
  description  TEXT,
  vendor       VARCHAR(120),
  is_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_services_code CHECK (
    code IN ('FLIGHTS','LOUNGE','ASSIST','ESIM','EGIFT','MTO')
  )
);

CREATE INDEX IF NOT EXISTS idx_services_code ON services(code);
CREATE INDEX IF NOT EXISTS idx_services_is_enabled ON services(is_enabled);

-- Seed the master catalog (idempotent)
INSERT INTO services (code, name, description, vendor) VALUES
  ('FLIGHTS', 'Flights',         'Air ticket bookings and management',          'Velox'),
  ('LOUNGE',  'Airport Lounge',  'Airport lounge access and reservations',      'Velox'),
  ('ASSIST',  'Airport Assist',  'Airport meet & assist services',              'Velox'),
  ('ESIM',    'eSIM',            'International eSIM data packs',               'Velox'),
  ('EGIFT',   'eGift',           'Digital gift cards',                          'Velox'),
  ('MTO',     'Money Transfer',  'Cross-border money transfer (MTO)',           'Velox')
ON CONFLICT (code) DO NOTHING;
