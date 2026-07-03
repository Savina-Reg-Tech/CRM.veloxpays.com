import { useQuery } from '@tanstack/react-query'
import { vvAnalyticsService } from '../vvAdminService'

export function useVVOverview() {
  return useQuery({
    queryKey: ['vv-analytics', 'overview'],
    queryFn: () => vvAnalyticsService.getOverview(),
  })
}

export function useVVRevenue(period: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'revenue', period],
    queryFn: () => vvAnalyticsService.getRevenue(period),
  })
}

export function useVVGrowth(period: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'growth', period],
    queryFn: () => vvAnalyticsService.getGrowth(period),
  })
}

export function useVVPopularPackages(limit = 10) {
  return useQuery({
    queryKey: ['vv-analytics', 'popular-packages', limit],
    queryFn: () => vvAnalyticsService.getPopularPackages(limit),
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

export function useVVCustomerSpending(limit = 20) {
  return useQuery({
    queryKey: ['vv-analytics', 'customer-spending', limit],
    queryFn: () => vvAnalyticsService.getCustomerSpending(limit),
  })
}
