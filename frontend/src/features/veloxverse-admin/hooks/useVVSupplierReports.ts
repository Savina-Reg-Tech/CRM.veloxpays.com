import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { vvSupplierReportsService } from '../vvAdminService'
import type { ReconRowFilters, ReconSupplier } from '../types'

/** Re-checked every minute while the page is open. */
export function useVVSystemHealth() {
  return useQuery({
    queryKey: ['vv-health'],
    queryFn: () => vvSupplierReportsService.getHealth(),
    refetchInterval: 60_000,
  })
}

export function useVVReconciliation(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['vv-recon', 'summary', range],
    queryFn: () => vvSupplierReportsService.getReconciliation(range),
    placeholderData: keepPreviousData,
  })
}

export function useVVReconciliationRows(supplier: ReconSupplier, page: number, limit: number, filters: ReconRowFilters) {
  return useQuery({
    queryKey: ['vv-recon', 'rows', supplier, page, limit, filters],
    queryFn: () => vvSupplierReportsService.getReconciliationRows(supplier, page, limit, filters),
    placeholderData: keepPreviousData,
  })
}
