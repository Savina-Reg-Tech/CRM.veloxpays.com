/**
 * Public form renderer — accessible at /embed/:formId without auth.
 *
 * Responsive: single column on mobile, half-width grid on sm+.
 *
 * Theming via URL query params (for iframe embeds / white-label):
 *   ?color=4F46E5        — primary brand color (hex, no #)
 *   ?radius=16           — card/input border radius in px (default 16)
 *   ?bg=F9FAFB           — page background color (default light gray)
 *   ?cardBg=FFFFFF       — form card background (default white)
 *   ?labelColor=374151   — label text color
 *
 * Example embed:
 *   <iframe src="/embed/42?color=E11D48&radius=8&bg=FFF1F2" />
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Form, FormField } from '../types'
import { layoutFields } from '../utils/layoutFields'
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
  primary: string       // hex without #
  primaryDark: string
  radius: string        // css value e.g. "16px"
  bg: string
  cardBg: string
  labelColor: string
}

function buildTheme(params: URLSearchParams): Theme {
  const primary    = params.get('color')      ?? '4F46E5'
  const radius     = params.get('radius')     ?? '16'
  const bg         = params.get('bg')         ?? 'F3F4F6'
  const cardBg     = params.get('cardBg')     ?? 'FFFFFF'
  const labelColor = params.get('labelColor') ?? '374151'
  return {
    primary,
    primaryDark: darken(primary),
    radius: `${parseInt(radius, 10) || 16}px`,
    bg,
    cardBg,
    labelColor,
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

function EmailInput({ field, inputCls, inputStyle, focusStyle }: {
  field: FormField
  inputCls: string
  inputStyle: React.CSSProperties
  focusStyle: React.CSSProperties
  theme: Theme
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

  const borderColor = validationError ? '#EF4444' : '#D1D5DB'

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
          style={{ ...inputStyle, ...focusStyle, borderColor }}
          placeholder={field.placeholder}
          required={field.required}
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
interface FieldRendererProps { field: FormField; theme: Theme }

function FieldRenderer({ field, theme }: FieldRendererProps) {
  if (field.type === 'hidden') return null

  const inputStyle: React.CSSProperties = {
    borderRadius: `calc(${theme.radius} * 0.6)`,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  }
  const inputCls = 'w-full px-3 py-2 text-sm border focus:outline-none focus:ring-2 transition-shadow'
  const focusStyle = { '--tw-ring-color': `#${theme.primary}55` } as React.CSSProperties

  return (
    <div>
      <label className="block text-sm font-semibold mb-1" style={{ color: `#${theme.labelColor}` }}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          rows={4}
          placeholder={field.placeholder}
          required={field.required}
        />
      ) : field.type === 'dropdown' ? (
        <select
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          required={field.required}
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
                required={field.required}
                style={{ accentColor: `#${theme.primary}` }}
              />
              {o}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        <div className="space-y-2">
          {field.options?.map((o) => (
            <label key={o} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: `#${theme.labelColor}` }}>
              <input
                type="checkbox"
                name={`${field.id}[]`}
                value={o}
                style={{ accentColor: `#${theme.primary}` }}
              />
              {o}
            </label>
          ))}
        </div>
      ) : field.type === 'date' ? (
        <input
          type="date"
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          required={field.required}
        />
      ) : field.type === 'file' ? (
        <div
          className="relative border-2 border-dashed p-4 text-center text-sm text-gray-400 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ borderRadius: inputStyle.borderRadius, borderColor: '#D1D5DB' }}
        >
          <input type="file" name={field.id} required={field.required} className="absolute inset-0 opacity-0 cursor-pointer" />
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
        <EmailInput field={field} inputCls={inputCls} inputStyle={inputStyle} focusStyle={focusStyle} theme={theme} />
      ) : (
        <input
          type={field.type === 'phone' ? 'tel' : 'text'}
          name={field.id}
          className={inputCls}
          style={{ ...inputStyle, ...focusStyle }}
          placeholder={field.placeholder}
          required={field.required}
          defaultValue={field.defaultValue}
        />
      )}

      {field.helpText && <p className="text-xs text-gray-400 mt-1.5">{field.helpText}</p>}
    </div>
  )
}

// ── Collect FormData into a plain object ──────────────────────────
function collectFormData(formEl: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  new FormData(formEl).forEach((value, key) => {
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

// ── Main component ────────────────────────────────────────────────
export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const theme = buildTheme(searchParams)

  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const loadedAt = useRef(new Date().toISOString())

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(0)
  const formDataRef = useRef<Record<string, unknown>>({})

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
  const isFinalStep = !isMultiStep || currentStep === totalSteps - 1
  const progressPct = isMultiStep ? Math.round(((currentStep + 1) / totalSteps) * 100) : 100

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
  const handleNext = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    if (!formEl.reportValidity()) return
    formDataRef.current = { ...formDataRef.current, ...collectFormData(formEl) }
    // Clamp so a misconfigured "Continue" button on the literal last step
    // can't advance past the end into a blank, buttonless dead end.
    setCurrentStep((s) => Math.min(s + 1, Math.max(totalSteps - 1, 0)))
    setSubmitError('')
  }, [totalSteps])

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1))
    setSubmitError('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const data = { ...formDataRef.current, ...collectFormData(e.currentTarget) }
    try {
      const res = await fetch(`${PUBLIC_API}/forms/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, formLoadedAt: loadedAt.current }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message ?? 'Submission failed')
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [id])

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
    background: `linear-gradient(135deg, #${theme.primary}, #${theme.primaryDark})`,
  }
  const btnStyle: React.CSSProperties = {
    backgroundColor: `#${theme.primary}`,
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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `#${theme.bg}` }}>
        <div className="text-center p-8 sm:p-10 max-w-md w-full shadow-lg" style={cardStyle}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: `#${theme.labelColor}` }}>You're all set!</h2>
          <p className="text-gray-500">{form?.success_message ?? 'Thank you! Your submission has been received.'}</p>
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
            <h1 className="text-lg sm:text-xl font-bold text-white">{form!.name}</h1>
            {form!.description && <p className="text-white/80 text-sm mt-1">{form!.description}</p>}

            {/* Multi-step progress */}
            {isMultiStep && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/80 text-xs font-medium">
                    Step {currentStep + 1} of {totalSteps}
                  </span>
                  <span className="text-white/80 text-xs truncate max-w-[50%] text-right">
                    {steps[currentStep]?.title}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, backgroundColor: 'white' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === currentStep ? '10px' : '8px',
                        height: i === currentStep ? '10px' : '8px',
                        backgroundColor: i <= currentStep ? 'white' : 'rgba(255,255,255,0.3)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form body */}
          <form
            key={currentStep}
            onSubmit={handleFormSubmit}
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
                  <FieldRenderer key={row.field.id} field={row.field} theme={theme} />
                ) : (
                  // Responsive: stack on mobile, side-by-side on sm+
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {row.fields.map((f) => <FieldRenderer key={f.id} field={f} theme={theme} />)}
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
                        className="flex-1 text-white font-semibold py-2.5 transition-colors text-sm"
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
                        className="flex-1 text-white font-semibold py-2.5 transition-colors text-sm disabled:opacity-60"
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
                  className="flex-1 text-white font-semibold py-2.5 transition-colors text-sm disabled:opacity-60"
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
