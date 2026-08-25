-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Form theming: reusable design templates
--
-- Per-form theme values (button/header/background colors, radius, font) live
-- inside the existing `forms.form_json` JSONB column under a `theme` key —
-- no column change needed there, since form_json was already schema-flexible.
--
-- This migration only adds `form_templates`: named, reusable color/style
-- presets a developer can apply to any form. Applying a template copies its
-- `theme` values into that form's form_json at apply-time (handled in
-- application code) — templates are never referenced live by forms, so
-- editing or deleting a template never changes a form that already applied
-- it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS form_templates (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  theme        JSONB        NOT NULL,
  created_by   INT          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_templates_created_by ON form_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_form_templates_name       ON form_templates(name);

-- Reuses the same trigger function created in migration 012.
DO $$ BEGIN
  CREATE TRIGGER trg_form_templates_updated_at
    BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
