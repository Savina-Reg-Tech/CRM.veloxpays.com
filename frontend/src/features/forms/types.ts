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

export interface FormStep {
  id: string
  title: string
  fieldIds: string[]   // ordered list of field IDs in this step
  /**
   * Custom action buttons shown instead of the default single "Next"/"Submit"
   * button for this step — e.g. a final step could offer both a "Submit"
   * button and a "Book a Call" (external link) button side by side.
   */
  buttons?: StepButton[]
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
