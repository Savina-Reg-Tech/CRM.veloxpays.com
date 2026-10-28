-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 — VeloxVerse form pass result on each submission
-- Filled when VV_FORM_PASS_MODE is monitor / enforce (see utils/vvFormPass.js):
--   vv_pass_status  valid | missing | invalid | expired | wrong_form
--   vv_pass_country ISO-2 country the pass was issued for (null = unknown)
--   vv_user_id      VeloxVerse user id from the pass
-- Run this BEFORE deploying the CRM build that reads these columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS vv_pass_status  VARCHAR(20);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS vv_pass_country VARCHAR(2);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS vv_user_id      VARCHAR(64);
