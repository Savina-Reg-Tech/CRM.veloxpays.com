-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017 — Input background/text color theming
--
-- Adds two new theme fields (inputBgColor, inputTextColor — see
-- frontend/src/features/forms/types.ts FormTheme). No schema change is
-- needed since `theme` is already a JSONB column; forms/templates saved
-- before this migration simply fall back to the new defaults
-- (inputBgColor: FFFFFF, inputTextColor: 111827) via resolveTheme(), which
-- exactly matches the hardcoded white-background/default-text look every
-- input already had — so this is a no-op for every existing light-themed
-- form and template.
--
-- The one template that genuinely needs an explicit override is "Midnight
-- Dark" (seeded in migration 016): its card is near-black (111827), so
-- inputs left at the white/black default would render as bright white
-- boxes that clash with — and are inconsistent with — its own "dark mode"
-- description. This backfills that one template with a dark input
-- background and light input text so it actually looks like dark mode.
-- Colors checked against the WCAG contrast formula the builder itself uses:
-- inputBgColor 1F2937 vs inputTextColor F9FAFB clears well above 4.5:1, and
-- the existing inputBorderColor (6B7280) stays clearly visible against both
-- the card (111827) and the new input background (1F2937).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE form_templates
SET theme = theme || '{"inputBgColor": "1F2937", "inputTextColor": "F9FAFB"}'::jsonb
WHERE name = 'Midnight Dark';
