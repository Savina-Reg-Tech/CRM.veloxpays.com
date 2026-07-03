import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvPromoService } from '../vvAdminService'
import type { CreatePromoCodeInput } from '../types'

export function useVVPromoCodes(status?: string) {
  return useQuery({
    queryKey: ['vv-promo', 'list', status ?? 'all'],
    queryFn: () => vvPromoService.list(status ? { status } : {}),
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
