import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { vvBillingReportsService } from '../vvAdminService'
import type { BillingPaymentFilters, BillingRefundFilters } from '../types'

export function useVVBillingPayments(page = 1, limit = 20, filters: BillingPaymentFilters = {}) {
  return useQuery({
    queryKey: ['vv-billing', 'payments', page, limit, filters],
    queryFn: () => vvBillingReportsService.listPayments(page, limit, filters),
    placeholderData: keepPreviousData,
  })
}

export function useVVBillingPayment(id: string | null) {
  return useQuery({
    queryKey: ['vv-billing', 'payment', id],
    queryFn: () => vvBillingReportsService.getPayment(id!),
    enabled: !!id,
  })
}

export function useVVBillingRefunds(page = 1, limit = 20, filters: BillingRefundFilters = {}) {
  return useQuery({
    queryKey: ['vv-billing', 'refunds', page, limit, filters],
    queryFn: () => vvBillingReportsService.listRefunds(page, limit, filters),
    placeholderData: keepPreviousData,
  })
}
