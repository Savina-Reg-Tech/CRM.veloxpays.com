import type { BadgeVariant } from '@/components/ui/Badge'
import { centsMoney, orderLink } from './billingReports'
import { rangeParams, type ReportRange } from './reportRange'
import type { BillingService, CurrencyAmount, HealthComponentStatus, ReconIssue, ReconRow, ReconSupplier } from './types'

// ── System health ───────────────────────────────────────────────────

export const HEALTH_STATUS_LABEL: Record<HealthComponentStatus, string> = {
  ok: 'Working',
  degraded: 'Having problems',
  down: 'Down',
  idle: 'Not used recently',
}

/** Dot colour per status; `idle` is grey, never green, so "not tested" never reads as healthy. */
export const HEALTH_DOT: Record<HealthComponentStatus, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  idle: 'bg-gray-300',
}

export const HEALTH_KIND_LABEL: Record<string, string> = {
  database: 'Database',
  supplier: 'Suppliers',
  job: 'Background jobs',
  email: 'Email',
}

// ── Supplier reconciliation ─────────────────────────────────────────

export const RECON_SUPPLIERS: ReconSupplier[] = ['esimaccess', 'dragonpass', 'viatovia', 'mint']

export const RECON_SUPPLIER_LABEL: Record<ReconSupplier, string> = {
  esimaccess: 'eSIM Access',
  dragonpass: 'DragonPass',
  viatovia: 'ViaTovia',
  mint: 'Mint',
}

export const ISSUE_LABEL: Record<ReconIssue, string> = {
  mismatch: 'Status mismatch',
  missing_supplier: 'Missing at supplier',
  missing_ours: 'Missing on our side',
  matched: 'Matched',
}

const ISSUE_VARIANT: Record<ReconIssue, BadgeVariant> = {
  mismatch: 'danger',
  missing_supplier: 'warning',
  missing_ours: 'warning',
  matched: 'success',
}

export function issueVariant(issue: ReconIssue): BadgeVariant {
  return ISSUE_VARIANT[issue] ?? 'neutral'
}

/** One amount per currency, never added together: "A$193.56 + ₹54,753.16"; "—" when empty. */
export function currencyList(list: CurrencyAmount[] | null | undefined): string {
  if (!list || list.length === 0) return '—'
  return list.map((a) => centsMoney(a.cents, a.currency)).join(' + ')
}

/**
 * The `from` / `to` to send. VeloxVerse treats "no dates" as the last 30 days, so "All time" sends
 * an explicit early start — otherwise the page would show 30 days under an "All time" label.
 */
export function reconRangeParams(range: ReportRange, now = new Date()): { from?: string; to?: string } {
  if (range.preset === 'all') return { from: new Date(Date.UTC(2020, 0, 1)).toISOString() }
  return rangeParams(range, now)
}

const BILLING_SERVICES = new Set(['ESIM_ORDER', 'ESIM_TOPUP', 'TRANSFER', 'LOUNGE_VISIT', 'CLUB_MEMBERSHIP', 'FLIGHT_BOOKING'])

/** Where a reconciliation row's booking lives in the CRM, or null. */
export function reconOrderLink(supplier: ReconSupplier, row: Pick<ReconRow, 'service' | 'orderNo' | 'visitId'>): string | null {
  switch (supplier) {
    case 'esimaccess':
      return orderLink({ service: 'ESIM_ORDER', orderNo: row.orderNo, visitId: null })
    case 'dragonpass':
      return orderLink({ service: 'LOUNGE_VISIT', orderNo: row.orderNo, visitId: row.visitId })
    case 'viatovia':
      return orderLink({ service: 'TRANSFER', orderNo: row.orderNo, visitId: null })
    default:
      return BILLING_SERVICES.has(row.service)
        ? orderLink({ service: row.service as BillingService, orderNo: row.orderNo, visitId: row.visitId })
        : null
  }
}
