import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { vvLoungeService, type LoungeVisitsParams } from '../vvAdminService'

export function useVVLoungeVisits(params: LoungeVisitsParams = {}) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['vv-lounge', 'visits', params],
    queryFn: () => vvLoungeService.getVisits(params),
  })
}

export function useVVLoungeMemberships() {
  return useQuery({
    queryKey: ['vv-lounge', 'memberships'],
    queryFn: () => vvLoungeService.getMemberships(),
  })
}

export function useVVLoungeStats() {
  return useQuery({
    queryKey: ['vv-lounge', 'stats'],
    queryFn: () => vvLoungeService.getStats(),
  })
}

export function useVVLoungeVisitDetail(visitId: string | null | undefined) {
  return useQuery({
    queryKey: ['vv-lounge', 'visit-detail', visitId],
    queryFn: () => vvLoungeService.getVisitDetail(visitId!),
    enabled: !!visitId,
  })
}

/** Every lounge / dining / fast-track / fitness booking for one VeloxVerse customer. There's no
 * per-user visits endpoint, so this searches by account email (the visits endpoint matches
 * account email) and then keeps only rows whose account is this exact user — the search is a
 * substring match, so "ann@x.com" would otherwise also pick up "joann@x.com". */
export function useVVCustomerLoungeVisits(userId: string | undefined, email: string | undefined) {
  const normalizedEmail = email?.trim().toLowerCase() ?? ''
  return useQuery({
    queryKey: ['vv-lounge', 'customer-visits', userId, normalizedEmail],
    queryFn: async () => {
      const page = await vvLoungeService.getVisits({ search: normalizedEmail, bookingType: 'all', limit: 100 })
      return page.items.filter(
        (v) => v.customer?.id === userId || v.customer?.email?.trim().toLowerCase() === normalizedEmail
      )
    },
    enabled: !!userId && !!normalizedEmail,
  })
}
