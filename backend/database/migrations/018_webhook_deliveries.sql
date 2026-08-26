-- ── Migration 018: Webhook delivery log ─────────────────────────────────
-- Conditional "webhook" actions (form_json.webhookRules) POST submission
-- data to admin-configured URLs when their WHEN-conditions match. This
-- table gives admins visibility into every attempt — success or failure —
-- since webhook calls are fire-and-forget from the submitter's point of
-- view and would otherwise fail silently.

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              SERIAL PRIMARY KEY,
  form_id         INT          NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submission_id   INT          REFERENCES form_submissions(id) ON DELETE SET NULL,
  rule_id         VARCHAR(64),                -- id of the WebhookRule (in form_json.webhookRules) that fired
  rule_name       VARCHAR(255),
  url             TEXT         NOT NULL,
  success         BOOLEAN      NOT NULL DEFAULT false,
  status_code     INT,
  error_message   TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_form_id    ON webhook_deliveries(form_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
