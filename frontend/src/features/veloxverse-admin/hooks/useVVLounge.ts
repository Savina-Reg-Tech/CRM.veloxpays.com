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
