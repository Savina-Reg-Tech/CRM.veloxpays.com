import { describe, expect, it } from 'vitest'
import { HEALTH_DOT, currencyList, issueVariant, reconOrderLink, reconRangeParams } from './supplierReports'

describe('supplier report helpers', () => {
  it('never shows "not used recently" as green', () => {
    expect(HEALTH_DOT.idle).not.toBe(HEALTH_DOT.ok)
    expect(HEALTH_DOT.idle).toContain('gray')
  })

  it('lists amounts per currency without adding them', () => {
    expect(currencyList([])).toBe('—')
    expect(currencyList(null)).toBe('—')
    const text = currencyList([
      { currency: 'AUD', cents: 19356 },
      { currency: 'INR', cents: 5475316 },
    ])
    expect(text).toContain('193.56')
    expect(text).toContain(' + ')
  })

  it('sends a real start date for "All time" (VeloxVerse would otherwise use 30 days)', () => {
    expect(reconRangeParams({ preset: 'all' })).toEqual({ from: '2020-01-01T00:00:00.000Z' })
    const now = new Date(2026, 9, 15, 12)
    expect(reconRangeParams({ preset: 'today' }, now)).toEqual({
      from: new Date(2026, 9, 15).toISOString(),
      to: new Date(2026, 9, 16).toISOString(),
    })
  })

  it('links rows to the right CRM page per supplier', () => {
    expect(reconOrderLink('esimaccess', { service: 'ESIM_ORDER', orderNo: 'E1', visitId: null })).toBe('/dashboard/veloxverse/esim-orders/E1')
    expect(reconOrderLink('dragonpass', { service: 'FAST_TRACK', orderNo: 'L1', visitId: 'v1' })).toBe('/dashboard/veloxverse/lounge-bookings/v1')
    expect(reconOrderLink('viatovia', { service: 'TRANSFER', orderNo: 'T1', visitId: null })).toBe('/dashboard/veloxverse/transfers?orderNo=T1')
    expect(reconOrderLink('mint', { service: 'CLUB_MEMBERSHIP', orderNo: 'C1', visitId: null })).toBeNull()
    expect(reconOrderLink('mint', { service: 'SOMETHING_NEW', orderNo: 'X', visitId: null })).toBeNull()
    expect(issueVariant('mismatch')).toBe('danger')
  })
})
