import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvPromoService } from '../vvAdminService'
import type { CreatePromoCodeInput, PromoUsageFilters } from '../types'

export function useVVPromoCodes(status?: string) {
  return useQuery({
    queryKey: ['vv-promo', 'list', status ?? 'all'],
    queryFn: () => vvPromoService.list(status ? { status } : {}),
  })
}

export function useVVPromo(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-promo', 'detail', id],
    queryFn: () => vvPromoService.get(id!),
    enabled: Boolean(id),
  })
}

export function useVVPromoStats(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-promo', 'stats', id],
    queryFn: () => vvPromoService.getStats(id!),
    enabled: Boolean(id),
  })
}

export function useVVPromoUsages(id: string | undefined, filters: PromoUsageFilters) {
  return useQuery({
    queryKey: ['vv-promo', 'usages', id, filters],
    queryFn: () => vvPromoService.getUsages(id!, filters),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
  })
}

export function useVVCreatePromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePromoCodeInput) => vvPromoService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-promo'] })
    },
  })
}

export function useVVUpdatePromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreatePromoCodeInput> }) =>
      vvPromoService.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-promo'] })
    },
  })
}
