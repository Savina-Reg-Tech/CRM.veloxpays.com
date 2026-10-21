import type { BadgeVariant } from '@/components/ui/Badge'
import { centsToMajorOrNull, formatMoney } from '@/lib/utils'
import type { ActivityDirection, ActivityType, AdminBillingLineItem, KnownActivityType, RecentActivity } from './types'

/**
 * Maps a status string (any service) to a CRM Badge variant.
 * Shared across all VeloxVerse admin pages.
 */
export function statusBadgeVariant(status: string): BadgeVariant {
  const s = status.toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'PUBLISHED', 'RESOLVED'].includes(s)) return 'success'
  if (['PENDING', 'DRAFT', 'OPEN', 'CONFIRMED'].includes(s)) return 'warning'
  // RECONCILING = a payment that needs a manual refund (see loungeUtils.paymentStatusLabel).
  if (['CANCELLED', 'FAILED', 'ARCHIVED', 'CLOSED', 'EXPIRED', 'REFUNDED', 'RECONCILING'].includes(s)) return 'danger'
  if (['IN_PROGRESS', 'APPROVED', 'SUSPENDED'].includes(s)) return 'info'
  return 'neutral'
}

/** Mint-confirmed currencies VeloxVerse can charge/convert — mirrors backend
 * `SUPPORTED_PREFERRED_CURRENCIES` (veloxverse/backend/src/constants/index.ts). Used to drive the
 * Analytics page's currency selector; the backend re-validates and falls back to USD for anything
 * not on this list, so this is a display-only mirror, not the source of truth. */
export const ANALYTICS_CURRENCIES = ['USD', 'GBP', 'EUR', 'AUD', 'NZD', 'INR', 'BDT', 'CAD'] as const
export type AnalyticsCurrency = (typeof ANALYTICS_CURRENCIES)[number]

export const ANALYTICS_CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
  INR: 'Indian Rupee',
  BDT: 'Bangladeshi Taka',
  CAD: 'Canadian Dollar',
}

/** Badge colors for recent-activity type labels (independent of amount sign). */
export const ACTIVITY_TYPE_BADGE_CLASS: Record<KnownActivityType, string> = {
  ESIM: 'bg-blue-50 text-blue-700 ring-blue-200',
  ESIM_TOPUP: 'bg-sky-50 text-sky-700 ring-sky-200',
  CLUB: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  LOUNGE: 'bg-violet-50 text-violet-700 ring-violet-200',
  BENEFIT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TRANSFER: 'bg-amber-50 text-amber-700 ring-amber-200',
  REFUND: 'bg-red-50 text-red-700 ring-red-200',
}

/** Display labels for recent-activity types. */
export const ACTIVITY_TYPE_LABEL: Record<KnownActivityType, string> = {
  ESIM: 'ESIM',
  ESIM_TOPUP: 'ESIM TOP-UP',
  CLUB: 'VELOXCLUB',
  LOUNGE: 'LOUNGE',
  BENEFIT: 'BENEFIT',
  TRANSFER: 'PICK & DROP',
  REFUND: 'REFUND',
}

function isKnownActivityType(type: string): type is KnownActivityType {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_LABEL, type)
}

/** Badge label for an activity type — a type this CRM doesn't know yet shows as sent. */
export function activityTypeLabel(type: ActivityType): string {
  return isKnownActivityType(type) ? ACTIVITY_TYPE_LABEL[type] : String(type ?? '—')
}

/** Badge color for an activity type — neutral gray for one this CRM doesn't know yet. */
export function activityTypeBadgeClass(type: ActivityType): string {
  return isKnownActivityType(type) ? ACTIVITY_TYPE_BADGE_CLASS[type] : 'bg-gray-50 text-gray-700 ring-gray-200'
}

/** Resolve credit/debit from API `direction`, with fallback for older payloads. */
export function activityDirection(item: {
  direction?: ActivityDirection
  type: ActivityType
}): ActivityDirection {
  return item.direction ?? (item.type === 'REFUND' ? 'debit' : 'credit')
}

/** Format a recent-activity amount with +/- sign from direction, in its real currency.
 * `currency` defaults to USD only for legacy rows that predate the field. */
export function formatActivityAmount(amountUsd: number, direction: ActivityDirection, currency?: string): string {
  const sign = direction === 'credit' ? '+' : '−'
  return `${sign}${formatMoney(amountUsd, currency)}`
}

/** "INR 12,000.00 + BDT 3,500.00" — a customer's spend in the currencies they actually paid in,
 * never summed across currencies. */
export function formatNativeSpend(native: { currency: string; amount: number }[] | undefined): string | null {
  if (!native?.length) return null
  return native.map((n) => formatMoney(n.amount, n.currency)).join(' + ')
}

/** The message VeloxVerse sent with a failed request, shown to staff as-is — falls back to the
 * given text (not axios's "Request failed with status code 409"). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export const TRANSFER_UNCONFIRMED_NOTICE = 'Paid — not confirmed by the transport provider. Check the ViaTovia panel.'

/** An eSIM order that was never paid (see AdminOrderRow.paid). Only an explicit `false` counts —
 * a missing field (older VeloxVerse) leaves the row as it always was. Unpaid rows show "—" for
 * cost / price / profit and must be left out of any total. */
export function isUnpaidOrder(order: { paid?: boolean } | null | undefined): boolean {
  return order?.paid === false
}

/** Tooltip for an unpaid order's dashes. */
export function unpaidOrderNote(order: { quotedPriceUsd?: number | null; currency?: string }): string {
  return typeof order.quotedPriceUsd === 'number'
    ? `Quoted ${formatMoney(order.quotedPriceUsd, order.currency)} — checkout was not completed.`
    : 'Checkout was not completed — nothing was paid.'
}

export interface CardCharge {
  amount: number | null
  currency: string | null
}

/** A row's own AUD card charge, when VeloxVerse sends it on that row. `undefined` = the endpoint
 * doesn't carry the field (not the same as `null` = "no card charge"). */
export function ownCardCharge(row: { cardChargeCents?: number | null; cardChargeCurrency?: string | null }): CardCharge | undefined {
  if (row.cardChargeCents === undefined) return undefined
  return { amount: centsToMajorOrNull(row.cardChargeCents), currency: row.cardChargeCurrency ?? null }
}

/**
 * The AUD card charge of one payment, read off the customer's billing ledger. Ledger purchase
 * rows are keyed by the payment id (`id` / `orderNo` are both the payment id there — NOT the eSIM
 * or transfer order number), which is what a VeloxClub membership stores as `paymentReferenceId`.
 */
export function cardChargeForPayment(items: AdminBillingLineItem[] | undefined, paymentId: string | null | undefined): CardCharge | undefined {
  if (!paymentId) return undefined
  const row = items?.find((li) => li.id === paymentId && li.direction === 'debit' && li.type !== 'REFUND')
  return row ? ownCardCharge(row) : undefined
}

/**
 * Order number → AUD card charge, from the recent-orders feed. VeloxVerse resolves each row's
 * payment server-side there, so this is exact for eSIM orders, Pick & Drop bookings and
 * lounge/benefit visits (keyed by `orderId`, else the visit id) — but only for what the feed
 * returns (the most recent rows), so an older order is simply absent.
 */
export function cardChargesByOrderNo(recent: RecentActivity[] | undefined): Map<string, CardCharge> {
  const map = new Map<string, CardCharge>()
  for (const o of recent ?? []) {
    if (o.type === 'REFUND' || o.cardChargeAmount === undefined) continue
    map.set(o.orderNo, { amount: o.cardChargeAmount, currency: o.cardChargeCurrency ?? null })
  }
  return map
}

/** Format an ISO date string to a readable local date/time. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Format an ISO date string to a readable local date + time. */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Relative time label — "2m ago", "3h ago", "5d ago", etc. */
export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

/** Extract 1-2 letter initials from a name string. */
export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0][0] ?? '?').toUpperCase()
}
