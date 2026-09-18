import { useQuery } from '@tanstack/react-query'
import { vvAnalyticsService } from '../vvAdminService'

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
