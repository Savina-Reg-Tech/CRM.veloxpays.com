import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvPricingService } from '../vvAdminService'
import type { PricingRule } from '../types'

export function useVVPricingRules(status?: string) {
  return useQuery({
    queryKey: ['vv-pricing', 'list', status ?? 'all'],
    queryFn: () => vvPricingService.list(status),
  })
}

export function useVVPricingRule(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-pricing', 'detail', id],
    queryFn: () => vvPricingService.get(id!),
    enabled: !!id,
  })
}

export function useVVGlobalAudit(limit = 20) {
  return useQuery({
    queryKey: ['vv-pricing', 'global-audit', limit],
    queryFn: () => vvPricingService.globalAudit(limit),
  })
}

export function useVVCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rule: Partial<PricingRule> & { changeReason?: string }) => vvPricingService.create(rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}

export function useVVUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Partial<PricingRule> & { changeReason?: string } }) =>
      vvPricingService.update(id, rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}

export function useVVPublishRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vvPricingService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}

export function useVVArchiveRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vvPricingService.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}

export function useVVDuplicateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vvPricingService.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}

export function useVVDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changeReason }: { id: string; changeReason: string }) =>
      vvPricingService.remove(id, changeReason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-pricing'] }),
  })
}
