import type { VVAdminUserDetail } from '@/features/veloxverse-admin/types'
import type { AdminTransferBooking, VVSupportTicket, ClubMembershipDetail } from '@/features/veloxverse-admin/types'
import { formatDate } from '@/features/veloxverse-admin/utils'
import type { Lead } from '@/features/forms/types'

// Note: VeloxVerse doesn't sell lounge "memberships" (recurring plans) — only one-off paid
// lounge/benefit bookings, which show up via the billing ledger instead, not this feed.
export type CustomerActivityKind = 'ESIM' | 'TRANSFER' | 'SUPPORT' | 'FORM' | 'CLUB'

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
  // Lead statuses (Form Builder submissions, e.g. Meet & Greet requests) — see models/Lead.js.
  'NEW',
  'REVIEW',
  // VeloxClub membership status meaning a renewal payment failed — needs admin follow-up.
  'PAST_DUE',
])

const CANCELLED_STATUSES = new Set([
  'CANCELLED',
  'CANCELED',
  'FAILED',
  'REFUNDED',
  'CLOSED',
  'NO_SHOW',
  'ARCHIVED',
  // Lead status meaning "marked as spam" — treat like a dead/closed item, not an open action.
  'SPAM',
  // VeloxClub membership status meaning the billing cycle lapsed without renewal.
  'EXPIRED',
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
  tickets: VVSupportTicket[]
  leads?: Lead[]
  clubMemberships?: ClubMembershipDetail[]
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
      title: `${t.pickupName ?? 'Pickup'} → ${t.dropoffName ?? 'Drop-off'}`,
      subtitle: t.orderNo,
      status: t.status,
      amountUsd: (t.salePriceCents ?? 0) / 100,
      isPending: isPendingStatus(t.status),
      isCancelled: isCancelledStatus(t.status),
      at: t.createdAt ?? t.orderNo,
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

  // VeloxClub memberships — purchasePriceCents is what was actually charged at purchase, not
  // the tier's current list price (tiers can change price after someone already joined).
  for (const m of input.clubMemberships ?? []) {
    items.push({
      id: `club-${m.id}`,
      kind: 'CLUB',
      title: `${m.tier} VeloxClub membership`,
      subtitle: `Renews ${formatDate(m.billingCycleEnd)}`,
      status: m.status,
      amountUsd: m.purchasePriceCents / 100,
      isPending: isPendingStatus(m.status),
      isCancelled: isCancelledStatus(m.status),
      at: m.purchasedAt,
    })
  }

  // Form Builder submissions tied to this customer's email — e.g. Meet & Greet requests, or
  // any other public form (see features/forms). Not just Meet & Greet: any form this
  // customer's email has submitted shows up here, so "everything they've done" is complete.
  for (const lead of input.leads ?? []) {
    items.push({
      id: `lead-${lead.id}`,
      kind: 'FORM',
      title: lead.form_name ? `${lead.form_name} request` : 'Form request',
      subtitle: lead.phone ?? undefined,
      status: lead.status,
      isPending: isPendingStatus(lead.status),
      isCancelled: isCancelledStatus(lead.status),
      at: lead.created_at,
    })
  }

  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function countPendingActivity(items: CustomerActivityItem[]): number {
  return items.filter((i) => i.isPending && !i.isCancelled).length
}
