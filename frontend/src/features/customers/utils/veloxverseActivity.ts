import type { VVAdminUserDetail } from '@/features/veloxverse-admin/types'
import type { AdminLoungeMembership, AdminTransferBooking, VVSupportTicket } from '@/features/veloxverse-admin/types'

export type CustomerActivityKind = 'ESIM' | 'LOUNGE' | 'TRANSFER' | 'SUPPORT' | 'MEMBERSHIP'

export interface CustomerActivityItem {
  id: string
  kind: CustomerActivityKind
  title: string
  subtitle?: string
  status: string
  amountUsd?: number
  isPending: boolean
  isCancelled: boolean
  at: string
}

const PENDING_STATUSES = new Set([
  'PENDING',
  'OPEN',
  'IN_PROGRESS',
  'CONFIRMED',
  'DRAFT',
  'ACTIVE',
])

const CANCELLED_STATUSES = new Set([
  'CANCELLED',
  'CANCELED',
  'FAILED',
  'REFUNDED',
  'CLOSED',
  'NO_SHOW',
  'ARCHIVED',
])

function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.has(status.toUpperCase())
}

function isCancelledStatus(status: string): boolean {
  return CANCELLED_STATUSES.has(status.toUpperCase())
}

/** Build a unified, time-sorted activity feed for a VeloxVerse customer. */
export function buildVeloxVerseActivity(input: {
  detail: VVAdminUserDetail | undefined
  transfers: AdminTransferBooking[]
  memberships: AdminLoungeMembership[]
  tickets: VVSupportTicket[]
}): CustomerActivityItem[] {
  const items: CustomerActivityItem[] = []

  for (const o of input.detail?.orders ?? []) {
    items.push({
      id: `esim-${o.orderNo}`,
      kind: 'ESIM',
      title: o.packageName || 'eSIM order',
      subtitle: o.orderNo,
      status: o.status,
      amountUsd: o.sellingPrice,
      isPending: isPendingStatus(o.status),
      isCancelled: isCancelledStatus(o.status),
      at: o.orderNo,
    })
  }

  for (const t of input.transfers) {
    items.push({
      id: `transfer-${t.orderNo}`,
      kind: 'TRANSFER',
      title: `${t.pickupLocation} → ${t.dropoffLocation}`,
      subtitle: t.orderNo,
      status: t.status,
      amountUsd: (t.amountCents ?? 0) / 100,
      isPending: isPendingStatus(t.status),
      isCancelled: isCancelledStatus(t.status),
      at: t.createdAt ?? t.orderNo,
    })
  }

  for (const m of input.memberships) {
    items.push({
      id: `membership-${m.id}`,
      kind: 'MEMBERSHIP',
      title: `${m.tier} lounge membership`,
      subtitle: `${m.visitsRemaining} visits remaining`,
      status: m.status,
      isPending: isPendingStatus(m.status),
      isCancelled: isCancelledStatus(m.status),
      at: m.createdAt,
    })
  }

  for (const ticket of input.tickets) {
    items.push({
      id: `ticket-${ticket.id}`,
      kind: 'SUPPORT',
      title: ticket.subject,
      subtitle: ticket.caseId,
      status: ticket.status,
      isPending: isPendingStatus(ticket.status),
      isCancelled: ticket.status === 'CLOSED',
      at: ticket.updatedAt ?? ticket.createdAt,
    })
  }

  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function countPendingActivity(items: CustomerActivityItem[]): number {
  return items.filter((i) => i.isPending && !i.isCancelled).length
}
