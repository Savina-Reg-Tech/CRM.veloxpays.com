-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — drop the hardcoded service-code CHECK constraint
--
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_code;
