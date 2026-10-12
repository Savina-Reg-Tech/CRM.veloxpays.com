import { useCallback, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { vvAnalyticsService } from '../vvAdminService'
import type { CardChargePeriod } from '../types'
import { cardChargesByOrderNo, type CardCharge } from '../utils'

export function useVVOverview(currency?: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'overview', currency],
    queryFn: () => vvAnalyticsService.getOverview(currency),
  })
}

export function useVVRevenue(period: string, currency?: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'revenue', period, currency],
    queryFn: () => vvAnalyticsService.getRevenue(period, currency),
  })
}

export function useVVGrowth(period: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'growth', period],
    queryFn: () => vvAnalyticsService.getGrowth(period),
  })
}

export function useVVPopularPackages(limit = 10, currency?: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'popular-packages', limit, currency],
    queryFn: () => vvAnalyticsService.getPopularPackages(limit, currency),
  })
}

export function useVVRecentOrders(limit = 10) {
  return useQuery({
    queryKey: ['vv-analytics', 'recent-orders', limit],
    queryFn: () => vvAnalyticsService.getRecentOrders(limit),
  })
}

export function useVVOrderStats() {
  return useQuery({
    queryKey: ['vv-analytics', 'order-stats'],
    queryFn: () => vvAnalyticsService.getOrderStats(),
  })
}

export function useVVCustomerSpending(limit = 20, currency?: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'customer-spending', limit, currency],
    queryFn: () => vvAnalyticsService.getCustomerSpending(limit, currency),
  })
}

export function useVVCardCharges(period: CardChargePeriod = '30d') {
  return useQuery({
    queryKey: ['vv-analytics', 'card-charges', period],
    queryFn: () => vvAnalyticsService.getCardCharges(period),
    // Keep the previous period's cards on screen while the next tab loads.
    placeholderData: keepPreviousData,
  })
}

/**
 * Resolver for "what did the card really pay for this order?" on the admin lists that don't carry
 * the AUD charge on their own rows (eSIM orders, Pick & Drop, lounge). Prefers the row's own
 * field when VeloxVerse sends one, else looks the order number up in the recent-orders feed (one
 * request, shared by every page). Returns `undefined` when unknown — show the customer amount alone.
 */
export function useCardChargeByOrderNo() {
  const { data } = useQuery({
    queryKey: ['vv-analytics', 'recent-orders', 100],
    queryFn: () => vvAnalyticsService.getRecentOrders(100),
    staleTime: 60_000,
  })
  const byOrderNo = useMemo(() => cardChargesByOrderNo(data), [data])
  return useCallback(
    (orderNo: string | null | undefined, own?: CardCharge): CardCharge | undefined =>
      own ?? (orderNo ? byOrderNo.get(orderNo) : undefined),
    [byOrderNo]
  )
}
