-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — Allow custom (additional) documents with a user-defined label
--
-- Employees, agents, and affiliates can upload extra documents beyond the
-- role-defined required/optional set. Each custom document carries a
-- human-readable label chosen by the uploader (e.g. "Trade Certificate").
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE verification_documents
  ADD COLUMN IF NOT EXISTS custom_label VARCHAR(100);
