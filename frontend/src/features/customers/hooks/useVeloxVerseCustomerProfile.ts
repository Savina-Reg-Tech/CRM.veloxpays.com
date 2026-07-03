import { useMemo } from 'react'
import { useVVUserDetail } from '@/features/veloxverse-admin/hooks/useVVUsers'
import { useVVTransferBookings } from '@/features/veloxverse-admin/hooks/useVVTransfers'
import { useVVLoungeMemberships } from '@/features/veloxverse-admin/hooks/useVVLounge'
import { useVVSupportTickets } from '@/features/veloxverse-admin/hooks/useVVSupport'
import {
  buildVeloxVerseActivity,
  countPendingActivity,
  type CustomerActivityItem,
} from '../utils/veloxverseActivity'

export function useVeloxVerseCustomerProfile(userId: string | null, email?: string) {
  const detailQuery = useVVUserDetail(userId ?? undefined)
  const transfersQuery = useVVTransferBookings()
  const membershipsQuery = useVVLoungeMemberships()
  const ticketsQuery = useVVSupportTickets()

  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  const transfers = useMemo(
    () =>
      (transfersQuery.data ?? []).filter(
        (b) => b.customerEmail?.trim().toLowerCase() === normalizedEmail
      ),
    [transfersQuery.data, normalizedEmail]
  )

  const memberships = useMemo(
    () => (membershipsQuery.data ?? []).filter((m) => m.userId === userId),
    [membershipsQuery.data, userId]
  )

  const tickets = useMemo(
    () =>
      (ticketsQuery.data ?? []).filter(
        (t) => t.userId === userId || t.customer?.email?.trim().toLowerCase() === normalizedEmail
      ),
    [ticketsQuery.data, userId, normalizedEmail]
  )

  const activity: CustomerActivityItem[] = useMemo(
    () =>
      buildVeloxVerseActivity({
        detail: detailQuery.data,
        transfers,
        memberships,
        tickets,
      }),
    [detailQuery.data, transfers, memberships, tickets]
  )

  const pendingCount = useMemo(() => countPendingActivity(activity), [activity])

  const isLoading =
    detailQuery.isLoading ||
    transfersQuery.isLoading ||
    membershipsQuery.isLoading ||
    ticketsQuery.isLoading

  return {
    detail: detailQuery.data,
    transfers,
    memberships,
    tickets,
    activity,
    pendingCount,
    isLoading,
    isError: detailQuery.isError,
  }
}
