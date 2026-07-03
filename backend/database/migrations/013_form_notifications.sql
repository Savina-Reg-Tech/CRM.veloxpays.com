-- ── Migration 013: Form email notifications & auto-responder ──────────────
-- Adds notification settings columns to the forms table.

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS notify_on_submission   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_emails          TEXT[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_respond           BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_respond_subject   TEXT         NOT NULL DEFAULT 'Thanks for reaching out!',
  ADD COLUMN IF NOT EXISTS auto_respond_body      TEXT         NOT NULL DEFAULT 'Hi {{name}},\n\nThank you for your submission. We have received your message and will get back to you shortly.\n\nBest regards,\nThe Team';
