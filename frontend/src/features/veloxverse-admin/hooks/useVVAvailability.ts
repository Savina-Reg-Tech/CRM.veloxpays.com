import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vvAvailabilityService } from '../vvAdminService'
import type { AvailabilityChangeParams, AvailabilityRuleInput } from '../types'

// Rules are only ever kept in TanStack Query's memory cache — never in localStorage.
const STALE_MS = 30_000

export function useVVAvailability() {
  return useQuery({
    queryKey: ['vv-availability', 'overview'],
    queryFn: () => vvAvailabilityService.overview(),
    staleTime: STALE_MS,
  })
}

export function useVVAvailabilityPreview(country: string | null, enabled = true) {
  return useQuery({
    queryKey: ['vv-availability', 'preview', country ?? 'unknown'],
    queryFn: () => vvAvailabilityService.preview(country),
    staleTime: STALE_MS,
    enabled,
  })
}

export function useVVAvailabilityChanges(params: AvailabilityChangeParams, enabled = true) {
  return useQuery({
    queryKey: ['vv-availability', 'changes', params],
    queryFn: () => vvAvailabilityService.changes(params),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useVVUpdateAvailabilityRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serviceKey, input }: { serviceKey: string; input: AvailabilityRuleInput }) =>
      vvAvailabilityService.updateRule(serviceKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-availability'] }),
  })
}

export function useVVCustomerCountry(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['vv-availability', 'customer-country', userId],
    queryFn: () => vvAvailabilityService.getCustomerCountry(userId!),
    staleTime: STALE_MS,
    enabled: Boolean(userId) && enabled,
    retry: false,
  })
}

export function useVVSetCustomerCountry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, country, reason }: { userId: string; country: string | null; reason?: string }) =>
      vvAvailabilityService.setCustomerCountry(userId, { country, ...(reason ? { reason } : {}) }),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['vv-availability'] })
      // The customer feed (/api/crm/customers) carries the account country too.
      qc.invalidateQueries({ queryKey: ['velox-esim', 'customers', userId] })
      qc.invalidateQueries({ queryKey: ['vv-users'] })
    },
  })
}
