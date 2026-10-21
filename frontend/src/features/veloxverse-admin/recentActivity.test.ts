import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/axios', () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn() } }))

import { vvAnalyticsService } from './vvAdminService'
import { activityTypeBadgeClass, activityTypeLabel, cardChargesByOrderNo } from './utils'
import type { RecentActivity } from './types'

function envelope(data: unknown) {
  return { data: { success: true, message: 'ok', data } }
}

describe('activityTypeLabel / activityTypeBadgeClass', () => {
  it('labels the eSIM top-up and VeloxClub rows', () => {
    expect(activityTypeLabel('ESIM_TOPUP')).toBe('ESIM TOP-UP')
    expect(activityTypeLabel('CLUB')).toBe('VELOXCLUB')
  })

  it('shows a type it does not know as sent, in a neutral badge', () => {
    expect(activityTypeLabel('FLIGHT')).toBe('FLIGHT')
    expect(activityTypeBadgeClass('FLIGHT')).toContain('gray')
    // Not fooled by Object.prototype keys.
    expect(activityTypeLabel('toString')).toBe('toString')
  })
})

describe('vvAnalyticsService.getRecentOrdersPage', () => {
  beforeEach(() => get.mockReset())

  it('asks for the first page without `before`, then passes nextBefore back verbatim', async () => {
    get.mockResolvedValueOnce(envelope({ orders: [], nextBefore: '2026-10-18T09:15:00.123Z' }))
    const first = await vvAnalyticsService.getRecentOrdersPage(50)
    expect(get).toHaveBeenLastCalledWith('/vv-admin/admin/analytics/recent-orders', { params: { limit: 50 } })
    expect(first.nextBefore).toBe('2026-10-18T09:15:00.123Z')

    get.mockResolvedValueOnce(envelope({ orders: [], nextBefore: null }))
    const second = await vvAnalyticsService.getRecentOrdersPage(50, first.nextBefore!)
    expect(get).toHaveBeenLastCalledWith('/vv-admin/admin/analytics/recent-orders', {
      params: { limit: 50, before: '2026-10-18T09:15:00.123Z' },
    })
    expect(second.nextBefore).toBeNull()
  })

  it('treats an older VeloxVerse with no nextBefore as the end', async () => {
    get.mockResolvedValueOnce(envelope({ orders: [] }))
    expect((await vvAnalyticsService.getRecentOrdersPage()).nextBefore).toBeNull()
  })
})

describe('cardChargesByOrderNo with top-ups and memberships', () => {
  it('keys TOPUP- and CLUB- rows by their own order number', () => {
    const row = (over: Partial<RecentActivity>): RecentActivity => ({
      orderNo: 'TOPUP-1', type: 'ESIM_TOPUP', description: 'eSIM top-up — Japan 5GB', amountUsd: 10,
      currency: 'USD', direction: 'credit', status: 'COMPLETED', createdAt: '2026-10-19T00:00:00.000Z',
      customer: null, cardChargeAmount: 15.2, cardChargeCurrency: 'AUD', ...over,
    })
    const map = cardChargesByOrderNo([row({}), row({ orderNo: 'CLUB-1', type: 'CLUB', cardChargeAmount: 99 })])
    expect(map.get('TOPUP-1')).toEqual({ amount: 15.2, currency: 'AUD' })
    expect(map.get('CLUB-1')).toEqual({ amount: 99, currency: 'AUD' })
  })
})
