// Pure helpers for the VeloxVerse customer-journey audit log screens — labels, colours, time
// formatting, search-box routing and error parsing. No React here so it's unit-testable
// (audit.test.ts).
import type { BadgeVariant } from '@/components/ui/Badge'
import { formatMoney, zoneAbbr } from '@/lib/utils'
import type {
  ApiLogDirection,
  ApiLogOutcome,
  ApiLogStatusClass,
  ApiLogSummary,
  ApiLogTruncatedBody,
  ApiTimelineItem,
  EventStatus,
  JourneyOutcome,
  Severity,
} from './auditTypes'

// ── Roles ───────────────────────────────────────────────────────────
/** Full audit access (settings, recipients, export, unmasked data). Phase 2 adds a read-only,
 * masked support role — VeloxVerse does the masking; the UI only hides admin-only actions. */
export const AUDIT_ADMIN_ROLES = ['super_admin', 'admin'] as const
/** The CRM role treated as "support" once Phase 2 is switched on (see handoff §3.5). */
export const AUDIT_SUPPORT_ROLE = 'support'

export function isAuditAdmin(role: string | null | undefined): boolean {
  return !!role && (AUDIT_ADMIN_ROLES as readonly string[]).includes(role)
}

export function isAuditSupport(role: string | null | undefined): boolean {
  return role === AUDIT_SUPPORT_ROLE
}

// ── Labels ──────────────────────────────────────────────────────────
/** "payment_declined" → "Payment declined" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const SERVICE_LABEL: Record<string, string> = {
  lounge: 'VeloxLounge — Lounge',
  fasttrack: 'VeloxLounge — Fast Track',
  fitness: 'VeloxLounge — Fitness',
  dining: 'VeloxLounge — Dining',
  esim: 'VeloxeSIM',
  assist_transfer: 'VeloxAssist — Pick & Drop',
  club: 'VeloxClub',
  travel_flight: 'VeloxTravel — Flights',
  travel_hotel: 'VeloxTravel — Hotels',
  travel_car: 'VeloxTravel — Cars',
  auth: 'Login & account',
  profile: 'Profile & devices',
  payment: 'Payments',
  credit: 'Credit',
  points: 'Points',
  referral: 'Referral',
  promo: 'Promo codes',
  billing: 'Billing',
  support: 'Support tickets',
  notification: 'Notifications',
  system: 'System',
}

export const SUPPLIER_LABEL: Record<string, string> = {
  dragonpass: 'DragonPass',
  mint: 'Mint Payments',
  esim: 'eSIM Access',
  travelfusion: 'Travelfusion',
  viatovia: 'ViaTovia',
  email: 'Email',
  s3: 'File storage',
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  step: 'Customer step',
  page_view: 'Page view',
  api_error: 'API error',
  supplier_call: 'Supplier call',
  payment: 'Payment',
  webhook: 'Webhook',
  job: 'Background job',
  frontend_error: 'Browser error',
  downtime: 'Downtime',
  system_error: 'System error',
  admin_access: 'Staff viewed logs',
}

export const SOURCE_LABEL: Record<string, string> = {
  backend: 'Server',
  frontend: "Customer's browser",
  webhook: 'Supplier webhook',
  job: 'Background job',
  admin: 'Staff',
}

export const ALERT_TYPE_LABEL: Record<string, string> = {
  critical: 'Critical error',
  spike: 'Error spike',
  supplier_down: 'Supplier down',
  payment_issue: 'Payment issue',
  downtime: 'Downtime',
  daily_digest: 'Daily digest',
  action_needed: 'Action needed (Pick & Drop)',
}

/** Wording for steps whose raw name doesn't read well humanised. Anything not listed falls back
 * to the humanised step name, so a new VeloxVerse step always shows up. */
export const STEP_LABEL: Record<string, string> = {
  late_approval_refunded: 'Charged after checkout closed — refunded',
  card_brand_not_accepted: 'Card type not accepted — refunded',
  promo_no_longer_valid: 'Promo already used — not charged',
  charge_amount_changed: 'Exchange rate updated — not charged',
  charge_fx_unavailable: 'No exchange rate — checkout not offered',
  esim_supplier_outcome_unknown: 'eSIM Access did not answer — checking',
  esim_supplier_outcome_recovered: 'eSIM order found at eSIM Access — completed',
  dragonpass_order_outcome_unknown: 'DragonPass did not answer — customer refunded, check DragonPass',
  dragonpass_orphan_order_cancelled: 'Stray DragonPass booking cancelled automatically',
  dragonpass_orphan_order: 'Unknown DragonPass booking — check',
}

/** What staff have to do for a step, shown with the event. Only steps that need a person. */
export const STEP_STAFF_ACTION: Record<string, string> = {
  dragonpass_order_outcome_unknown:
    'The customer was refunded, but the booking may still exist at DragonPass under our order number (metadata.clientUserId). Look it up in the DragonPass portal and cancel it.',
  dragonpass_orphan_order:
    'DragonPass reported a booking we cannot tie to any order (or could not cancel). Check it in the DragonPass portal (metadata.dragonpassOrderId).',
  refund_failed: 'The refund could not be made automatically. Refund the customer manually in the Mint portal.',
  payment_amount_mismatch:
    'Mint charged the card, but not for what the order asked. Find the charge in the Mint portal by the payment’s provider reference and refund it there.',
}

export const stepStaffAction = (s: string | null | undefined): string | undefined => (s ? STEP_STAFF_ACTION[s] : undefined)

/** Steps where money has to be checked by a person. */
export const REFUND_ATTENTION_STEPS = ['refund_failed', 'late_approval_refunded', 'payment_amount_mismatch'] as const

export const stepLabel = (s: string | null | undefined) => (s ? STEP_LABEL[s] ?? humanize(s) : '—')
export const serviceLabel = (s: string | null | undefined) => (s ? SERVICE_LABEL[s] ?? humanize(s) : '—')
export const supplierLabel = (s: string | null | undefined) => (s ? SUPPLIER_LABEL[s] ?? humanize(s) : '—')
export const eventTypeLabel = (s: string | null | undefined) => (s ? EVENT_TYPE_LABEL[s] ?? humanize(s) : '—')
export const sourceLabel = (s: string | null | undefined) => (s ? SOURCE_LABEL[s] ?? humanize(s) : '—')
export const alertTypeLabel = (s: string | null | undefined) => (s ? ALERT_TYPE_LABEL[s] ?? humanize(s) : '—')

// ── Severity / status / outcome ─────────────────────────────────────
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }

/** Fallback colours — /meta returns the same values; prefer those when loaded. */
export const SEVERITY_COLOUR: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#64748b',
}

/** Badge styling per handoff §6.4: solid red/orange, amber/blue outline, subtle grey. */
export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: 'bg-red-600 text-white ring-red-600',
  high: 'bg-orange-600 text-white ring-orange-600',
  medium: 'bg-white text-yellow-700 ring-yellow-500',
  low: 'bg-white text-blue-700 ring-blue-500',
  info: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export function severityVariant(s: Severity): BadgeVariant {
  return s === 'critical' ? 'danger' : s === 'high' || s === 'medium' ? 'warning' : s === 'low' ? 'info' : 'neutral'
}

export const STATUS_META: Record<EventStatus, { label: string; className: string }> = {
  success: { label: 'Success', className: 'text-emerald-600' },
  failure: { label: 'Failure', className: 'text-red-600' },
  warning: { label: 'Warning', className: 'text-amber-600' },
  info: { label: 'Info', className: 'text-gray-400' },
}

export const OUTCOME_META: Record<JourneyOutcome, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  booked_then_cancelled: { label: 'Booked, later cancelled', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
  paid_not_booked: { label: 'Paid but not booked', className: 'bg-red-600 text-white ring-red-600' },
  payment_declined: { label: 'Payment declined', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  payment_in_progress: { label: 'Payment in progress', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  checkout_not_paid: { label: 'Checkout not paid', className: 'bg-gray-100 text-gray-600 ring-gray-200' },
  browsing: { label: 'Browsing only', className: 'bg-gray-100 text-gray-600 ring-gray-200' },
}

export function outcomeMeta(outcome: string) {
  return OUTCOME_META[outcome as JourneyOutcome] ?? { label: humanize(outcome), className: 'bg-gray-100 text-gray-600 ring-gray-200' }
}

/** Journey phase for grouping a timeline (Browse → Checkout → Payment → Supplier → After booking). */
export function journeyPhase(eventType: string, step: string): string {
  if (eventType === 'payment' || /^payment_|^refund_|three_ds|payment_widget/.test(step)) return 'Payment'
  if (eventType === 'supplier_call' || /^supplier_|prebooking|epass|esim_provisioning|esim_ready|transfer_booked|dragonpass/.test(step)) return 'Supplier'
  if (/checkout|promo_|credit_|points_redeemed|referral_|benefit_applied|quote_/.test(step)) return 'Checkout'
  if (/booking_confirmed|confirmation_email|cancel|booking_fulfilled|transfer_status|topup_/.test(step)) return 'After booking'
  return 'Browse'
}

// ── Time ────────────────────────────────────────────────────────────
/** "06 Oct 2026, 14:20:13 IST" — viewer-local time with the zone visible. */
export function formatAuditTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const local = d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const zone = zoneAbbr(d)
  return zone ? `${local} ${zone}` : local
}

/** "10:21:07" in the viewer's zone — list rows (the full stamp goes in the title). */
export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

/** "3 min ago" / "2 h ago" / "4 days ago". */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  if (ms < 60_000) return 'just now'
  return `${formatMinutes(ms / 60_000)} ago`
}

/** Hover text: the exact UTC value on the wire. */
export function utcTitle(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().replace('T', ' ').replace('Z', '')} UTC`
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  if (m < 60) return rem ? `${m} min ${rem} s` : `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

/** Humanised "stuck for": 45 min · 3 h 5 min · 25 days. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const days = Math.floor(minutes / (60 * 24))
  return `${days} day${days === 1 ? '' : 's'}`
}

/** "+120 ms" / "+1.4 s" relative to the first event of a trace/journey. */
export function relativeOffset(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms)) return ''
  return `+${formatDurationMs(Math.max(0, ms))}`
}

/** ISO range for the last N hours (`to` = now). */
export function lastHours(hours: number, now = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - hours * 3600_000).toISOString(), to: now.toISOString() }
}

/** <input type="datetime-local"> value (local) ↔ ISO. */
export function toLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** YYYY-MM-DD of a UTC day, N days ago. */
export function utcDay(daysAgo = 0, now = new Date()): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

// ── Search box routing (handoff §4.3) ───────────────────────────────
export type AuditSearchTarget =
  | { kind: 'empty' }
  | { kind: 'trace'; requestId: string }
  | { kind: 'browserCrash'; errorCode: string }
  | { kind: 'uuid'; id: string }
  | { kind: 'email'; email: string }
  | { kind: 'reference'; referenceId: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function classifyAuditSearch(raw: string): AuditSearchTarget {
  const q = raw.trim().replace(/^ref(erence)?:\s*/i, '')
  if (!q) return { kind: 'empty' }
  if (/^[0-9a-f]{16}$/i.test(q)) return { kind: 'trace', requestId: q.toLowerCase() }
  if (/^ui-[0-9a-f]{8}$/i.test(q)) return { kind: 'browserCrash', errorCode: q.toLowerCase() }
  if (UUID_RE.test(q)) return { kind: 'uuid', id: q.toLowerCase() }
  if (q.includes('@')) return { kind: 'email', email: q.toLowerCase() }
  return { kind: 'reference', referenceId: q }
}

export const isUuid = (v: string) => UUID_RE.test(v)

// ── Errors ──────────────────────────────────────────────────────────
export interface AuditErrorInfo {
  message: string
  requestId?: string
  status?: number
  /** VeloxVerse 403 (surfaced by the CRM proxy as 502) or a CRM 403. */
  forbidden: boolean
  notFound: boolean
  fieldErrors: Array<{ field: string; message: string }>
}

const FORBIDDEN_MESSAGE = 'You do not have permission to access this resource.'

/** Reads the VeloxVerse error body (message, requestId, field errors) instead of axios's generic text. */
export function auditError(err: unknown, fallback = 'Something went wrong.'): AuditErrorInfo {
  const res = (err as { response?: { status?: number; data?: { message?: string; requestId?: string; errors?: Array<{ field: string; message: string }> } } })
    ?.response
  const message = res?.data?.message || (err instanceof Error && !res ? err.message : '') || fallback
  return {
    message,
    requestId: res?.data?.requestId,
    status: res?.status,
    forbidden: res?.status === 403 || (res?.status === 502 && message === FORBIDDEN_MESSAGE),
    notFound: res?.status === 404,
    fieldErrors: res?.data?.errors ?? [],
  }
}

/** "message (Ref: abc123)" for toasts. */
export function auditErrorText(err: unknown, fallback?: string): string {
  const e = auditError(err, fallback)
  if (e.forbidden) return "You don't have permission to do this."
  return e.requestId ? `${e.message} (Ref: ${e.requestId})` : e.message
}

// ── Values ──────────────────────────────────────────────────────────
/** Amounts are cents, sometimes as strings; never summed across currencies. */
export function formatAuditCents(cents: unknown, currency?: unknown): string {
  const n = Number(cents)
  if (!Number.isFinite(n)) return String(cents ?? '—')
  return formatMoney(n / 100, typeof currency === 'string' ? currency : undefined)
}

/** Readable key/value pairs for a stuck item's `details` (handoff §5.8). */
export function stuckDetailEntries(details: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const d = { ...details }
  if (d.amountCents !== undefined) {
    out.push(['Amount', formatAuditCents(d.amountCents, d.currency)])
    delete d.amountCents
    delete d.currency
  }
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined || v === '') continue
    const value =
      k === 'lastAt' && typeof v === 'string'
        ? formatAuditTime(v)
        : typeof v === 'object'
          ? JSON.stringify(v)
          : typeof v === 'boolean'
            ? (v ? 'Yes' : 'No')
            : String(v)
    out.push([humanize(k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()), value])
  }
  return out
}

/** errorsByHttpStatus mixes exact codes ("401") and classes ("4xx"). */
export function splitHttpStatus(record: Record<string, number>): { codes: Array<[string, number]>; classes: Array<[string, number]> } {
  const codes: Array<[string, number]> = []
  const classes: Array<[string, number]> = []
  for (const [k, v] of Object.entries(record ?? {})) (/^\dxx$/i.test(k) ? classes : codes).push([k, v])
  const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1]
  return { codes: codes.sort(byCount), classes: classes.sort(byCount) }
}

/** Sorted [key, count] pairs, biggest first. */
export function sortedCounts(record: Record<string, number> | undefined): Array<[string, number]> {
  return Object.entries(record ?? {}).sort((a, b) => b[1] - a[1])
}

// ── API logs ────────────────────────────────────────────────────────
// Badges pair a light tint with dark text of the same hue (≥ 4.5:1) and always carry a label.

export const API_OUTCOME_META: Record<ApiLogOutcome, { label: string; colour: string; className: string }> = {
  success: { label: 'Success', colour: '#16a34a', className: 'bg-green-50 text-green-800 ring-green-200' },
  failure: { label: 'Failed', colour: '#ea580c', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
  error: { label: 'Error', colour: '#dc2626', className: 'bg-red-50 text-red-800 ring-red-200' },
  timeout: { label: 'Timed out', colour: '#ca8a04', className: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  unknown: { label: 'Outcome unknown', colour: '#7c3aed', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
}

export function apiOutcomeMeta(outcome: string) {
  return API_OUTCOME_META[outcome as ApiLogOutcome] ?? { label: humanize(outcome), colour: '#6b7280', className: 'bg-gray-100 text-gray-700 ring-gray-200' }
}

export const API_DIRECTION_LABEL: Record<ApiLogDirection, string> = {
  inbound: 'Inbound (customer / CRM)',
  outbound: 'Supplier call',
  webhook: 'Webhook',
}

/** Short form for rows and cards. */
export const API_DIRECTION_SHORT: Record<ApiLogDirection, string> = { inbound: 'Inbound', outbound: 'Supplier', webhook: 'Webhook' }

export const apiDirectionLabel = (d: string | null | undefined) => (d ? API_DIRECTION_LABEL[d as ApiLogDirection] ?? humanize(d) : '—')

/** API-log supplier names (the journey audit keeps its own SUPPLIER_LABEL). */
export const API_SUPPLIER_LABEL: Record<string, string> = {
  dragonpass: 'DragonPass',
  mint: 'Mint',
  viatovia: 'ViaTovia',
  esim: 'eSIM Access',
  travelfusion: 'TravelFusion',
  email: 'Email (SMTP)',
  s3: 'S3 storage',
}

export const apiSupplierLabel = (s: string | null | undefined) => (s ? API_SUPPLIER_LABEL[s] ?? humanize(s) : '—')

export type ApiStatusClassKey = ApiLogStatusClass | '1xx'

/** null = no answer at all (timeout / network) — never "0". */
export function statusClassOf(code: number | null | undefined): ApiStatusClassKey {
  if (code === null || code === undefined || !Number.isFinite(code) || code < 100) return 'none'
  if (code < 200) return '1xx'
  if (code < 300) return '2xx'
  if (code < 400) return '3xx'
  if (code < 500) return '4xx'
  return '5xx'
}

export const API_STATUS_CLASS_META: Record<ApiStatusClassKey, { label: string; className: string; colour: string }> = {
  '1xx': { label: 'Informational', className: 'bg-gray-100 text-gray-700 ring-gray-200', colour: '#9ca3af' },
  '2xx': { label: 'OK', className: 'bg-green-50 text-green-800 ring-green-200', colour: '#16a34a' },
  '3xx': { label: 'Redirect', className: 'bg-blue-50 text-blue-800 ring-blue-200', colour: '#2563eb' },
  '4xx': { label: 'Client error', className: 'bg-amber-50 text-amber-800 ring-amber-200', colour: '#d97706' },
  '5xx': { label: 'Server error', className: 'bg-red-50 text-red-800 ring-red-200', colour: '#dc2626' },
  none: { label: 'No answer', className: 'bg-gray-100 text-gray-700 ring-gray-300', colour: '#6b7280' },
}

/** Badge text for a status code: "502" or "No answer". */
export function statusCodeText(code: number | null | undefined): string {
  return statusClassOf(code) === 'none' ? 'No answer' : String(code)
}

/** API-log durations: "812 ms" / "15.0 s". */
export function formatApiDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** Amber when > 5 s, red when > 15 s. */
export function durationTone(ms: number | null | undefined): 'normal' | 'slow' | 'very-slow' {
  if (!ms) return 'normal'
  if (ms > 15_000) return 'very-slow'
  if (ms > 5_000) return 'slow'
  return 'normal'
}

export const DURATION_TONE_CLASS = { normal: 'text-gray-700', slow: 'text-amber-700 font-medium', 'very-slow': 'text-red-700 font-semibold' } as const

/** "1.2 KB" */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ACTOR_LABEL: Record<string, string> = { customer: 'Customer', guest: 'Guest', admin: 'Admin', support: 'Support', system: 'System' }
export const actorLabel = (a: string | null | undefined) => (a ? ACTOR_LABEL[a] ?? humanize(a) : '—')

/** The call as one line: "POST /api/v1/lounge/visits/:id/cancel" (inbound/webhook) or
 * "DragonPass · POST /v2/orders/:id/cancel" (supplier). */
export function apiCallText(log: Pick<ApiLogSummary, 'direction' | 'method' | 'route' | 'operation' | 'supplier' | 'url'>): string {
  if (log.direction === 'outbound') {
    const op = log.operation ?? [log.method, log.route ?? log.url].filter(Boolean).join(' ')
    return log.supplier ? `${apiSupplierLabel(log.supplier)} · ${op || '—'}` : op || '—'
  }
  const path = log.route ?? log.operation ?? log.url ?? '—'
  return [log.method, path].filter(Boolean).join(' ')
}

/** Who made a call, for the Customer column: email, "Guest", job name or "System". */
export function apiActorText(log: Pick<ApiLogSummary, 'customer' | 'actor' | 'jobName'>): string {
  if (log.customer) return log.customer.email ?? log.customer.name ?? log.customer.id
  if (log.jobName) return log.jobName
  return actorLabel(log.actor)
}

// ── API-log search routing ──────────────────────────────────────────
export type ApiSearchTarget =
  | { kind: 'empty' }
  | { kind: 'apiRequest'; requestId: string }
  | { kind: 'uuid'; id: string }
  | { kind: 'apiRef'; ref: string }
  | { kind: 'audit'; target: AuditSearchTarget }

/** Which screen a search box entry goes to: request ids and job runs → API timeline by request;
 * order numbers (LNG-, BNF-, TRF-, TKT-) and long Mint numbers → API timeline by ref; UUIDs →
 * the page offers both views; anything else (email, browser crash code…) → the journey search. */
export function routeSearch(raw: string): ApiSearchTarget {
  const q = raw.trim().replace(/^ref(erence)?:\s*/i, '')
  if (!q) return { kind: 'empty' }
  if (/^[0-9a-f]{16}$/i.test(q)) return { kind: 'apiRequest', requestId: q.toLowerCase() }
  if (/^job-[\w-]+$/i.test(q)) return { kind: 'apiRequest', requestId: q }
  if (UUID_RE.test(q)) return { kind: 'uuid', id: q.toLowerCase() }
  if (/^(LNG|BNF|TRF|TKT)-[\w-]+$/i.test(q)) return { kind: 'apiRef', ref: q.toUpperCase() }
  if (/^\d{10,}$/.test(q)) return { kind: 'apiRef', ref: q }
  return { kind: 'audit', target: classifyAuditSearch(q) }
}

// ── API timeline grouping ───────────────────────────────────────────
export interface ApiTimelineGroup {
  /** Stable React key. */
  key: string
  requestId: string | null
  title: string
  items: ApiTimelineItem[]
  needsAttention: boolean
}

export type ApiTimelineRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'gap'; key: string; minutes: number; label: string }
  | { type: 'group'; key: string; group: ApiTimelineGroup }

/** Gap marker threshold between two consecutive items. */
export const TIMELINE_GAP_MINUTES = 10

function itemRequestId(item: ApiTimelineItem): string | null {
  return item.kind === 'api_log' ? item.log.requestId : item.event.requestId
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** "Sat 18 Oct 2026" in the viewer's zone. */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** "80 min later" / "3 h 5 min later" / "2 days later" */
export function gapLabel(minutes: number): string {
  return minutes < 180 ? `${Math.round(minutes)} min later` : `${formatMinutes(minutes)} later`
}

/** A group's title from its first inbound or webhook call (or the job / first item). */
export function groupTitle(items: ApiTimelineItem[]): string {
  const logs = items.flatMap((i) => (i.kind === 'api_log' ? [i.log] : []))
  const job = logs.find((l) => l.jobName)?.jobName ?? (itemRequestId(items[0])?.startsWith('job-') ? 'run' : null)
  const head = logs.find((l) => l.direction === 'inbound' || l.direction === 'webhook')
  if (head?.direction === 'webhook') {
    return `${head.supplier ? apiSupplierLabel(head.supplier) : 'Supplier'} push · webhook · ${statusCodeText(head.statusCode)}`
  }
  if (head) return `${actorLabel(head.actor)} · ${apiCallText(head)} · ${statusCodeText(head.statusCode)}`
  if (job) return `Job ${job}`
  const first = items[0]
  if (first.kind === 'api_log') return `${apiCallText(first.log)} · ${statusCodeText(first.log.statusCode)}`
  return `Journey · ${stepLabel(first.event.step)}`
}

/** Timeline rows, oldest first: day separators, gap markers (> 10 min between consecutive
 * items) and request groups (consecutive items sharing a requestId). */
export function groupTimeline(items: ApiTimelineItem[]): ApiTimelineRow[] {
  const sorted = [...items].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const groups: ApiTimelineItem[][] = []
  for (const item of sorted) {
    const prev = groups[groups.length - 1]
    const rid = itemRequestId(item)
    const prevLast = prev?.[prev.length - 1]
    const sameRequest = prevLast && rid && itemRequestId(prevLast) === rid
    const gap = prevLast ? (new Date(item.at).getTime() - new Date(prevLast.at).getTime()) / 60_000 : 0
    if (sameRequest && gap <= TIMELINE_GAP_MINUTES) prev.push(item)
    else groups.push([item])
  }

  const rows: ApiTimelineRow[] = []
  let lastDay: string | null = null
  let lastAt: number | null = null
  groups.forEach((g, i) => {
    const firstAt = new Date(g[0].at)
    const day = localDayKey(firstAt)
    if (day !== lastDay) {
      rows.push({ type: 'day', key: `day-${day}`, label: formatDayLabel(g[0].at) })
      lastDay = day
    }
    if (lastAt !== null) {
      const minutes = (firstAt.getTime() - lastAt) / 60_000
      if (minutes > TIMELINE_GAP_MINUTES) rows.push({ type: 'gap', key: `gap-${i}`, minutes, label: gapLabel(minutes) })
    }
    const requestId = itemRequestId(g[0])
    rows.push({
      type: 'group',
      key: `g-${i}-${requestId ?? 'none'}`,
      group: {
        key: `g-${i}`,
        requestId,
        title: groupTitle(g),
        items: g,
        needsAttention: g.some((it) => it.kind === 'api_log' && it.log.needsAttention),
      },
    })
    lastAt = new Date(g[g.length - 1].at).getTime()
  })
  return rows
}

/** "Not stored" explanation for an empty body. */
export function missingBodyReason(log: Pick<ApiLogSummary, 'method' | 'statusCode' | 'hasBodies'>): string {
  if (log.method === 'GET' && statusClassOf(log.statusCode) === '2xx') return 'Not stored — successful reads are kept without bodies'
  return 'Not stored — bodies are turned off in settings'
}

/** A stored body over 16 KB. */
export function isTruncatedBody(body: unknown): body is ApiLogTruncatedBody {
  return !!body && typeof body === 'object' && (body as { _truncated?: unknown })._truncated === true
}

/** A non-JSON body arrives as { text }. */
export function textBody(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const keys = Object.keys(body)
  return keys.length === 1 && keys[0] === 'text' && typeof (body as { text: unknown }).text === 'string' ? (body as { text: string }).text : null
}
