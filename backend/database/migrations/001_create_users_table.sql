-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Create users table
-- Run with:  psql -U postgres -d crm_db -f 001_create_users_table.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Enum type for roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'employee', 'agent', 'affiliate');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL        PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  email        VARCHAR(255)  NOT NULL UNIQUE,
  password     TEXT          NOT NULL,
  role         user_role     NOT NULL DEFAULT 'employee',
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by   INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(), 
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index on email for fast lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on role for listing employees quickly
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
