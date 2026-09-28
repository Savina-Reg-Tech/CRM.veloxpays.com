import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvReferralService } from '../vvAdminService'
import type { ReferralCodeFilters, ReferralCodePatch, ReferralListFilters } from '../types'

export function useVVReferralOverview(days: number) {
  return useQuery({
    queryKey: ['vv-referrals', 'overview', days],
    queryFn: () => vvReferralService.overview(days),
    placeholderData: (prev) => prev,
  })
}

export function useVVReferrals(filters: ReferralListFilters) {
  return useQuery({
    queryKey: ['vv-referrals', 'list', filters],
    queryFn: () => vvReferralService.list(filters),
    placeholderData: (prev) => prev,
  })
}

export function useVVReferral(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-referrals', 'detail', id],
    queryFn: () => vvReferralService.get(id!),
    enabled: Boolean(id),
  })
}

export function useVVReferralCodes(filters: ReferralCodeFilters) {
  return useQuery({
    queryKey: ['vv-referrals', 'codes', filters],
    queryFn: () => vvReferralService.listCodes(filters),
    placeholderData: (prev) => prev,
  })
}

export function useVVUpdateReferralCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReferralCodePatch }) => vvReferralService.updateCode(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-referrals'] })
    },
  })
}
