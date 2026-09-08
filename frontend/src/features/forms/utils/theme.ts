// Shared theme resolution + rendering helpers — used by the builder's
// Design tab, the builder preview pane, and the public/embedded form
// renderer, so all three can never drift from each other.
import {
  DEFAULT_FORM_THEME,
  BORDER_RADIUS_PRESETS,
  FONT_FAMILY_OPTIONS,
  HEX_COLOR_RE,
  type FormTheme,
} from '../types'

/** Merge a partial/undefined theme over the documented defaults. */
export function resolveTheme(theme: FormTheme | undefined): Required<FormTheme> {
  return { ...DEFAULT_FORM_THEME, ...(theme ?? {}) }
}

/** Darken a 6-digit hex (no '#') by a fixed amount — used to auto-derive
 * hover/active states from a single button color rather than asking for a
 * separate hover color picker. */
export function darkenHex(hex: string, amount = 20): string {
  const clean = HEX_COLOR_RE.test(hex) ? hex : DEFAULT_FORM_THEME.buttonColor
  const n = parseInt(clean, 16)
  const r = Math.max(0, ((n >> 16) & 255) - amount)
  const g = Math.max(0, ((n >> 8) & 255) - amount)
  const b = Math.max(0, (n & 255) - amount)
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

/** Lighten a 6-digit hex (no '#') — used for e.g. focus rings. */
export function lightenHex(hex: string, amount = 40): string {
  const clean = HEX_COLOR_RE.test(hex) ? hex : DEFAULT_FORM_THEME.buttonColor
  const n = parseInt(clean, 16)
  const r = Math.min(255, ((n >> 16) & 255) + amount)
  const g = Math.min(255, ((n >> 8) & 255) + amount)
  const b = Math.min(255, (n & 255) + amount)
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

/** WCAG relative luminance for a 6-digit hex (no '#'). */
function relativeLuminance(hex: string): number {
  const clean = HEX_COLOR_RE.test(hex) ? hex : '000000'
  const n = parseInt(clean, 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG contrast ratio between two 6-digit hex colors (no '#'), 1–21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG AA for normal-size UI text/buttons is 4.5:1 (3:1 for large text —
 * we use the stricter bar since button/header text size varies). Returns a
 * warning message, or null if the pairing passes. Advisory only — saving
 * isn't blocked on this. */
export function contrastWarning(bg: string, fg: string, context: string): string | null {
  const ratio = contrastRatio(bg, fg)
  if (ratio < 4.5) {
    return `${context}: contrast ratio ${ratio.toFixed(2)}:1 is below the WCAG AA minimum of 4.5:1 — text may be hard to read.`
  }
  return null
}

/** Borders don't carry text, so the 4.5:1 text bar doesn't apply — but a
 * border that's too close in luminance to the surface behind it stops
 * being visible at all (e.g. a light gray border on a white card). WCAG
 * 1.4.11 (non-text contrast) recommends 3:1 for UI component boundaries;
 * used here as an advisory-only "will this even be visible" check. */
export function borderVisibilityWarning(surfaceBg: string, borderColor: string): string | null {
  const ratio = contrastRatio(surfaceBg, borderColor)
  if (ratio < 1.8) {
    return `Input border: contrast ratio ${ratio.toFixed(2)}:1 against the form background is very low — the border will be barely visible. Try a darker or more saturated color.`
  }
  if (ratio < 3) {
    return `Input border: contrast ratio ${ratio.toFixed(2)}:1 against the form background is low — the border may be hard to see for some visitors.`
  }
  return null
}

/** Validate a (possibly partial) theme object the same way on the client
 * as `formService.js` does on the server — keeps error messages consistent
 * and lets the builder show inline errors before ever hitting the API. */
export function validateThemeShape(theme: unknown): string[] {
  const errors: string[] = []
  if (theme == null) return errors
  if (typeof theme !== 'object') return ['theme must be an object']
  const t = theme as Record<string, unknown>

  const colorFields = [
    'buttonColor', 'buttonTextColor', 'headerBgColor', 'headerTextColor',
    'formBgColor', 'cardBgColor', 'labelColor', 'inputBorderColor',
    'inputBgColor', 'inputTextColor',
  ] as const
  for (const field of colorFields) {
    const v = t[field]
    if (v !== undefined && (typeof v !== 'string' || !HEX_COLOR_RE.test(v))) {
      errors.push(`theme.${field} must be a 6-digit hex color without '#' (got ${JSON.stringify(v)})`)
    }
  }
  if (t.borderRadius !== undefined && !(t.borderRadius as string in BORDER_RADIUS_PRESETS)) {
    errors.push(`theme.borderRadius must be one of: ${Object.keys(BORDER_RADIUS_PRESETS).join(', ')}`)
  }
  if (t.fontFamily !== undefined && !FONT_FAMILY_OPTIONS.some((f) => f.value === t.fontFamily)) {
    errors.push(`theme.fontFamily must be one of: ${FONT_FAMILY_OPTIONS.map((f) => f.value).join(', ')}`)
  }
  if (t.showHeader !== undefined && typeof t.showHeader !== 'boolean') {
    errors.push('theme.showHeader must be a boolean')
  }
  return errors
}

// ── Concrete inline styles ──────────────────────────────────────────
// Shared by both the builder's live preview pane (FormBuilderPage) and the
// actual public/embedded form (PublicFormPage) so the two can never
// visually drift from each other — same theme in, same styles out.
export function themeFontStyle(theme: Required<FormTheme>): React.CSSProperties {
  const font = FONT_FAMILY_OPTIONS.find((f) => f.value === theme.fontFamily)?.css
    ?? FONT_FAMILY_OPTIONS[0].css
  return { fontFamily: font }
}

export function themePageStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { backgroundColor: `#${theme.formBgColor}`, ...themeFontStyle(theme) }
}

export function themeCardStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { backgroundColor: `#${theme.cardBgColor}`, borderRadius: BORDER_RADIUS_PRESETS[theme.borderRadius] }
}

export function themeHeaderStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { background: `linear-gradient(135deg, #${theme.headerBgColor}, #${darkenHex(theme.headerBgColor)})` }
}

export function themeHeaderTextStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { color: `#${theme.headerTextColor}` }
}

export function themeButtonStyle(theme: Required<FormTheme>): React.CSSProperties {
  return {
    backgroundColor: `#${theme.buttonColor}`,
    color: `#${theme.buttonTextColor}`,
    borderRadius: `calc(${BORDER_RADIUS_PRESETS[theme.borderRadius]} * 0.7)`,
  }
}

export function themeButtonHoverColor(theme: Required<FormTheme>): string {
  return `#${darkenHex(theme.buttonColor)}`
}

export function themeLabelStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { color: `#${theme.labelColor}` }
}

export function themeInputBorderStyle(theme: Required<FormTheme>): React.CSSProperties {
  return { borderColor: `#${theme.inputBorderColor}` }
}

/** Full themed style for an actual input/textarea/select box — border,
 * background, and typed/selected text color. `colorScheme: 'light'` forces
 * the browser to render the control (and its native checkbox/radio/date/
 * select popup chrome) using light-appearance UA styles even when the
 * visitor's OS is in dark mode — without it, Chrome/Firefox silently swap
 * in dark native form-control styling that ignores these inline colors and
 * can render checkboxes/dropdowns almost invisible against a themed card. */
export function themeInputStyle(theme: Required<FormTheme>): React.CSSProperties {
  return {
    borderColor: `#${theme.inputBorderColor}`,
    backgroundColor: `#${theme.inputBgColor}`,
    color: `#${theme.inputTextColor}`,
    colorScheme: 'light',
  }
}

/** Style for a native checkbox/radio `<input>` — accent color plus the same
 * light-appearance forcing as themeInputStyle, so the box itself stays
 * visible against a dark card instead of picking up OS dark-mode UA styles. */
export function themeCheckStyle(theme: Required<FormTheme>): React.CSSProperties {
  return {
    accentColor: `#${theme.buttonColor}`,
    colorScheme: 'light',
  }
}

/** Build the CSS custom properties for a resolved theme, scoped to
 * whatever element receives this as its `style` prop — never written to
 * `document.documentElement` or a global `<style>` tag, so it can't leak
 * into (or be affected by) a host page when the form is embedded in an
 * iframe. */
export function themeCssVars(theme: Required<FormTheme>): React.CSSProperties {
  const font = FONT_FAMILY_OPTIONS.find((f) => f.value === theme.fontFamily)?.css
    ?? FONT_FAMILY_OPTIONS[0].css
  return {
    '--form-button-color': `#${theme.buttonColor}`,
    '--form-button-hover-color': `#${darkenHex(theme.buttonColor)}`,
    '--form-button-text-color': `#${theme.buttonTextColor}`,
    '--form-header-bg-color': `#${theme.headerBgColor}`,
    '--form-header-bg-dark': `#${darkenHex(theme.headerBgColor)}`,
    '--form-header-text-color': `#${theme.headerTextColor}`,
    '--form-bg-color': `#${theme.formBgColor}`,
    '--form-card-bg-color': `#${theme.cardBgColor}`,
    '--form-label-color': `#${theme.labelColor}`,
    '--form-input-border-color': `#${theme.inputBorderColor}`,
    '--form-input-bg-color': `#${theme.inputBgColor}`,
    '--form-input-text-color': `#${theme.inputTextColor}`,
    '--form-focus-ring-color': `#${lightenHex(theme.buttonColor)}`,
    '--form-radius': BORDER_RADIUS_PRESETS[theme.borderRadius],
    '--form-font-family': font,
  } as React.CSSProperties
}
