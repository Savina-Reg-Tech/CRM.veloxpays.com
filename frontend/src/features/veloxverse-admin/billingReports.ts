import type { BadgeVariant } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/utils'
import type {
  BillingInitiatorKind,
  BillingOutcome,
  BillingPaymentFilters,
  BillingPaymentStatus,
  BillingRefundFilters,
  BillingRefundRow,
  BillingService,
  ReconRowFilters,
} from './types'

/** Payment `resourceType` → what staff call the service (also used by the AUD card panel). */
export const SERVICE_LABEL: Record<string, string> = {
  ESIM_ORDER: 'eSIM',
  ESIM_TOPUP: 'eSIM top-up',
  LOUNGE_VISIT: 'Lounge & benefits',
  TRANSFER: 'Pick & Drop',
  CLUB_MEMBERSHIP: 'VeloxClub',
  FLIGHT_BOOKING: 'Flights',
}

export function serviceLabel(service: string): string {
  return SERVICE_LABEL[service] ?? service.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export const BILLING_SERVICES = Object.keys(SERVICE_LABEL) as BillingService[]

/** Cents beside a currency → "A$12.50"; "—" when there is no amount. */
export function centsMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  return cents == null ? '—' : formatMoney(cents / 100, currency)
}

export const OUTCOME_LABEL: Record<BillingOutcome, string> = { paid: 'Paid', pending: 'Pending', failed: 'Failed' }

const OUTCOME_VARIANT: Record<BillingOutcome, BadgeVariant> = { paid: 'success', pending: 'warning', failed: 'danger' }

export function outcomeVariant(outcome: BillingOutcome | null): BadgeVariant {
  return outcome ? OUTCOME_VARIANT[outcome] : 'neutral'
}

/** "FULFILLMENT_FAILED" → "Fulfillment failed". */
export function paymentStatusLabel(status: BillingPaymentStatus | string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

const REFUND_STATUS_VARIANT: Record<BillingRefundRow['status'], BadgeVariant> = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
}

export function refundStatusVariant(status: BillingRefundRow['status']): BadgeVariant {
  return REFUND_STATUS_VARIANT[status] ?? 'neutral'
}

export const INITIATOR_LABEL: Record<BillingInitiatorKind, string> = {
  customer: 'Customer',
  staff: 'Staff',
  system: 'Automatic',
  unknown: 'Unknown',
}

/**
 * Where a payment / refund's order lives in the CRM, or null when there is no page for it (club,
 * flights) or no booking was ever made. An eSIM top-up's `orderNo` is its parent eSIM order's.
 */
export function orderLink(row: { service: BillingService; orderNo: string | null; visitId: string | null }): string | null {
  switch (row.service) {
    case 'ESIM_ORDER':
    case 'ESIM_TOPUP':
      return row.orderNo ? `/dashboard/veloxverse/esim-orders/${encodeURIComponent(row.orderNo)}` : null
    case 'LOUNGE_VISIT':
      return row.visitId ? `/dashboard/veloxverse/lounge-bookings/${encodeURIComponent(row.visitId)}` : null
    case 'TRANSFER':
      return row.orderNo ? `/dashboard/veloxverse/transfers?orderNo=${encodeURIComponent(row.orderNo)}` : null
    default:
      return null
  }
}

/** Only the filters that are set, as query params (booleans as "true" / "false"). */
export function billingParams(filters: BillingPaymentFilters | BillingRefundFilters | ReconRowFilters): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return out
}
