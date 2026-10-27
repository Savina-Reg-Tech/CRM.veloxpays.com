import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvEsimService, type EsimOrderFilters } from '../vvAdminService'

export function useVVEsimOrders(page = 1, limit = 20, filters: EsimOrderFilters = {}) {
  return useQuery({
    queryKey: ['vv-esim', 'orders', page, limit, filters.search ?? '', filters.status ?? '', filters.from ?? '', filters.to ?? ''],
    queryFn: () => vvEsimService.getOrders(page, limit, filters),
    placeholderData: (prev) => prev,
  })
}

export function useVVEsimDetail(orderNo: string | undefined) {
  return useQuery({
    queryKey: ['vv-esim', 'detail', orderNo],
    queryFn: () => vvEsimService.getOrderDetail(orderNo!),
    enabled: !!orderNo,
  })
}

export function useVVCancelEsim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderNo: string) => vvEsimService.cancelEsim(orderNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-esim'] })
    },
  })
}

export function useVVSuspendEsim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderNo: string) => vvEsimService.suspendEsim(orderNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-esim'] })
    },
  })
}

export function useVVUnsuspendEsim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderNo: string) => vvEsimService.unsuspendEsim(orderNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-esim'] })
    },
  })
}
