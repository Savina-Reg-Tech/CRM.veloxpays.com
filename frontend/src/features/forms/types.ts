// ── Field types ───────────────────────────────────────────────────
export const FIELD_TYPES = [
  'text', 'email', 'phone', 'textarea',
  'dropdown', 'checkbox', 'radio', 'date', 'file', 'hidden', 'section',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  required?: boolean
  helpText?: string
  options?: string[]      // for dropdown / radio / checkbox
  defaultValue?: string
  width?: 'full' | 'half'
}

// ── Step-level custom buttons ─────────────────────────────────────
// 'next'          — behaves like the default Next button: validates the
//                   step's fields and advances to the following step.
// 'submit'        — behaves like the default Submit button: validates the
//                   step's fields and submits the whole form using all data
//                   collected so far (including from earlier steps). Valid
//                   on ANY step, not just the last one — lets a step act as
//                   a "submit early" decision screen (e.g. "Submit" +
//                   "Continue Application" side by side).
// 'external_link' — opens `url` in a new tab; does not validate, advance,
//                   or submit. Valid on any step.
export const STEP_BUTTON_ACTIONS = ['next', 'submit', 'external_link'] as const
export type StepButtonAction = (typeof STEP_BUTTON_ACTIONS)[number]

export interface StepButton {
  id: string
  label: string
  action: StepButtonAction
  url?: string   // required when action === 'external_link'
}

// ── "On submission" behavior (the reserved On Form Submit step) ───
// 'message'         — show a thank-you message inline (optionally alongside
//                      custom CTA buttons — see `buttons` above).
// 'redirect_page'    — navigate the browser to an internal page/path.
// 'redirect_url'     — navigate the browser to any external URL.
// 'redirect_meeting'— navigate the browser to a meeting-scheduling link
//                      (e.g. Calendly, HubSpot Meetings).
// 'redirect_payment'— navigate the browser to a payment link (e.g. Stripe).
// The four redirect kinds behave identically at runtime (a real browser
// navigation right after a successful submit) — they're kept as distinct,
// separately-stored fields so switching between them in the builder never
// clobbers a link you already typed into another one, and so the intent is
// unambiguous both to the admin and to anyone reading the saved form_json.
export const ON_SUBMIT_ACTIONS = ['message', 'redirect_page', 'redirect_url', 'redirect_meeting', 'redirect_payment'] as const
export type OnSubmitAction = (typeof ON_SUBMIT_ACTIONS)[number]

export interface OnSubmitConfig {
  action: OnSubmitAction
  message?: string       // 'message' — falls back to the form's success_message when unset
  pageUrl?: string       // 'redirect_page'
  externalUrl?: string   // 'redirect_url'
  meetingUrl?: string    // 'redirect_meeting'
  paymentUrl?: string    // 'redirect_payment'
  // "Open in new tab" — one flag per redirect type (rather than a single
  // shared flag), matching how the URL fields above are kept separate, so
  // switching between redirect options in the builder never clobbers a
  // choice already made on another one. Ignored for 'message'. When true,
  // the destination opens via `window.open(url, '_blank', 'noopener,noreferrer')`
  // and the form's own tab stays put (showing the thank-you message)
  // instead of navigating away — works the same standalone or embedded in
  // an iframe, since the new tab is opened on the top-level window, not
  // inside the iframe's own navigation context.
  pageOpenInNewTab?: boolean     // 'redirect_page'
  externalOpenInNewTab?: boolean // 'redirect_url'
  meetingOpenInNewTab?: boolean  // 'redirect_meeting'
  paymentOpenInNewTab?: boolean  // 'redirect_payment'
}

export interface FormStep {
  id: string
  title: string
  fieldIds: string[]   // ordered list of field IDs in this step
  /**
   * Custom action buttons shown instead of the default single "Next"/"Submit"
   * button for this step — e.g. a final step could offer both a "Submit"
   * button and a "Book a Call" (external link) button side by side. On the
   * reserved on-submit step, these only apply when `onSubmitConfig.action`
   * is "message" (a redirect leaves the page before any button could show).
   */
  buttons?: StepButton[]
  /**
   * Marks the reserved, HubSpot-style "On Form Submit" step: what the
   * visitor sees right after the real data is submitted (custom CTA
   * buttons, or the default thank-you message if none are configured).
   * It never holds fields, is always kept as the last entry in `steps`,
   * and can't be deleted/reordered/renamed from the builder. At most one
   * step in a form should carry this flag.
   */
  isOnSubmit?: boolean
  /** Only meaningful on the reserved on-submit step; see OnSubmitConfig. */
  onSubmitConfig?: OnSubmitConfig
}

export interface FormJson {
  fields: FormField[]
  steps?: FormStep[]   // undefined = single-step (legacy)
}

// ── Form statuses ─────────────────────────────────────────────────
export const FORM_STATUSES = ['draft', 'published', 'archived'] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

// ── Lead statuses ─────────────────────────────────────────────────
export const LEAD_STATUSES = ['NEW', 'REVIEW', 'SPAM', 'CONVERTED'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

// ── DB models ─────────────────────────────────────────────────────
export interface Form {
  id: number
  name: string
  slug: string
  description: string | null
  form_json: FormJson
  status: FormStatus
  submit_button_label: string
  success_message: string
  total_submissions: number
  total_leads: number
  created_by: number | null
  created_by_name?: string | null
  created_by_email?: string | null
  created_at: string
  updated_at: string
  // Email notifications
  notify_on_submission: boolean
  notify_emails: string[]
  auto_respond: boolean
  auto_respond_subject: string
  auto_respond_body: string
}

export interface FormSubmission {
  id: number
  form_id: number
  lead_id: number | null
  submission_data: Record<string, unknown>
  email: string | null
  ip_address: string | null
  user_agent: string | null
  time_taken_seconds: number | null
  spam_score: number
  status: LeadStatus
  created_at: string
}

export interface Lead {
  id: number
  form_id: number
  form_name: string | null
  email: string | null
  name: string | null
  phone: string | null
  submission_data: Record<string, unknown>
  lead_source: string
  status: LeadStatus
  spam_score: number
  ip_address: string | null
  user_agent: string | null
  time_taken_seconds: number | null
  converted_at: string | null
  created_at: string
  updated_at: string
}

export interface BlockedDomain {
  id: number
  domain: string
  created_at: string
}

// ── Analytics ─────────────────────────────────────────────────────
export interface GlobalStats {
  forms: {
    total_forms: number
    published_forms: number
    total_submissions: number
    total_leads: number
  }
  submissions: {
    total: number
    normal: number
    review: number
    spam: number
    converted: number
  }
  leads: {
    total: number
    new_leads: number
    review_leads: number
    spam_leads: number
    converted_leads: number
  }
}

export interface DailyCount { day: string; count: number }

// ── Payloads ──────────────────────────────────────────────────────
export interface CreateFormPayload {
  name: string
  description?: string
  form_json?: FormJson
  submit_button_label?: string
  success_message?: string
  status?: FormStatus
  notify_on_submission?: boolean
  notify_emails?: string[]
  auto_respond?: boolean
  auto_respond_subject?: string
  auto_respond_body?: string
}

export interface UpdateFormPayload extends Partial<CreateFormPayload> {}

export interface EmbedCodes {
  iframe: string
  javascript: string
  formUrl: string
}
