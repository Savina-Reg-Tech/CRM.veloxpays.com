-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020 — Add the 'support' CRM role
-- Customer-support staff: read-only, masked access to the VeloxVerse customer
-- journey audit log (VeloxVerse maps the CRM role claim "support" → SUPPORT).
-- No document verification (internal staff, like admins).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'support';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
