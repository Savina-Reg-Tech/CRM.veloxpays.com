import { describe, expect, it } from 'vitest'
import { billingParams, centsMoney, orderLink, outcomeVariant, paymentStatusLabel, serviceLabel } from './billingReports'

describe('billing report helpers', () => {
  it('labels services, statuses and outcomes', () => {
    expect(serviceLabel('TRANSFER')).toBe('Pick & Drop')
    expect(serviceLabel('NEW_THING')).toBe('New thing')
    expect(paymentStatusLabel('FULFILLMENT_FAILED')).toBe('Fulfillment failed')
    expect(outcomeVariant('paid')).toBe('success')
    expect(outcomeVariant(null)).toBe('neutral')
  })

  it('formats cents and shows a dash for no amount', () => {
    expect(centsMoney(null, 'AUD')).toBe('—')
    expect(centsMoney(1250, 'AUD')).toContain('12.50')
  })

  it('links each service to its CRM page, and nothing when no booking exists', () => {
    expect(orderLink({ service: 'ESIM_TOPUP', orderNo: 'ESIM-1', visitId: null })).toBe('/dashboard/veloxverse/esim-orders/ESIM-1')
    expect(orderLink({ service: 'LOUNGE_VISIT', orderNo: 'LNG-1', visitId: 'v 1' })).toBe('/dashboard/veloxverse/lounge-bookings/v%201')
    expect(orderLink({ service: 'LOUNGE_VISIT', orderNo: null, visitId: null })).toBeNull()
    expect(orderLink({ service: 'TRANSFER', orderNo: 'TRF-1', visitId: null })).toBe('/dashboard/veloxverse/transfers?orderNo=TRF-1')
    expect(orderLink({ service: 'CLUB_MEMBERSHIP', orderNo: 'CLB-1', visitId: null })).toBeNull()
  })

  it('sends only the filters that are set, booleans as text', () => {
    expect(billingParams({ search: '', outcome: 'paid', refunded: false, from: undefined })).toEqual({ outcome: 'paid', refunded: 'false' })
    expect(billingParams({ stuck: true, initiatedBy: 'unknown' })).toEqual({ stuck: 'true', initiatedBy: 'unknown' })
  })
})
