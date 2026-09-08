// ── Field types ───────────────────────────────────────────────────
export const FIELD_TYPES = [
  'text', 'email', 'phone', 'number', 'textarea',
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

// Shared by the base on-submit behavior AND each conditional outcome below
// — same fields either way, just picked out into its own interface so
// `ConditionalOutcome.config` can reference it without recursively
// including `conditionalOutcomes` itself (an outcome's own resolved
// behavior can't have further nested outcomes).
export interface OnSubmitOutcomeConfig {
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

export interface OnSubmitConfig extends OnSubmitOutcomeConfig {
  /** Ordered list of conditional overrides — evaluated against the final
   * submitted data (all steps merged) at submit time, first match wins.
   * Falls back to this object's own action/message/url fields above when
   * none match or when this list is empty/absent, so existing forms with a
   * single fixed on-submit behavior are completely unaffected. See
   * ConditionalOutcome below and utils/rules.ts resolveOnSubmitOutcome. */
  conditionalOutcomes?: ConditionalOutcome[]
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

// ── Conditional logic ("IF conditions THEN actions" rules) ────────
// A rule fires its actions when its condition group evaluates true against
// the current values of OTHER fields. Stored as `formJson.rules` — a new
// top-level array alongside `fields`/`steps`/`theme`, needing no DB schema
// change since form_json is already JSONB (same pattern theme/onSubmitConfig
// already used).
//
// Rules are evaluated in array order, and later rules can override earlier
// ones for the same field+property (e.g. one rule requires a field, a later
// one un-requires it) — simple, predictable "last write wins" semantics
// rather than a priority system. Reordering rules in the builder changes
// precedence.
export const CONDITION_OPERATORS = [
  'equals', 'not_equals',
  'contains', 'not_contains',
  'starts_with', 'ends_with',
  'is_empty', 'is_not_empty',
  'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal',
  'between',
  'one_of', 'none_of',
  'domain_is',
] as const
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

// Operators that don't take a comparison value (the UI hides the value input
// for these).
export const VALUELESS_OPERATORS: ConditionOperator[] = ['is_empty', 'is_not_empty']

// 'between' needs a second value (the upper bound of the range — `value` is
// the lower bound). 'one_of'/'none_of' need a whole set of values, not one.
// Kept as their own optional fields on RuleCondition (rather than overloading
// `value` with encoded strings) so each operator's UI and evaluator branch
// reads its inputs from one obvious, correctly-typed place.
export const RANGE_OPERATORS: ConditionOperator[] = ['between']
export const MULTI_VALUE_OPERATORS: ConditionOperator[] = ['one_of', 'none_of']

export interface RuleCondition {
  id: string
  fieldId: string
  operator: ConditionOperator
  value?: string     // single-value comparisons — omitted for is_empty / is_not_empty
  value2?: string    // 'between' only — the upper bound of the range
  values?: string[]  // 'one_of' / 'none_of' only — the comparison set
}

// v1 supports one flat AND/OR group per rule (no nested groups) — the
// simplest mental model for "IF this AND this" or "IF this OR this". The
// extensibility hook for later: a future nested-group feature can let
// `conditions` accept a mix of RuleCondition and ConditionGroup without
// breaking this shape or any saved rule.
export interface ConditionGroup {
  logic: 'AND' | 'OR'
  conditions: RuleCondition[]
}

// Discriminated union — new action types slot in later (redirect, notify,
// webhook — see project notes) without touching existing ones or the rules
// UI's core rendering logic.
export const RULE_ACTION_TYPES = [
  'show_field', 'hide_field',
  'require_field', 'unrequire_field',
  'set_value', 'clear_value',
  'goto_step', 'skip_step', 'next_step', 'previous_step', 'end_form',
] as const
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number]

// The five navigation actions decide what step a visitor sees next instead
// of changing a field. A rule may carry at most one of these (enforced by
// the editor + validateRules) — "go to Step 3 AND go to Step 5" isn't a
// coherent instruction. goto_step/skip_step name an explicit destination by
// id; next_step/previous_step move relative to wherever the rule fires from,
// so they need no id of their own; end_form submits immediately with
// whatever's been collected so far (the same effect as the existing custom
// "Submit" step button, just triggered by a condition instead of a click).
export const NAVIGATION_ACTION_TYPES: RuleActionType[] = ['goto_step', 'skip_step', 'next_step', 'previous_step', 'end_form']

export type RuleAction =
  | { id: string; type: 'show_field'; fieldId: string }
  | { id: string; type: 'hide_field'; fieldId: string }
  | { id: string; type: 'require_field'; fieldId: string }
  | { id: string; type: 'unrequire_field'; fieldId: string }
  | { id: string; type: 'set_value'; fieldId: string; value: string }
  | { id: string; type: 'clear_value'; fieldId: string }
  | { id: string; type: 'goto_step'; stepId: string }
  | { id: string; type: 'skip_step'; stepId: string }
  | { id: string; type: 'next_step' }
  | { id: string; type: 'previous_step' }
  | { id: string; type: 'end_form' }

// Narrowed slices of the union above — lets code that only ever deals with
// one kind (e.g. the rule editor's separate "change fields" vs "then go to"
// sections) work with a properly narrowed type instead of re-deriving the
// same `'fieldId' in action` / `'stepId' in action` check everywhere.
export type FieldRuleAction = Extract<RuleAction, { fieldId: string }>
export type NavigationRuleAction = Exclude<RuleAction, FieldRuleAction>

export interface ConditionalRule {
  id: string
  name?: string   // optional admin-facing label, e.g. "Show shipping address"
  enabled: boolean
  group: ConditionGroup
  actions: RuleAction[]
  /**
   * Which step this rule is "attached to" for navigation purposes — required
   * when `actions` includes a navigation action, ignored otherwise. A
   * navigation action only means something at the moment a visitor tries to
   * leave a specific step ("IF Amount > 10,000, THEN go to Step 3" only make
   * sense as a decision made when leaving the step where Amount was
   * entered), unlike show/hide/require actions which react continuously to
   * whatever's currently typed anywhere in the form. This is also what makes
   * the Flow view and step-loop safety checks possible — it's a clean graph
   * edge (fromStepId → the navigation action's target).
   */
  fromStepId?: string
}

// ── Conditional "on submission" outcomes ───────────────────────────
// A different flavor of conditional logic than ConditionalRule above: this
// picks WHICH on-submit behavior (message vs. one of the redirect kinds)
// applies for a given submission, rather than showing/hiding/requiring
// fields while the visitor is still filling the form out. Kept as its own
// type (not folded into ConditionalRule/RuleAction) because "resolve one
// outcome from a list, first match wins" is a different evaluation shape
// than "run every matching rule's actions".
export interface ConditionalOutcome {
  id: string
  name?: string   // optional admin-facing label, e.g. "High-value lead"
  group: ConditionGroup
  config: OnSubmitOutcomeConfig
}

// ── Conditional notification recipients ────────────────────────────
// The form's base notify_on_submission/notify_emails (separate DB columns,
// not part of form_json — see Form below) remain the on/off switch and
// default recipient list. This is an optional override layer on top: when
// notifications are enabled and a rule's conditions match the final
// submitted data, ITS email list is used instead of the default one for
// that submission — first match wins, same evaluation shape as
// ConditionalOutcome. Falls back to the default list when nothing matches
// or when this array is empty/absent, so existing forms are unaffected.
export interface NotificationRule {
  id: string
  name?: string   // optional admin-facing label, e.g. "Route to sales lead"
  enabled: boolean
  group: ConditionGroup
  emails: string[]
}

// ── Conditional webhooks ────────────────────────────────────────────
// POSTs the submission (as JSON) to an admin-configured URL when the rule's
// conditions match the final submitted data. Unlike NotificationRule
// (first match wins, since it's picking ONE recipient list), every enabled
// webhook whose conditions match gets its own delivery attempt — they're
// independent side-effect triggers, not mutually-exclusive choices. Actual
// sending, HMAC signing, and SSRF-safety checks happen server-side only
// (see backend/node-crm/src/services/webhookService.js); the client never
// calls the URL itself.
export interface WebhookRule {
  id: string
  name?: string   // optional admin-facing label, e.g. "Notify Zapier"
  enabled: boolean
  group: ConditionGroup
  url: string
  secret?: string   // used server-side to sign the payload (X-Velox-Signature: sha256=...)
}

/** One logged attempt to deliver a WebhookRule's payload — see
 * webhook_deliveries table / WebhookDelivery.js. Admin-visible so a
 * silently-failing webhook (bad URL, receiver down, blocked as SSRF) isn't
 * invisible. */
export interface WebhookDelivery {
  id: number
  form_id: number
  submission_id: number | null
  rule_id: string | null
  rule_name: string | null
  url: string
  success: boolean
  status_code: number | null
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

// ── Theming ───────────────────────────────────────────────────────
// Colors are stored as 6-digit hex WITHOUT the leading '#' (matches the
// existing URL-query-param theme convention already used by the public
// form renderer, e.g. ?color=4F46E5) — keeps both sources interchangeable.
export const HEX_COLOR_RE = /^[0-9a-fA-F]{6}$/

// Fixed presets rather than a freeform px value — avoids arbitrary CSS
// injection risk and keeps every themed form visually consistent with the
// rest of the design system.
export const BORDER_RADIUS_PRESETS = {
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '16px',
  full: '24px',
} as const
export type BorderRadiusPreset = keyof typeof BORDER_RADIUS_PRESETS

// Allowlist only — never accept arbitrary font-family CSS from a form.
export const FONT_FAMILY_OPTIONS = [
  { value: 'system', label: 'System default', css: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { value: 'inter', label: 'Inter', css: '"Inter", system-ui, sans-serif' },
  { value: 'roboto', label: 'Roboto', css: '"Roboto", system-ui, sans-serif' },
  { value: 'georgia', label: 'Georgia (serif)', css: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Monospace', css: '"SFMono-Regular", Consolas, monospace' },
] as const
export type FontFamilyOption = (typeof FONT_FAMILY_OPTIONS)[number]['value']

export interface FormTheme {
  buttonColor?: string       // hex, no '#' — Next/Submit button background
  buttonTextColor?: string   // hex, no '#'
  headerBgColor?: string     // hex, no '#' — form header band background
  headerTextColor?: string   // hex, no '#'
  formBgColor?: string       // hex, no '#' — page background behind the card
  cardBgColor?: string       // hex, no '#' — the form card itself
  labelColor?: string        // hex, no '#' — field labels/body text
  inputBorderColor?: string  // hex, no '#' — border around text fields, dropdowns, etc.
  inputBgColor?: string      // hex, no '#' — background inside text fields, dropdowns, etc.
  inputTextColor?: string    // hex, no '#' — text typed/selected inside inputs
  borderRadius?: BorderRadiusPreset
  fontFamily?: FontFamilyOption
  /** Whether the title/description band above the fields is shown. Defaults
   * to true (existing forms with no theme.showHeader saved keep rendering
   * exactly as before). Set to false for embeds where the host page already
   * shows its own heading and a second one would be redundant. */
  showHeader?: boolean
}

// Mirrors the fallback values `buildTheme()` in PublicFormPage already used
// via URL query params, so a form with no theme set renders identically to
// how every form rendered before theming existed.
export const DEFAULT_FORM_THEME: Required<FormTheme> = {
  buttonColor: '4F46E5',
  buttonTextColor: 'FFFFFF',
  headerBgColor: '4F46E5',
  headerTextColor: 'FFFFFF',
  formBgColor: 'F3F4F6',
  cardBgColor: 'FFFFFF',
  labelColor: '374151',
  inputBorderColor: 'D1D5DB',
  inputBgColor: 'FFFFFF',
  inputTextColor: '111827',
  borderRadius: 'lg',
  fontFamily: 'system',
  showHeader: true,
}

export interface FormJson {
  fields: FormField[]
  steps?: FormStep[]   // undefined = single-step (legacy)
  theme?: FormTheme    // undefined = DEFAULT_FORM_THEME (see PublicFormPage buildTheme)
  rules?: ConditionalRule[]   // undefined/empty = no conditional logic (legacy forms unaffected)
  notificationRules?: NotificationRule[]   // undefined/empty = always use the form's default notify_emails
  webhookRules?: WebhookRule[]   // undefined/empty = no webhooks fire on submission
}

export interface FormTemplate {
  id: number
  name: string
  description: string | null
  theme: FormTheme
  created_by: number | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface CreateFormTemplatePayload {
  name: string
  description?: string
  theme: FormTheme
}

export interface UpdateFormTemplatePayload extends Partial<CreateFormTemplatePayload> {}

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
