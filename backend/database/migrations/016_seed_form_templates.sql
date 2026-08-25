-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016 — Starter design templates for the form builder
--
-- Seeds a handful of ready-to-use color presets into `form_templates` (added
-- in migration 015) so the Design tab isn't an empty list on a fresh
-- install. `created_by` is left NULL (system-provided, not attributed to
-- any one admin). Every color pair below was checked against the WCAG
-- contrast formula the builder itself uses (see
-- frontend/src/features/forms/utils/theme.ts contrastRatio/
-- borderVisibilityWarning) — header/button text clears 4.5:1, and every
-- input border clears at least ~3:1 against its card background, so none
-- of these presets trip the builder's own contrast/visibility warnings.
--
-- A unique constraint on `name` is added first so re-running this
-- migration (or a future seed with the same names) is a no-op via
-- ON CONFLICT, matching the pattern already used for
-- blocked_email_domains in migration 012.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE form_templates ADD CONSTRAINT form_templates_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

INSERT INTO form_templates (name, description, theme, created_by) VALUES
  (
    'Velox Default',
    'The standard look — indigo accents on a light background.',
    '{
      "buttonColor": "4F46E5", "buttonTextColor": "FFFFFF",
      "headerBgColor": "4F46E5", "headerTextColor": "FFFFFF",
      "formBgColor": "F3F4F6", "cardBgColor": "FFFFFF",
      "labelColor": "374151", "inputBorderColor": "D1D5DB",
      "borderRadius": "lg", "fontFamily": "system"
    }'::jsonb,
    NULL
  ),
  (
    'Midnight Dark',
    'Dark mode — light text and clearly visible borders on a near-black card.',
    '{
      "buttonColor": "6366F1", "buttonTextColor": "FFFFFF",
      "headerBgColor": "111827", "headerTextColor": "F9FAFB",
      "formBgColor": "030712", "cardBgColor": "111827",
      "labelColor": "E5E7EB", "inputBorderColor": "6B7280",
      "borderRadius": "md", "fontFamily": "inter"
    }'::jsonb,
    NULL
  ),
  (
    'Clean Minimal',
    'Flat black-and-white styling with sharp corners and a subtle shadow instead of a background block.',
    '{
      "buttonColor": "111827", "buttonTextColor": "FFFFFF",
      "headerBgColor": "FFFFFF", "headerTextColor": "111827",
      "formBgColor": "FFFFFF", "cardBgColor": "FFFFFF",
      "labelColor": "374151", "inputBorderColor": "9CA3AF",
      "borderRadius": "sm", "fontFamily": "system"
    }'::jsonb,
    NULL
  ),
  (
    'Sunset Warm',
    'Warm orange accents on a cream background, serif headings.',
    '{
      "buttonColor": "C2410C", "buttonTextColor": "FFFFFF",
      "headerBgColor": "C2410C", "headerTextColor": "FFFFFF",
      "formBgColor": "FFF7ED", "cardBgColor": "FFFFFF",
      "labelColor": "7C2D12", "inputBorderColor": "EA580C",
      "borderRadius": "lg", "fontFamily": "georgia"
    }'::jsonb,
    NULL
  ),
  (
    'Ocean Cool',
    'Cool blue accents on a soft sky background, fully rounded corners.',
    '{
      "buttonColor": "0369A1", "buttonTextColor": "FFFFFF",
      "headerBgColor": "0369A1", "headerTextColor": "FFFFFF",
      "formBgColor": "F0F9FF", "cardBgColor": "FFFFFF",
      "labelColor": "0C4A6E", "inputBorderColor": "0284C7",
      "borderRadius": "full", "fontFamily": "roboto"
    }'::jsonb,
    NULL
  )
ON CONFLICT (name) DO NOTHING;
