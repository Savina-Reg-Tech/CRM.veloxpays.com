import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvEsimService } from '../vvAdminService'

export function useVVEsimOrders(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['vv-esim', 'orders', page, limit],
    queryFn: () => vvEsimService.getOrders(page, limit),
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
