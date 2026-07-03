-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Expand user_role enum
-- Adds: admin, agent, affiliate
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'affiliate';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
