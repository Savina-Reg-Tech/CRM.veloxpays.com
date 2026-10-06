// Pure helpers for the VeloxVerse customer-journey audit log screens — labels, colours, time
// formatting, search-box routing and error parsing. No React here so it's unit-testable
// (audit.test.ts).
import type { BadgeVariant } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/utils'
import type { EventStatus, JourneyOutcome, Severity } from './auditTypes'

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
}

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
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  })
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
