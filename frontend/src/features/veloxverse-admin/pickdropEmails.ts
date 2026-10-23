// Pick & Drop customer emails: labels, colours and the pure helpers behind the queue and the
// Review screen. ViaTovia's emails come into VeloxVerse's inbox; VeloxVerse turns the ones the
// customer needs into drafts that an admin reviews and sends here.
import {
  AlarmClock,
  Car,
  CheckCircle2,
  Mail,
  MessageSquare,
  PencilLine,
  Repeat,
  type LucideIcon,
} from 'lucide-react'
import type {
  DraftDetail,
  DraftStatus,
  DraftSummary,
  DraftTrigger,
  InboundStatus,
  InboundType,
  MatchMethod,
  Mismatch,
  PickdropBookingStatus,
} from './types'

// ── Tones ───────────────────────────────────────────────────────────
export type Tone = 'amber' | 'blue' | 'green' | 'red' | 'grey' | 'slate'

/** Chip classes per tone (background, text, ring). */
export const TONE_CHIP: Record<Tone, string> = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  grey: 'bg-gray-100 text-gray-600 ring-gray-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export const TONE_DOT: Record<Tone, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  grey: 'bg-gray-400',
  slate: 'bg-slate-500',
}

interface LabelTone {
  label: string
  tone: Tone
}

// ── Labels (spec §4.8) ──────────────────────────────────────────────
export const DRAFT_STATUS_META: Record<DraftStatus, LabelTone> = {
  DRAFT: { label: 'To review', tone: 'amber' },
  SENDING: { label: 'Sending…', tone: 'blue' },
  SENT: { label: 'Sent', tone: 'green' },
  FAILED: { label: 'Send failed', tone: 'red' },
  DISCARDED: { label: 'Discarded', tone: 'grey' },
}

export const INBOUND_TYPE_META: Record<InboundType, LabelTone> = {
  RECEIVED: { label: 'Payment received (no email needed)', tone: 'grey' },
  CONFIRMATION: { label: 'Ride approved / voucher', tone: 'green' },
  DRIVER_ASSIGNED: { label: 'Driver assigned', tone: 'blue' },
  CHANGED: { label: 'Booking changed', tone: 'amber' },
  CANCELLED: { label: 'Cancelled (our email covers it)', tone: 'red' },
  REMINDER: { label: 'Reminder', tone: 'slate' },
  OTHER: { label: 'Other', tone: 'slate' },
}

export const INBOUND_STATUS_META: Record<InboundStatus, LabelTone> = {
  NEW: { label: 'Matching…', tone: 'blue' },
  MATCHED: { label: 'Matched', tone: 'green' },
  UNMATCHED: { label: 'Unmatched', tone: 'red' },
  DRAFTED: { label: 'Draft made', tone: 'amber' },
  IGNORED: { label: 'No action', tone: 'grey' },
}

export const TRIGGER_LABEL: Record<DraftTrigger, string> = {
  EMAIL: 'From ViaTovia email',
  DRIVER_SEEN: 'Driver seen in ViaTovia',
  ADMIN: 'Created by admin',
}

export const MATCH_METHOD_LABEL: Record<MatchMethod, string> = {
  ORDER_TAG: 'by address',
  RESERVATION_NO: 'by reservation no.',
  ADMIN: 'by admin',
}

export const BOOKING_STATUS_META: Record<PickdropBookingStatus, LabelTone> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue' },
  APPROVED: { label: 'Approved', tone: 'green' },
  COMPLETED: { label: 'Completed', tone: 'slate' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
  FAILED: { label: 'Failed', tone: 'red' },
}

export const TEMPLATE_ICON: Record<string, LucideIcon> = {
  transfer_ride_approved: CheckCircle2,
  transfer_driver_details: Car,
  transfer_driver_changed: Repeat,
  transfer_booking_changed: PencilLine,
  transfer_pickup_reminder: AlarmClock,
  transfer_general_message: MessageSquare,
}

export const templateIcon = (key: string | null | undefined): LucideIcon => (key && TEMPLATE_ICON[key]) || Mail

const fallback = (s: string | null | undefined): LabelTone => ({ label: s ? s.replace(/_/g, ' ').toLowerCase() : '—', tone: 'grey' })
export const draftStatusMeta = (s: string | null | undefined) => DRAFT_STATUS_META[s as DraftStatus] ?? fallback(s)
export const inboundTypeMeta = (s: string | null | undefined) => INBOUND_TYPE_META[s as InboundType] ?? fallback(s)
export const inboundStatusMeta = (s: string | null | undefined) => INBOUND_STATUS_META[s as InboundStatus] ?? fallback(s)
export const bookingStatusMeta = (s: string | null | undefined) => BOOKING_STATUS_META[s as PickdropBookingStatus] ?? fallback(s)

/** Where the draft came from — "Created by <who>" names the admin when we know them. */
export function triggerHint(d: Pick<DraftSummary, 'trigger' | 'editedBy'>): string {
  if (d.trigger === 'ADMIN') return d.editedBy ? `Created by ${d.editedBy}` : TRIGGER_LABEL.ADMIN
  return TRIGGER_LABEL[d.trigger] ?? d.trigger
}

// ── Time ────────────────────────────────────────────────────────────
const MIN = 60_000
const HOUR = 60 * MIN

function durationText(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MIN))
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin % (24 * 60)) / 60)
  const mins = totalMin % 60
  if (days > 0) return hours ? `${days} d ${hours} h` : `${days} d`
  if (hours > 0) return mins ? `${hours} h ${mins} min` : `${hours} h`
  return `${mins} min`
}

export interface Countdown {
  text: string
  tone: Tone
  passed: boolean
}

/** Pickup countdown chip: red under 6 h, amber under 24 h, grey after; "Pickup passed" when past. */
export function countdown(pickupAt: string | null | undefined, now: number = Date.now()): Countdown {
  const at = pickupAt ? Date.parse(pickupAt) : NaN
  if (Number.isNaN(at)) return { text: 'No pickup time', tone: 'grey', passed: false }
  const diff = at - now
  if (diff < 0) return { text: 'Pickup passed', tone: 'grey', passed: true }
  const tone: Tone = diff < 6 * HOUR ? 'red' : diff < 24 * HOUR ? 'amber' : 'grey'
  return { text: `in ${durationText(diff)}`, tone, passed: false }
}

/** "waiting 45 min" — overdue after 30 min, which is when VeloxVerse raises its alert. */
export function waitingAge(createdAt: string | null | undefined, now: number = Date.now()): { text: string; overdue: boolean } {
  const at = createdAt ? Date.parse(createdAt) : NaN
  if (Number.isNaN(at)) return { text: '', overdue: false }
  const diff = Math.max(0, now - at)
  return { text: `waiting ${durationText(diff)}`, overdue: diff > 30 * MIN }
}

/** A send that started more than 10 minutes ago may be claimed again (the server stopped mid-send). */
export const SENDING_STALE_MS = 10 * MIN
export function isSendingStale(d: Pick<DraftSummary, 'status' | 'sendingStartedAt'>, now: number = Date.now()): boolean {
  if (d.status !== 'SENDING') return false
  const at = d.sendingStartedAt ? Date.parse(d.sendingStartedAt) : NaN
  return Number.isNaN(at) || now - at > SENDING_STALE_MS
}

/** "23 Oct, 10:42" in the admin's own zone (only for times that aren't pickup times). */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeOnly(iso: string | number | Date): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const at = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(at)) return ''
  const diff = now - at
  if (diff < MIN) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`
  if (diff < 24 * HOUR) return `${Math.floor(diff / HOUR)} h ago`
  const days = Math.floor(diff / (24 * HOUR))
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Placeholders ────────────────────────────────────────────────────
export const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

/** Fallback labels (spec §3.2) for when the template list hasn't loaded. */
export const PLACEHOLDER_LABELS: Record<string, string> = {
  customerName: 'Customer first name',
  orderNo: 'VeloxVerse order number',
  reservationNo: 'ViaTovia reservation number',
  pickupDateTime: 'Pickup date and time (local)',
  pickupPlace: 'Pickup place',
  dropoffPlace: 'Drop-off place',
  vehicle: 'Vehicle',
  passengers: 'Number of passengers',
  flightNumber: 'Flight number',
  driverName: 'Driver name',
  driverPhone: 'Driver phone',
  vehiclePlate: 'Vehicle plate',
  meetingPoint: 'Meeting point / instructions',
  changeSummary: 'What changed (booking changed)',
  message: 'Free message (general message)',
  ticketLink: 'Link to My Bookings',
  supportEmail: 'Support email',
  operator: 'Transport company (operated by)',
}

/** Placeholders that take a paragraph rather than a line. */
export const MULTILINE_PLACEHOLDERS = new Set(['message', 'changeSummary', 'meetingPoint'])

export function placeholderLabel(key: string, placeholders?: { key: string; label: string }[] | null): string {
  return placeholders?.find((p) => p.key === key)?.label ?? PLACEHOLDER_LABELS[key] ?? key
}

/** Keys used in a text, in order of first use, without repeats. */
export function placeholdersIn(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const m of (text ?? '').matchAll(PLACEHOLDER_RE)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

/** Value that will be sent: an admin value wins over the automatic one. */
export function effectiveValue(d: Pick<DraftDetail, 'values' | 'adminValues'>, key: string): string {
  const admin = d.adminValues?.[key]
  if (admin != null && admin !== '') return admin
  return d.values?.[key] ?? ''
}

export const isAdminValue = (d: Pick<DraftDetail, 'adminValues'>, key: string) =>
  d.adminValues?.[key] != null && d.adminValues[key] !== ''

/** For an unknown placeholder in pasted text ({{drivername}}), the real one it was meant to be. */
export function closestPlaceholder(key: string, known: { key: string }[]): string | null {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return known.find((p) => p.key.toLowerCase().replace(/[^a-z0-9]/g, '') === k)?.key ?? null
}

/** "Unknown placeholder {{drivername}}" → ["drivername"] */
export function unknownPlaceholdersIn(problems: string[]): string[] {
  const out: string[] = []
  for (const p of problems) {
    if (!/unknown placeholder/i.test(p)) continue
    for (const m of p.matchAll(PLACEHOLDER_RE)) if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

// Editor HTML ↔ stored HTML. The editor holds placeholders as <span data-placeholder="key"> atoms;
// VeloxVerse stores them as plain {{key}} text. Only text nodes are converted — a {{ticketLink}}
// inside an href stays as it is.
export function placeholdersToChips(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html ?? ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const node of texts) {
    const value = node.nodeValue ?? ''
    if (!PLACEHOLDER_RE.test(value)) continue
    PLACEHOLDER_RE.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let last = 0
    for (const m of value.matchAll(PLACEHOLDER_RE)) {
      const i = m.index ?? 0
      if (i > last) frag.appendChild(doc.createTextNode(value.slice(last, i)))
      const span = doc.createElement('span')
      span.setAttribute('data-placeholder', m[1])
      frag.appendChild(span)
      last = i + m[0].length
    }
    if (last < value.length) frag.appendChild(doc.createTextNode(value.slice(last)))
    node.parentNode?.replaceChild(frag, node)
  }
  return doc.body.innerHTML
}

export function chipsToPlaceholders(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html ?? ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  doc.body.querySelectorAll('[data-placeholder]').forEach((el) => {
    el.replaceWith(doc.createTextNode(`{{${el.getAttribute('data-placeholder')}}}`))
  })
  return doc.body.innerHTML
}

/** Subject split into text and placeholder parts, for showing chips next to a plain input. */
export function subjectParts(subject: string): Array<{ text: string } | { key: string }> {
  const parts: Array<{ text: string } | { key: string }> = []
  let last = 0
  for (const m of subject.matchAll(PLACEHOLDER_RE)) {
    const i = m.index ?? 0
    if (i > last) parts.push({ text: subject.slice(last, i) })
    parts.push({ key: m[1] })
    last = i + m[0].length
  }
  if (last < subject.length) parts.push({ text: subject.slice(last) })
  return parts
}

/** Link targets the editor accepts — the same set VeloxVerse keeps. */
export function isAllowedEmailLink(url: string): boolean {
  const u = url.trim()
  if (/^\{\{\s*[A-Za-z0-9_]+\s*\}\}$/.test(u)) return true
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d][\d\s()-]*)$/i.test(u)
}

// ── Readiness ───────────────────────────────────────────────────────
export type ReadinessKind = 'ready' | 'missing' | 'failed' | 'sending' | 'sent' | 'discarded'
export interface Readiness {
  kind: ReadinessKind
  label: string
  tone: Tone
  /** Tooltip: missing field labels or the send error. */
  detail: string | null
}

export function readiness(
  d: Pick<DraftSummary, 'status' | 'missing' | 'error'>,
  placeholders?: { key: string; label: string }[] | null,
): Readiness {
  if (d.status === 'SENT') return { kind: 'sent', label: 'Sent', tone: 'green', detail: null }
  if (d.status === 'DISCARDED') return { kind: 'discarded', label: 'Discarded', tone: 'grey', detail: null }
  if (d.status === 'SENDING') return { kind: 'sending', label: 'Sending…', tone: 'blue', detail: null }
  if (d.status === 'FAILED') return { kind: 'failed', label: 'Send failed', tone: 'red', detail: d.error ?? null }
  const missing = d.missing ?? []
  if (missing.length === 0) return { kind: 'ready', label: 'Ready to send', tone: 'green', detail: null }
  return {
    kind: 'missing',
    label: `${missing.length} field${missing.length === 1 ? '' : 's'} missing`,
    tone: 'amber',
    detail: missing.map((k) => placeholderLabel(k, placeholders)).join(', '),
  }
}

export const isOpenDraft = (d: Pick<DraftSummary, 'status'>) => d.status === 'DRAFT' || d.status === 'FAILED' || d.status === 'SENDING'

// ── Details check (Review screen, middle column) ────────────────────
export type DetailState = 'ok' | 'different' | 'missing'

export interface DetailRow {
  key: string
  label: string
  ours: string
  email: string
  willSend: string
  state: DetailState
  /** Shown without opening "More details": required, used in the email, or has a problem. */
  relevant: boolean
  mismatch: Mismatch | null
}

const DETAIL_FIELDS: Array<{ key: string; label: string; ours: (b: NonNullable<DraftDetail['booking']>) => string | null; email: string }> = [
  { key: 'reservationNo', label: 'Reservation', ours: (b) => b.reservationNo, email: 'reservationNo' },
  { key: 'pickupDateTime', label: 'Pickup', ours: (b) => b.pickupLocal, email: 'pickupDateTime' },
  { key: 'pickupPlace', label: 'From', ours: (b) => b.pickupName, email: 'pickupPlace' },
  { key: 'dropoffPlace', label: 'To', ours: (b) => b.dropoffName, email: 'dropoffPlace' },
  { key: 'flightNumber', label: 'Flight', ours: (b) => b.flightNumber, email: 'flightNumber' },
  { key: 'driverName', label: 'Driver', ours: (b) => b.driverName, email: 'driverName' },
  { key: 'driverPhone', label: 'Driver phone', ours: (b) => b.driverPhone, email: 'driverPhone' },
  { key: 'vehiclePlate', label: 'Vehicle plate', ours: (b) => b.vehiclePlate, email: 'vehiclePlate' },
  { key: 'meetingPoint', label: 'Meeting point', ours: () => null, email: 'meetingPoint' },
  { key: 'operator', label: 'Transport company', ours: () => null, email: 'operator' },
]

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Rows comparing our booking (just refreshed from ViaTovia), what ViaTovia's email said, and what
 * will be sent. `dismissed` = fields where the admin clicked "Keep ours" this visit.
 * Note: the email's passengerPhone is the CUSTOMER's — it never feeds a driver row.
 */
export function detailsCheckRows(d: DraftDetail, dismissed: ReadonlySet<string> = new Set()): DetailRow[] {
  const ex = d.sourceEmail?.extracted ?? null
  const mismatches = d.sourceEmail?.mismatches ?? []
  const missing = new Set(d.preview?.missing ?? d.missing ?? [])
  const used = new Set([...(d.requiredFields ?? []), ...placeholdersIn(d.subject), ...placeholdersIn(d.bodyHtml)])
  return DETAIL_FIELDS.map((f) => {
    const ours = (d.booking ? f.ours(d.booking) : null) ?? ''
    const email = ((ex as Record<string, unknown> | null)?.[f.email] as string | null | undefined) ?? ''
    const willSend = effectiveValue(d, f.key)
    const mismatch = mismatches.find((m) => m.field === f.key) ?? null
    let state: DetailState = 'ok'
    if (missing.has(f.key)) state = 'missing'
    // A difference the admin already settled — by taking ViaTovia's value or keeping ours — is ok.
    else if (mismatch && !dismissed.has(f.key) && norm(willSend) !== norm(mismatch.email)) state = 'different'
    return {
      key: f.key,
      label: f.label,
      ours,
      email,
      willSend,
      state,
      relevant: used.has(f.key) || state !== 'ok',
      mismatch,
    }
  })
}

// ── Queue navigation ───────────────────────────────────────────────
/** The draft to open after sending `currentId`: the next one in queue order, else the first other
 * one still open. `null` = all caught up. */
export function nextDraftId(queueIds: string[], currentId: string): string | null {
  const idx = queueIds.indexOf(currentId)
  if (idx >= 0 && idx + 1 < queueIds.length) return queueIds[idx + 1]
  return queueIds.find((id) => id !== currentId) ?? null
}

/** `[` / `]` on the Review screen — no wrap-around. */
export function adjacentDraftId(queueIds: string[], currentId: string, dir: 1 | -1): string | null {
  const idx = queueIds.indexOf(currentId)
  if (idx < 0) return null
  return queueIds[idx + dir] ?? null
}

// ── Errors (spec §3.3) ──────────────────────────────────────────────
interface ErrBody {
  message?: string
  requestId?: string
  errors?: { missing?: unknown; problems?: unknown; needsConfirmation?: unknown } | unknown
}

function errParts(err: unknown): { status?: number; message: string; body: ErrBody } {
  const res = (err as { response?: { status?: number; data?: ErrBody } })?.response
  const body = (res?.data && typeof res.data === 'object' ? res.data : {}) as ErrBody
  return { status: res?.status, message: typeof body.message === 'string' ? body.message : '', body }
}

function errorsObject(body: ErrBody): Record<string, unknown> {
  return body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors) ? (body.errors as Record<string, unknown>) : {}
}

/** VeloxVerse's test mode refusing a send. Its 403 reaches us as 403 (or 502 on older proxies). */
export function isTestModeError(err: unknown): boolean {
  const { status, message } = errParts(err)
  return (status === 403 || status === 502) && /^test mode:/i.test(message.trim())
}

/** 409 asking to confirm sending about a cancelled ride. */
export function needsCancelledConfirm(err: unknown): boolean {
  const { status, body } = errParts(err)
  return status === 409 && errorsObject(body).needsConfirmation === 'confirmCancelled'
}

/** 400 "Fill in before sending: …" → the placeholder keys. */
export function missingFromError(err: unknown): string[] {
  const { status, body } = errParts(err)
  const missing = errorsObject(body).missing
  return status === 400 && Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : []
}

/** 400 with errors.problems (unknown placeholder, empty subject…). */
export function problemsFromError(err: unknown): string[] {
  const { body } = errParts(err)
  const problems = errorsObject(body).problems
  return Array.isArray(problems) ? problems.filter((p): p is string => typeof p === 'string') : []
}

export const errorStatus = (err: unknown) => errParts(err).status
export const isConflict = (err: unknown) => errParts(err).status === 409
export const isReaderOff = (err: unknown) => errParts(err).status === 503

/** The draft is past editing (sent, discarded, or someone else is sending it). */
export function isLockedDraftError(err: unknown): boolean {
  const { status, message } = errParts(err)
  return status === 409 && !needsCancelledConfirm(err) && /sent|discarded|sending/i.test(message)
}

/** 400 about the voucher PDF (none on the email, or retention deleted it). */
export function isVoucherError(err: unknown): boolean {
  const { status, message } = errParts(err)
  return status === 400 && /voucher|attach/i.test(message)
}

/** "message (Ref: id)" — VeloxVerse writes its messages for staff, so they're shown as they are. */
export function pdErrorText(err: unknown, fallbackText = 'Something went wrong.'): string {
  const { status, message, body } = errParts(err)
  if (!status && err instanceof Error && !message) return err.message || fallbackText
  if (status === 403 && !isTestModeError(err)) return "You don't have permission to do this."
  const text = message || fallbackText
  return body.requestId ? `${text} (Ref: ${body.requestId})` : text
}
