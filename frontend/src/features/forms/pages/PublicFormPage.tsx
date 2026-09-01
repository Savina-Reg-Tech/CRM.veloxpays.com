/**
 * Public form renderer — accessible at /embed/:formId without auth.
 *
 * Responsive: single column on mobile, half-width grid on sm+.
 *
 * Theming precedence (lowest to highest):
 *   1. DEFAULT_FORM_THEME (frontend/src/features/forms/types.ts)
 *   2. The form's own persisted `form_json.theme`, set via the builder's
 *      Design tab — this is the normal source of truth for a form's colors.
 *   3. URL query params — an optional override layer on top, for iframe
 *      embeds / white-label use cases that need a one-off variation without
 *      editing the form itself:
 *        ?color=4F46E5          — legacy single override: sets BOTH the
 *                                 header background and the button color at
 *                                 once (this was the only option before
 *                                 button/header had independent colors —
 *                                 kept working exactly as before).
 *        ?buttonColor=4F46E5    — button background only
 *        ?buttonTextColor=FFFFFF
 *        ?headerBgColor=4F46E5  — header band background only
 *        ?headerTextColor=FFFFFF
 *        ?radius=16             — card/input border radius in px
 *        ?bg=F9FAFB             — page background color
 *        ?cardBg=FFFFFF         — form card background
 *        ?labelColor=374151     — label text color
 *        ?inputBorderColor=D1D5DB — border around text fields/dropdowns
 *        ?inputBgColor=FFFFFF   — background inside text fields/dropdowns
 *        ?inputTextColor=111827 — text typed/selected inside inputs
 *
 * Every theme value is applied via inline `style` on the specific element it
 * affects (never a global `<style>` tag or `document.documentElement`), so
 * it's inherently scoped to this form and can't leak into — or be affected
 * by — a host page when embedded in an iframe.
 *
 * Example embed:
 *   <iframe src="/embed/42?color=E11D48&radius=8&bg=FFF1F2" />
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { ConditionalRule, Form, FormField, FormTheme } from '../types'
import { BORDER_RADIUS_PRESETS, NAVIGATION_ACTION_TYPES } from '../types'
import { layoutFields } from '../utils/layoutFields'
import { resolveTheme } from '../utils/theme'
import { parseInlineLinks } from '../utils/richText'
import { evaluateGroup, evaluateRules, isEffectivelyRequired, resolveOnSubmitOutcome, type RuleEvaluationResult } from '../utils/rules'
import { PUBLIC_API_BASE_URL } from '@/lib/apiConfig'

const PUBLIC_API = PUBLIC_API_BASE_URL

// ── Theme helpers ─────────────────────────────────────────────────

function darken(hex: string, amount = 20): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, ((n >> 16) & 255) - amount)
  const g = Math.max(0, ((n >> 8) & 255) - amount)
  const b = Math.max(0, (n & 255) - amount)
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

interface Theme {
  primary: string       // button color, hex without # — also drives focus
                         // rings / radio-checkbox accents throughout the form
  primaryDark: string   // auto-derived hover/dark variant of `primary`
  buttonTextColor: string
  headerBg: string
  headerBgDark: string  // auto-derived, for the header gradient
  headerTextColor: string
  radius: string        // css value e.g. "16px"
  bg: string
  cardBg: string
  labelColor: string
  inputBorderColor: string
  inputBgColor: string
  inputTextColor: string
}

function buildTheme(params: URLSearchParams, formTheme?: FormTheme): Theme {
  const resolved = resolveTheme(formTheme)
  const legacyColor = params.get('color') // pre-dates independent button/header theming

  const primary = params.get('buttonColor') ?? legacyColor ?? resolved.buttonColor
  const buttonTextColor = params.get('buttonTextColor') ?? resolved.buttonTextColor
  const headerBg = params.get('headerBgColor') ?? legacyColor ?? resolved.headerBgColor
  const headerTextColor = params.get('headerTextColor') ?? resolved.headerTextColor
  const defaultRadiusPx = parseInt(BORDER_RADIUS_PRESETS[resolved.borderRadius], 10) || 16
  const radius = params.get('radius') ?? String(defaultRadiusPx)
  const bg = params.get('bg') ?? resolved.formBgColor
  const cardBg = params.get('cardBg') ?? resolved.cardBgColor
  const labelColor = params.get('labelColor') ?? resolved.labelColor
  const inputBorderColor = params.get('inputBorderColor') ?? resolved.inputBorderColor
  const inputBgColor = params.get('inputBgColor') ?? resolved.inputBgColor
  const inputTextColor = params.get('inputTextColor') ?? resolved.inputTextColor

  return {
    primary,
    primaryDark: darken(primary),
    buttonTextColor,
    headerBg,
    headerBgDark: darken(headerBg),
    headerTextColor,
    radius: `${parseInt(radius, 10) || 16}px`,
    bg,
    cardBg,
    labelColor,
    inputBorderColor,
    inputBgColor,
    inputTextColor,
  }
}

// ── Email domain typo detection ───────────────────────────────────
const COMMON_DOMAINS: Record<string, string> = {
  // Gmail typos
  'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmailcom': 'gmail.com',
  'gma.com': 'gmail.com', 'gmali.com': 'gmail.com', 'gmaul.com': 'gmail.com',
  'gmil.com': 'gmail.com', 'gmill.com': 'gmail.com', 'gemail.com': 'gmail.com',
  // Yahoo typos
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'yahooo.co.uk': 'yahoo.co.uk', 'yhaoo.com': 'yahoo.com',
  // Hotmail typos
  'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'homail.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  // Outlook typos
  'outloook.com': 'outlook.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com',
  // iCloud typos
  'icoud.com': 'icloud.com', 'iclod.com': 'icloud.com',
}

function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  const domain = email.slice(at + 1).toLowerCase()
  const fix = COMMON_DOMAINS[domain]
  return fix ? email.slice(0, at + 1) + fix : null
}

function EmailInput({ field, inputCls, inputStyle, focusStyle, disabled, required }: {
  field: FormField
  inputCls: string
  inputStyle: React.CSSProperties
  focusStyle: React.CSSProperties
  theme: Theme
  disabled?: boolean
  required?: boolean
}) {
  const [value, setValue] = useState(field.defaultValue ?? '')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear errors when user starts typing again
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setSuggestion(null)
    setValidationError(null)
    inputRef.current?.setCustomValidity('')
  }

  const handleBlur = async () => {
    const trimmed = value.trim()
    if (!trimmed) return

    // 1. Typo suggestion (instant, no network)
    const fix = suggestEmailFix(trimmed)
    setSuggestion(fix)

    // 2. Real-time validation via backend (MX + disposable check)
    // Only validate if it looks like a complete email address
    if (!trimmed.includes('@') || !trimmed.includes('.')) return

    setValidating(true)
    setValidationError(null)
    try {
      const res = await fetch(
        `${PUBLIC_API}/validate-email?email=${encodeURIComponent(trimmed)}`
      )
      const json = await res.json()
      if (json.success && !json.data.valid) {
        setValidationError(json.data.reason)
        // setCustomValidity integrates with HTML5 form validation —
        // form.reportValidity() will return false and block Next/Submit
        inputRef.current?.setCustomValidity(json.data.reason)
      } else {
        inputRef.current?.setCustomValidity('')
      }
    } catch {
      // Network error — don't block submission, let backend handle it
      inputRef.current?.setCustomValidity('')
    } finally {
      setValidating(false)
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    setValue(suggestion)
    setSuggestion(null)
    setValidationError(null)
    inputRef.current?.setCustomValidity('')
    // Re-validate the corrected email
    setTimeout(() => inputRef.current?.dispatchEvent(new Event('blur')), 0)
  }

  // Only override the themed border color when flagging a hard validation
  // error — otherwise fall through to whatever inputStyle.borderColor was
  // already set to (the form's own themed input border color). Spreading
  // an explicit `borderColor: undefined` key would still win over the
  // earlier spread and blank the border out, so this is only included when
  // there's actually an error to show.
  const errorBorderStyle: React.CSSProperties = validationError ? { borderColor: '#EF4444' } : {}

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="email"
          name={field.id}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle, ...errorBorderStyle }}
          placeholder={field.placeholder}
          required={required}
          disabled={disabled}
        />
        {/* Validating spinner */}
        {validating && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
        {/* Valid checkmark */}
        {!validating && !validationError && value.includes('@') && value.includes('.') && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">✓</div>
        )}
      </div>

      {/* Hard validation error — blocks submission */}
      {validationError && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {validationError}
        </p>
      )}

      {/* Soft typo suggestion */}
      {!validationError && suggestion && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
          <span>Did you mean</span>
          <button
            type="button"
            onClick={applySuggestion}
            className="font-semibold underline underline-offset-2 hover:text-amber-700"
          >
            {suggestion}
          </button>
          <span>?</span>
          <button
            type="button"
            onClick={() => setSuggestion(null)}
            className="ml-auto text-gray-400 hover:text-gray-600 text-[10px]"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Field renderer ────────────────────────────────────────────────
interface FieldRendererProps {
  field: FormField
  theme: Theme
  /** True when a conditional rule (see utils/rules.ts) currently hides this
   * field. The wrapper stays mounted (not unmounted) so a value the visitor
   * already typed survives being hidden and shown again — visibility is
   * done via the native `hidden` attribute on the wrapper (visual) plus
   * `disabled` on the actual control(s) (excludes it from both HTML5
   * required-validation and FormData/submission, which is what actually
   * matters — a merely-hidden-via-CSS required field would still block
   * submission in most browsers). */
  hidden: boolean
  /** Folds in any rule-driven require_field/unrequire_field override —
   * falls back to the field's own base `required` when no rule touches it. */
  effectiveRequired: boolean
}

function FieldRenderer({ field, theme, hidden, effectiveRequired }: FieldRendererProps) {
  if (field.type === 'hidden') return null

  // `colorScheme: 'light'` keeps native control chrome (checkbox/radio
  // boxes, the select popup, the date picker) rendering with light-appearance
  // UA styles even when the visitor's OS is in dark mode — otherwise the
  // browser silently swaps in dark native styling that ignores these inline
  // colors and can make a checkbox almost invisible against a themed card.
  const inputStyle: React.CSSProperties = {
    borderRadius: `calc(${theme.radius} * 0.6)`,
    borderColor: `#${theme.inputBorderColor}`,
    backgroundColor: `#${theme.inputBgColor}`,
    color: `#${theme.inputTextColor}`,
    colorScheme: 'light',
  }
  const inputCls = 'w-full px-3 py-2 text-sm border focus:outline-none focus:ring-2 transition-shadow'
  const focusStyle = { '--tw-ring-color': `#${theme.primary}55` } as React.CSSProperties
  const checkStyle: React.CSSProperties = { accentColor: `#${theme.primary}`, colorScheme: 'light' }
  const required = !hidden && effectiveRequired

  return (
    <div hidden={hidden}>
      <label className="block text-sm font-semibold mb-1" style={{ color: `#${theme.labelColor}` }}>
        {field.label}
        {effectiveRequired && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          rows={4}
          placeholder={field.placeholder}
          required={required}
          disabled={hidden}
        />
      ) : field.type === 'dropdown' ? (
        <select
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          required={required}
          disabled={hidden}
          defaultValue=""
        >
          <option value="" disabled>{field.placeholder || 'Select an option…'}</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'radio' ? (
        <div className="space-y-2">
          {field.options?.map((o) => (
            <label key={o} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: `#${theme.labelColor}` }}>
              <input
                type="radio"
                name={field.id}
                value={o}
                required={required}
                disabled={hidden}
                style={checkStyle}
              />
              {parseInlineLinks(o)}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        // No `required` here — unlike same-name radios (where the browser natively treats
        // `required` as "at least one of the group"), `required` on a checkbox has no group
        // concept: the browser demands THAT SPECIFIC box be checked. Putting it on every box in
        // a required checkbox group used to silently demand ALL options be checked, not "pick
        // one or more". The real "at least one checked" requirement is enforced in JS via
        // setCustomValidity inside recomputeRules (applyCheckboxGroupValidity below), which
        // re-runs on every input/change so it stays correct as boxes are (un)checked.
        <div className="space-y-2">
          {field.options?.map((o) => (
            <label key={o} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: `#${theme.labelColor}` }}>
              <input
                type="checkbox"
                name={`${field.id}[]`}
                value={o}
                disabled={hidden}
                style={checkStyle}
              />
              {parseInlineLinks(o)}
            </label>
          ))}
        </div>
      ) : field.type === 'date' ? (
        <input
          type="date"
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          required={required}
          disabled={hidden}
        />
      ) : field.type === 'file' ? (
        <div
          className="relative border-2 border-dashed p-4 text-center text-sm text-gray-400 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ borderRadius: inputStyle.borderRadius, borderColor: `#${theme.inputBorderColor}` }}
        >
          <input type="file" name={field.id} required={required} disabled={hidden} className="absolute inset-0 opacity-0 cursor-pointer" />
          Click to upload a file
        </div>
      ) : field.type === 'section' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-gray-900">{field.label}</p>
          {field.helpText && (
            <p className="text-sm text-gray-600 whitespace-pre-line">{field.helpText}</p>
          )}
        </div>
      ) : field.type === 'email' ? (
        <EmailInput field={field} inputCls={inputCls} inputStyle={inputStyle} focusStyle={focusStyle} theme={theme} required={required} disabled={hidden} />
      ) : (
        <input
          type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          placeholder={field.placeholder}
          required={required}
          disabled={hidden}
          defaultValue={field.defaultValue}
        />
      )}

      {field.helpText && <p className="text-xs text-gray-400 mt-1.5">{field.helpText}</p>}
    </div>
  )
}

// ── Collect FormData into a plain object ──────────────────────────
// File inputs are deliberately skipped here — a File object can't survive JSON.stringify (it
// serializes to `{}`, silently discarding the upload). Actual files are appended as their own
// multipart parts in handleSubmit instead; the backend re-attaches each one onto `data[fieldId]`
// as a structured descriptor once it's stored (see publicFormController.js's handleSubmitForm).
function collectFormData(formEl: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  new FormData(formEl).forEach((value, key) => {
    if (value instanceof File) return
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2)
      if (Array.isArray(data[k])) (data[k] as string[]).push(value as string)
      else data[k] = [value as string]
    } else {
      data[key] = value
    }
  })
  return data
}

// ── Enforce "at least one checked" on required checkbox-group fields ──
// See the comment on the checkbox branch of FieldRenderer for why this can't just be the
// `required` HTML attribute. Sets a custom validity message on the group's first checkbox only
// (so a required, still-empty group reports exactly one native validation error, not one per
// option) and clears it — on every checkbox in the group — as soon as any box is checked, or if
// the field isn't currently required (e.g. hidden by a rule, or unrequired by a rule override).
function applyCheckboxGroupValidity(formEl: HTMLFormElement, fields: FormField[], ruleState: RuleEvaluationResult) {
  for (const field of fields) {
    if (field.type !== 'checkbox') continue
    const boxes = formEl.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(field.id)}[]"]`)
    if (boxes.length === 0) continue
    const required = !ruleState.hidden.has(field.id) && isEffectivelyRequired(field, ruleState.requiredOverride)
    const anyChecked = Array.from(boxes).some((b) => b.checked)
    const needsMessage = required && !anyChecked
    boxes.forEach((b, i) => {
      b.setCustomValidity(needsMessage && i === 0 ? 'Please select at least one option.' : '')
    })
  }
}

// ── Apply a rule's set_value/clear_value action directly to the DOM ──
// Most fields on this form are uncontrolled (no React state backing their
// value), so a rule-driven "set value" has to write straight to the actual
// input(s) rather than through React. Dispatching a real 'input' event
// afterward lets the same delegated listener that triggered this action
// re-evaluate rules against the new value — which is how a set_value on one
// field can go on to satisfy another rule's condition (a normal, finite
// cascade; circular cascades are refused at save time, see utils/rules.ts
// findRuleCycle).
function applyValueAction(formEl: HTMLFormElement, fieldId: string, value: string | null) {
  const escaped = CSS.escape(fieldId)

  const checkboxes = formEl.querySelectorAll<HTMLInputElement>(`[name="${escaped}[]"]`)
  if (checkboxes.length > 0) {
    const wanted = value === null ? [] : value.split(',').map((v) => v.trim())
    checkboxes.forEach((cb) => { cb.checked = wanted.includes(cb.value) })
    checkboxes[0]?.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  const radios = formEl.querySelectorAll<HTMLInputElement>(`[name="${escaped}"][type="radio"]`)
  if (radios.length > 0) {
    radios.forEach((r) => { r.checked = value !== null && r.value === value })
    radios[0]?.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  const el = formEl.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${escaped}"]`)
  if (!el) return
  el.value = value ?? ''
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── Step navigation ──────────────────────────────────────────────
type StepNavResult =
  | { kind: 'goto'; stepIndex: number }
  | { kind: 'submit' }
  | null

/**
 * Decide what happens when a visitor tries to leave `fromStepId`: check
 * every enabled rule anchored there (in priority order — first match wins,
 * same as every other "resolve one outcome" pattern in this codebase), and
 * translate its navigation action into a concrete step index the caller can
 * jump to, or a submit signal for `end_form`. Returns null when nothing
 * matches, meaning "fall back to the normal sequential next step" — so a
 * form with no navigation rules at all behaves exactly as it always has.
 */
function resolveStepNavigation(
  rules: ConditionalRule[] | undefined,
  fromStepId: string,
  currentIndex: number,
  navigableSteps: { id: string }[],
  values: Record<string, unknown>,
): StepNavResult {
  const stepIndexById = new Map(navigableSteps.map((s, i) => [s.id, i]))
  const candidates = (rules ?? []).filter(
    (r) => r.enabled && r.fromStepId === fromStepId && r.actions.some((a) => NAVIGATION_ACTION_TYPES.includes(a.type)),
  )
  for (const rule of candidates) {
    if (!evaluateGroup(rule.group, values)) continue
    const navAction = rule.actions.find((a) => NAVIGATION_ACTION_TYPES.includes(a.type))!
    switch (navAction.type) {
      case 'end_form':
        return { kind: 'submit' }
      case 'goto_step': {
        const idx = stepIndexById.get(navAction.stepId)
        if (idx !== undefined) return { kind: 'goto', stepIndex: idx }
        break // dangling reference (step deleted after this rule was saved) — try the next candidate rule
      }
      case 'skip_step': {
        const skippedIdx = stepIndexById.get(navAction.stepId)
        if (skippedIdx !== undefined) {
          return skippedIdx + 1 < navigableSteps.length ? { kind: 'goto', stepIndex: skippedIdx + 1 } : { kind: 'submit' }
        }
        break
      }
      case 'previous_step':
        return currentIndex > 0 ? { kind: 'goto', stepIndex: currentIndex - 1 } : null
      case 'next_step':
        return currentIndex + 1 < navigableSteps.length ? { kind: 'goto', stepIndex: currentIndex + 1 } : { kind: 'submit' }
    }
  }
  return null
}

// ── Main component ────────────────────────────────────────────────
export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState<Form | null>(null)
  // Recomputes once `form` (and its persisted form_json.theme) loads —
  // URL params still layer on top, same precedence documented above.
  const theme = buildTheme(searchParams, form?.form_json?.theme)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Which message to show on the thank-you screen — resolved at submit time
  // from whichever conditional outcome matched (or the base config's own
  // message, if none did/exist). Only known once the submission's data is
  // final, so it can't be derived ahead of time the way the rest of the
  // step's static config is.
  const [resolvedMessage, setResolvedMessage] = useState<string | undefined>(undefined)
  const loadedAt = useRef(new Date().toISOString())

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(0)
  const formDataRef = useRef<Record<string, unknown>>({})
  // Guards against a double POST — e.g. legacy forms migrated to have a
  // reserved on-submit step that still carries an old "submit"-action
  // button saved before that step type was CTA-link-only. A ref (not
  // state) so the check is never stale inside the handleSubmit closure.
  const alreadySubmittedRef = useRef(false)

  // ── Conditional logic (rules) ───────────────────────────────────
  // See utils/rules.ts. Most fields here are uncontrolled HTML inputs (no
  // React state backing their value), so live show/hide-as-you-type is done
  // via a single delegated onInput/onChange listener on the <form> that
  // reads the current DOM values, evaluates the rules, and updates
  // `ruleState` — re-rendering with a new `hidden`/`effectiveRequired` prop
  // per field does NOT reset an uncontrolled input's already-typed value,
  // since React only diffs the changed props/attributes, not the DOM node.
  const formElRef = useRef<HTMLFormElement | null>(null)
  const triggeredRuleIdsRef = useRef<Set<string>>(new Set())
  const [ruleState, setRuleState] = useState<RuleEvaluationResult>(() => evaluateRules(undefined, {}))

  const recomputeRules = useCallback(() => {
    const formEl = formElRef.current
    if (!formEl || !form) return
    const values = { ...formDataRef.current, ...collectFormData(formEl) }
    const result = evaluateRules(form.form_json.rules, values, triggeredRuleIdsRef.current)
    triggeredRuleIdsRef.current = result.triggeredRuleIds
    for (const action of result.valueActions) {
      applyValueAction(formEl, action.fieldId, action.value)
    }
    setRuleState(result)
    applyCheckboxGroupValidity(formEl, form.form_json.fields, result)
  }, [form])

  // Re-run once whenever the form first loads and again every time the
  // active step's fields (a fresh DOM, via the <form key={currentStep}>
  // below) mount — so default/pre-filled values are reflected in the
  // starting hidden/required state before the visitor touches anything.
  useEffect(() => {
    recomputeRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, currentStep])

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await fetch(`${PUBLIC_API}/forms/${id}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.message ?? 'Form not found')
        setForm(json.data)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load form')
      } finally {
        setLoading(false)
      }
    }
    fetchForm()
  }, [id])

  // ── Derived multi-step values ─────────────────────────────────
  const steps = form?.form_json.steps ?? []
  const isMultiStep = steps.length > 0
  const totalSteps = steps.length
  const isFirstStep = currentStep === 0
  // The reserved "On Form Submit" step (HubSpot-style): what visitors see
  // right after the real data posts — custom CTA buttons, or the default
  // thank-you message if none are configured. Only present on forms built
  // (or re-saved) with the updated builder; older multi-step forms simply
  // won't have one, and behave exactly as before.
  const onSubmitStepIndex = steps.findIndex((s) => s.isOnSubmit)
  const hasOnSubmitStep = onSubmitStepIndex !== -1
  const isOnSubmitStep = hasOnSubmitStep && currentStep === onSubmitStepIndex
  // "Final field step" = where the default action is Submit rather than
  // Next — the field-collecting step immediately before the reserved
  // on-submit step (or, for legacy forms without one, the literal last step).
  const isFinalStep = !isMultiStep || (hasOnSubmitStep ? currentStep === onSubmitStepIndex - 1 : currentStep === totalSteps - 1)

  // What the on-submit step is configured to do: show a message (default,
  // and the only mode where CTA buttons apply) or redirect the browser
  // straight to a page/URL/meeting link/payment link. This is the BASE
  // config/fallback — if it has conditionalOutcomes, the actual behavior for
  // a given submission is resolved from the final submitted data inside
  // handleSubmit below (resolveOnSubmitOutcome), not decided here ahead of
  // time, since which outcome applies can only be known once the visitor's
  // answers are in.
  const onSubmitConfig = hasOnSubmitStep ? steps[onSubmitStepIndex]?.onSubmitConfig : undefined

  const getVisibleFields = useCallback((): FormField[] => {
    if (!form) return []
    if (!isMultiStep) return form.form_json.fields
    const stepFieldIds = new Set(steps[currentStep]?.fieldIds ?? [])
    return form.form_json.fields.filter((f) => stepFieldIds.has(f.id))
  }, [form, isMultiStep, steps, currentStep])

  // Custom step-end buttons (set in the builder). A button's action ("next"
  // vs "submit") is no longer tied to whether this is structurally the last
  // step — any step can have a genuine Submit button (e.g. a "submit early"
  // decision screen with both "Submit" and "Continue" options). Which
  // handler actually runs is decided per-click in handleFormSubmit below via
  // the clicked button's data-step-action, not by isFinalStep.
  const stepButtons = steps[currentStep]?.buttons
  const hasCustomButtons = !!stepButtons && stepButtons.length > 0
  // A custom-button step is a deliberate CTA/decision screen (e.g. "Continue
  // Application" / "Book a Call") — skip the "Back" nav and the empty-fields
  // placeholder there instead of treating it like an in-progress form step.
  const showBack = isMultiStep && !isFirstStep && !hasCustomButtons

  // ── Navigation handlers ───────────────────────────────────────
  // handleSubmit is defined before handleNext (rather than in the more
  // "natural" reading order after it) because handleNext needs to call it
  // directly for the `end_form` navigation action — a rule can decide "skip
  // everything else and submit now," which is exactly what a custom
  // step-level Submit button already does, just condition-triggered instead
  // of click-triggered.
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (alreadySubmittedRef.current) return
    setSubmitError('')
    setSubmitting(true)
    const data = { ...formDataRef.current, ...collectFormData(e.currentTarget) }
    try {
      // Always sent as multipart now, file fields or not: a single JSON `payload` field carries
      // `data`/`formLoadedAt` exactly as before (checkbox arrays and nested shapes survive
      // untouched — no server-side flat-field reconstruction needed), plus one multipart part
      // per file input that actually has a file selected. No explicit Content-Type header — the
      // browser sets the correct multipart boundary itself; setting one manually here would
      // omit the boundary and break parsing.
      const body = new FormData()
      body.append('payload', JSON.stringify({ data, formLoadedAt: loadedAt.current }))
      e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => {
        if (input.files?.[0]) body.append(input.name, input.files[0])
      })
      const res = await fetch(`${PUBLIC_API}/forms/${id}/submit`, {
        method: 'POST',
        body,
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? 'Submission failed')
      alreadySubmittedRef.current = true

      // Resolve which on-submit behavior actually applies to THIS
      // submission — the first conditional outcome whose conditions match
      // the final data, or the step's own base config if none do/exist.
      const outcome = resolveOnSubmitOutcome(onSubmitConfig, data)
      const resolvedAction = outcome?.action ?? 'message'
      const redirectUrl = (
        resolvedAction === 'redirect_page' ? outcome?.pageUrl
          : resolvedAction === 'redirect_url' ? outcome?.externalUrl
          : resolvedAction === 'redirect_meeting' ? outcome?.meetingUrl
          : resolvedAction === 'redirect_payment' ? outcome?.paymentUrl
          : undefined
      )?.trim() || undefined
      const openInNewTab = (
        resolvedAction === 'redirect_page' ? outcome?.pageOpenInNewTab
          : resolvedAction === 'redirect_url' ? outcome?.externalOpenInNewTab
          : resolvedAction === 'redirect_meeting' ? outcome?.meetingOpenInNewTab
          : resolvedAction === 'redirect_payment' ? outcome?.paymentOpenInNewTab
          : false
      ) ?? false

      if (redirectUrl) {
        if (openInNewTab) {
          // Open the destination in a new tab and leave this one — the form
          // tab, standalone or embedded in an iframe — exactly where it is.
          // `window.open` targets the top-level browsing context either
          // way, so this never tries to navigate the iframe itself.
          window.open(redirectUrl, '_blank', 'noopener,noreferrer')
          // This tab shows the plain thank-you message in place of the
          // form — not the on-submit step's CTA buttons (those are a
          // "message" action feature) and not another redirect.
          setResolvedMessage(outcome?.message)
          setSubmitted(true)
          return
        }
        // No new tab requested — take the visitor straight off the form;
        // there's no on-page state left to show once this fires.
        window.location.href = redirectUrl
        return
      }
      setResolvedMessage(outcome?.message)
      setSubmitted(true)
      // Land on the reserved "On Form Submit" step so its custom CTA
      // buttons (or the default thank-you message, if none are configured)
      // show up — instead of always jumping straight to the generic
      // full-screen thank-you view.
      if (onSubmitStepIndex !== -1) setCurrentStep(onSubmitStepIndex)
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [id, onSubmitStepIndex, onSubmitConfig])

  const handleNext = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    if (!formEl.reportValidity()) return
    const mergedData = { ...formDataRef.current, ...collectFormData(formEl) }
    formDataRef.current = mergedData
    setSubmitError('')

    // Conditional step routing — see resolveStepNavigation above. Checked
    // against the step actually being left (not necessarily `currentStep`
    // as a raw array index, since the reserved on-submit step is excluded
    // from the navigable list), first enabled matching rule wins. No match
    // falls back to the form's original behavior: advance one step.
    const navigableSteps = steps.filter((s) => !s.isOnSubmit)
    const leavingStepId = steps[currentStep]?.id
    const currentNavIndex = navigableSteps.findIndex((s) => s.id === leavingStepId)
    const nav = leavingStepId
      ? resolveStepNavigation(form?.form_json.rules, leavingStepId, currentNavIndex, navigableSteps, mergedData)
      : null

    if (nav?.kind === 'submit') {
      handleSubmit(e)
      return
    }
    if (nav?.kind === 'goto') {
      const targetStepId = navigableSteps[nav.stepIndex]?.id
      const targetIndex = steps.findIndex((s) => s.id === targetStepId)
      if (targetIndex !== -1) { setCurrentStep(targetIndex); return }
    }
    // Clamp so a misconfigured "Continue" button on the literal last step
    // can't advance past the end into a blank, buttonless dead end.
    setCurrentStep((s) => Math.min(s + 1, Math.max(totalSteps - 1, 0)))
  }, [totalSteps, steps, currentStep, form, handleSubmit])

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1))
    setSubmitError('')
  }, [])

  // Single onSubmit for the <form>, regardless of which button triggered it.
  // Reads the actual clicked button via the native SubmitEvent's `submitter`
  // (standard DOM API) and its `data-step-action`, so a "Submit" button on a
  // non-final step really submits instead of silently advancing — the bug
  // that happened when onSubmit was statically bound to isFinalStep.
  const handleFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const action = submitter?.dataset.stepAction ?? (isFinalStep ? 'submit' : 'next')
    if (action === 'submit') {
      handleSubmit(e)
    } else {
      handleNext(e)
    }
  }, [isFinalStep, handleSubmit, handleNext])

  // ── Shared theme styles ───────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    borderRadius: theme.radius,
    backgroundColor: `#${theme.cardBg}`,
  }
  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, #${theme.headerBg}, #${theme.headerBgDark})`,
  }
  const headerTextStyle: React.CSSProperties = { color: `#${theme.headerTextColor}` }
  const btnStyle: React.CSSProperties = {
    backgroundColor: `#${theme.primary}`,
    color: `#${theme.buttonTextColor}`,
    borderRadius: `calc(${theme.radius} * 0.7)`,
  }
  const btnHoverStyle: React.CSSProperties = {
    backgroundColor: `#${theme.primaryDark}`,
  }

  // ── Loading / error / success states ─────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: `#${theme.bg}` }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `#${theme.primary}`, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `#${theme.bg}` }}>
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800">Form Unavailable</h2>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  // Once submitted, show the generic thank-you screen UNLESS we've landed on
  // a reserved "On Form Submit" step that has custom CTA buttons configured
  // (e.g. "Continue Application" / "Book a Call") — in that case fall
  // through to the normal step shell below, which renders that step with no
  // fields and just its buttons, in place of the canned message.
  const showCustomOnSubmitScreen = submitted && isOnSubmitStep && hasCustomButtons
  if (submitted && !showCustomOnSubmitScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `#${theme.bg}` }}>
        <div className="text-center p-8 sm:p-10 max-w-md w-full shadow-lg" style={cardStyle}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: `#${theme.labelColor}` }}>You're all set!</h2>
          <p className="text-gray-500">{resolvedMessage?.trim() || form?.success_message || 'Thank you! Your submission has been received.'}</p>
        </div>
      </div>
    )
  }

  const visibleFields = getVisibleFields()

  return (
    <div
      className="min-h-screen flex items-start justify-center py-6 sm:py-12 px-4"
    >
      <div className="w-full max-w-lg">
        {/* Form card */}
        <div className="shadow-lg overflow-hidden" style={cardStyle}>

          {/* Header band */}
          <div className="px-5 sm:px-8 py-5 sm:py-6" style={headerStyle}>
            <h1 className="text-lg sm:text-xl font-bold" style={headerTextStyle}>{form!.name}</h1>
            {form!.description && <p className="text-sm mt-1" style={{ ...headerTextStyle, opacity: 0.8 }}>{form!.description}</p>}
          </div>

          {/* Form body */}
          <form
            key={currentStep}
            ref={formElRef}
            onSubmit={handleFormSubmit}
            onInput={recomputeRules}
            onChange={recomputeRules}
            className="px-5 sm:px-8 py-5 sm:py-6 space-y-5"
            style={{ backgroundColor: `#${theme.cardBg}` }}
          >
            {visibleFields.length === 0 ? (
              hasCustomButtons ? null : (
                <p className="text-gray-400 text-sm text-center py-4">No fields on this step.</p>
              )
            ) : (
              layoutFields(visibleFields).map((row, i) =>
                row.kind === 'full' ? (
                  <FieldRenderer
                    key={row.field.id} field={row.field} theme={theme}
                    hidden={ruleState.hidden.has(row.field.id)}
                    effectiveRequired={isEffectivelyRequired(row.field, ruleState.requiredOverride)}
                  />
                ) : (
                  // Responsive: stack on mobile, side-by-side on sm+
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {row.fields.map((f) => (
                      <FieldRenderer
                        key={f.id} field={f} theme={theme}
                        hidden={ruleState.hidden.has(f.id)}
                        effectiveRequired={isEffectivelyRequired(f, ruleState.requiredOverride)}
                      />
                    ))}
                  </div>
                )
              )
            )}

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            )}

            {/* Navigation */}
            <div className={`flex gap-3 pt-1 ${showBack ? 'justify-between' : ''}`}>
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-2.5 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                  style={{ borderRadius: `calc(${theme.radius} * 0.7)`, color: `#${theme.labelColor}` }}
                >
                  ← Back
                </button>
              )}

              {stepButtons && stepButtons.length > 0 ? (
                <div className="flex-1 flex gap-3">
                  {stepButtons.map((b) =>
                    b.action === 'external_link' ? (
                      <PrimaryButton
                        key={b.id}
                        type="button"
                        onClick={() => { if (b.url) window.open(b.url, '_blank', 'noopener,noreferrer') }}
                        style={btnStyle}
                        hoverStyle={btnHoverStyle}
                        className="flex-1 font-semibold py-2.5 transition-colors text-sm"
                      >
                        {b.label}
                      </PrimaryButton>
                    ) : (
                      <PrimaryButton
                        key={b.id}
                        type="submit"
                        dataStepAction={b.action}
                        disabled={submitting}
                        style={btnStyle}
                        hoverStyle={btnHoverStyle}
                        className="flex-1 font-semibold py-2.5 transition-colors text-sm disabled:opacity-60"
                      >
                        {b.action === 'submit' && submitting ? 'Submitting…' : b.label}
                      </PrimaryButton>
                    )
                  )}
                </div>
              ) : (
                <PrimaryButton
                  type="submit"
                  dataStepAction={isFinalStep ? 'submit' : 'next'}
                  disabled={submitting}
                  style={btnStyle}
                  hoverStyle={btnHoverStyle}
                  className="flex-1 font-semibold py-2.5 transition-colors text-sm disabled:opacity-60"
                >
                  {isFinalStep
                    ? (submitting ? 'Submitting…' : (form!.submit_button_label || 'Submit'))
                    : 'Next →'}
                </PrimaryButton>
              )}
            </div>
          </form>
        </div>

        {/* <p className="text-center text-xs text-gray-400 mt-4">Powered by Velox CRM</p> */}
      </div>
    </div>
  )
}

// ── Button with hover state ───────────────────────────────────────
function PrimaryButton({
  children, style, hoverStyle, className, type, disabled, onClick, dataStepAction,
}: {
  children: React.ReactNode
  style: React.CSSProperties
  hoverStyle: React.CSSProperties
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: () => void
  /** Read by handleFormSubmit (via SubmitEvent.submitter) to decide whether
   *  this specific click should submit the form or advance to the next step. */
  dataStepAction?: 'next' | 'submit'
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      onClick={onClick}
      className={className}
      style={hovered ? { ...style, ...hoverStyle } : style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-step-action={dataStepAction}
    >
      {children}
    </button>
  )
}
