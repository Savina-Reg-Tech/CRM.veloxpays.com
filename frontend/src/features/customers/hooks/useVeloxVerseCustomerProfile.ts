import { useMemo } from 'react'
import { useVVUserDetail } from '@/features/veloxverse-admin/hooks/useVVUsers'
import { useVVTransferBookings } from '@/features/veloxverse-admin/hooks/useVVTransfers'
import { useVVSupportTickets } from '@/features/veloxverse-admin/hooks/useVVSupport'
import { useVVClubMember } from '@/features/veloxverse-admin/hooks/useVVClub'
import { useVVUserPoints } from '@/features/veloxverse-admin/hooks/useVVPoints'
import { useVVAdminBillingActivity } from '@/features/veloxverse-admin/hooks/useVVBilling'
import { useLeads } from '@/features/forms/hooks/useForms'
import {
  buildVeloxVerseActivity,
  countPendingActivity,
  type CustomerActivityItem,
} from '../utils/veloxverseActivity'

export function useVeloxVerseCustomerProfile(userId: string | null, email?: string) {
  const detailQuery = useVVUserDetail(userId ?? undefined)
  const transfersQuery = useVVTransferBookings()
  const ticketsQuery = useVVSupportTickets()
  // Club/points/billing failing (e.g. a brand-new customer with no club membership yet) must
  // never block the rest of the profile — each renders its own empty state, so these three are
  // deliberately NOT folded into the shared isLoading/isError below.
  const clubQuery = useVVClubMember(userId ?? undefined)
  const pointsQuery = useVVUserPoints(userId ?? undefined)
  const billingQuery = useVVAdminBillingActivity(userId ?? undefined)

  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  // Any Form Builder submission (Meet & Greet, or any other public form) tied to this
  // customer's email — server-side filtered by email so this stays cheap even with a lot of
  // leads. See models/Lead.js: `search` matches against LOWER(email) OR LOWER(name).
  const leadsQuery = useLeads({ search: normalizedEmail || undefined, limit: 50 })
  const leads = useMemo(
    () => (leadsQuery.data?.items ?? []).filter((l) => l.email?.trim().toLowerCase() === normalizedEmail),
    [leadsQuery.data, normalizedEmail]
  )

  const transfers = useMemo(
    () =>
      (transfersQuery.data ?? []).filter(
        (b) => b.customer?.email?.trim().toLowerCase() === normalizedEmail
      ),
    [transfersQuery.data, normalizedEmail]
  )

  const tickets = useMemo(
    () =>
      (ticketsQuery.data ?? []).filter(
        (t) => t.userId === userId || t.customer?.email?.trim().toLowerCase() === normalizedEmail
      ),
    [ticketsQuery.data, userId, normalizedEmail]
  )

  const clubMemberships = useMemo(() => clubQuery.data?.memberships ?? [], [clubQuery.data])

  const activity: CustomerActivityItem[] = useMemo(
    () =>
      buildVeloxVerseActivity({
        detail: detailQuery.data,
        transfers,
        tickets,
        leads,
        clubMemberships,
      }),
    [detailQuery.data, transfers, tickets, leads, clubMemberships]
  )

  const pendingCount = useMemo(() => countPendingActivity(activity), [activity])

  const isLoading =
    detailQuery.isLoading ||
    transfersQuery.isLoading ||
    ticketsQuery.isLoading ||
    leadsQuery.isLoading

  return {
    detail: detailQuery.data,
    transfers,
    tickets,
    leads,
    club: clubQuery.data ?? null,
    clubMemberships,
    isClubLoading: clubQuery.isLoading,
    points: pointsQuery.data ?? null,
    isPointsLoading: pointsQuery.isLoading,
    isPointsError: pointsQuery.isError,
    billing: billingQuery.data ?? null,
    isBillingLoading: billingQuery.isLoading,
    isBillingError: billingQuery.isError,
    activity,
    pendingCount,
    isLoading,
    isError: detailQuery.isError,
  }
}
