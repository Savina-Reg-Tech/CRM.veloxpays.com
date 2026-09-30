import type { BadgeVariant } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/utils'
import { statusBadgeVariant } from './utils'
import type { LoungeVisit, LoungeVisitStatus } from './types'

/** Integer cents in the booking's own currency (never assume USD). */
export function formatCentsIn(cents: number | null | undefined, currency?: string | null): string {
  return formatMoney((cents ?? 0) / 100, currency)
}

export function isWalkIn(v: Pick<LoungeVisit, 'bookingType' | 'walkinPass' | 'resourceType'>): boolean {
  return !v.resourceType && (v.bookingType === 'WALK_IN' || !!v.walkinPass)
}

/** Lounge Walk-in / Lounge Prebook / Dining / Fast Track / Fitness */
export function serviceLabel(v: Pick<LoungeVisit, 'bookingType' | 'walkinPass' | 'resourceType'>): string {
  switch (v.resourceType) {
    case 'DINING':
      return 'Dining'
    case 'FAST_TRACK':
      return 'Fast Track'
    case 'FITNESS':
      return 'Fitness'
    case null:
    case undefined:
      return isWalkIn(v) ? 'Lounge Walk-in' : v.bookingType === 'PREBOOK' ? 'Lounge Prebook' : 'Lounge'
    default:
      return String(v.resourceType)
  }
}

const DEFAULT_STATUS_LABEL: Record<LoungeVisitStatus, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
  pending_confirmation: 'Pending confirmation',
}

const WALK_IN_STATUS_LABEL: Partial<Record<LoungeVisitStatus, string>> = {
  confirmed: 'Valid',
  completed: 'Used',
  no_show: 'Expired',
}

/** Walk-in passes read confirmed → Valid, completed → Used, no_show → Expired. */
export function visitStatusLabel(v: Pick<LoungeVisit, 'status' | 'bookingType' | 'walkinPass' | 'resourceType'>): string {
  if (isWalkIn(v) && WALK_IN_STATUS_LABEL[v.status]) return WALK_IN_STATUS_LABEL[v.status]!
  return DEFAULT_STATUS_LABEL[v.status] ?? v.status
}

export function visitStatusVariant(v: Pick<LoungeVisit, 'status' | 'bookingType' | 'walkinPass' | 'resourceType'>): BadgeVariant {
  if (isWalkIn(v)) {
    if (v.status === 'confirmed') return 'success'
    if (v.status === 'completed') return 'info'
    if (v.status === 'no_show') return 'danger'
  }
  if (v.status === 'pending_confirmation') return 'warning'
  return statusBadgeVariant(v.status)
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** e.g. "2 Adults, 1 Child, 1 Infant (Free)"; falls back to guest count for older rows. */
export function partyLabel(v: Pick<LoungeVisit, 'adults' | 'children' | 'infants' | 'infantsFree' | 'guestCount'>): string {
  const parts: string[] = []
  if (v.adults) parts.push(plural(v.adults, 'Adult', 'Adults'))
  if (v.children) parts.push(plural(v.children, 'Child', 'Children'))
  if (v.infants) parts.push(`${plural(v.infants, 'Infant', 'Infants')}${v.infantsFree ? ' (Free)' : ''}`)
  if (parts.length) return parts.join(', ')
  return plural(v.guestCount ?? 0, 'Guest', 'Guests')
}

function isValidZone(tz?: string | null): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** UTC ISO → "1 Oct 2026, 14:30 GMT+1" in the lounge's zone. Falls back to browser time. */
export function formatInZone(iso?: string | null, timeZone?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const zone = isValidZone(timeZone) ? timeZone : undefined
  return d.toLocaleString('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/** Visit date is a lounge-local calendar date — format it without shifting through the browser zone. */
export function formatVisitDate(date?: string | null): string {
  if (!date) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(date)
  if (isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })
}

/** Plain "1 Oct 2026, 14:30" — for our own timestamps (booked at, emails) in the viewer's zone. */
export function formatStamp(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function paymentStatusVariant(status?: string | null): BadgeVariant {
  const s = (status ?? '').toUpperCase()
  if (['FULFILLED', 'PAID', 'SUCCEEDED', 'CAPTURED'].includes(s)) return 'success'
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(s)) return 'info'
  if (['ABANDONED', 'FAILED', 'DECLINED'].includes(s)) return 'danger'
  if (['PENDING', 'PROCESSING', 'INITIATED'].includes(s)) return 'warning'
  return 'neutral'
}
