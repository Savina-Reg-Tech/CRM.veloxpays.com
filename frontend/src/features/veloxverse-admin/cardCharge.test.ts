import { describe, expect, it } from 'vitest'
import { buildVeloxVerseActivity } from '@/features/customers/utils/veloxverseActivity'
import { cardChargeForPayment, cardChargesByOrderNo, ownCardCharge } from './utils'
import type { AdminBillingLineItem, ClubMembershipDetail, RecentActivity, VVAdminUserDetail } from './types'

// VeloxVerse's ledger keys a purchase row by the payment id — both `id` and `orderNo`.
function line(over: Partial<AdminBillingLineItem>): AdminBillingLineItem {
  return {
    id: 'pay-1',
    date: '2026-10-12T10:00:00.000Z',
    orderNo: 'pay-1',
    invoiceNo: 'INV-1',
    description: 'VeloxClub Gold',
    service: 'CLUB',
    type: 'CLUB_MEMBERSHIP',
    amountUsd: 57.44,
    currency: 'INR',
    direction: 'debit',
    paymentMethod: 'card',
    status: 'COMPLETED',
    cardChargeCents: 86,
    cardChargeCurrency: 'AUD',
    ...over,
  }
}

function recent(over: Partial<RecentActivity>): RecentActivity {
  return {
    orderNo: 'ORD-1',
    type: 'ESIM',
    description: 'Japan 5GB',
    amountUsd: 57.44,
    currency: 'INR',
    status: 'COMPLETED',
    createdAt: '2026-10-12T10:00:00.000Z',
    customer: null,
    cardChargeAmount: 0.86,
    cardChargeCurrency: 'AUD',
    ...over,
  }
}

describe('ownCardCharge', () => {
  it('reads the row field, keeping null as null and absent as unknown', () => {
    expect(ownCardCharge({ cardChargeCents: 86, cardChargeCurrency: 'AUD' })).toEqual({ amount: 0.86, currency: 'AUD' })
    expect(ownCardCharge({ cardChargeCents: null, cardChargeCurrency: null })).toEqual({ amount: null, currency: null })
    expect(ownCardCharge({})).toBeUndefined()
  })
})

describe('cardChargeForPayment', () => {
  it('finds the AUD charge by payment id', () => {
    expect(cardChargeForPayment([line({})], 'pay-1')).toEqual({ amount: 0.86, currency: 'AUD' })
  })

  it('is unknown when nothing matches or VeloxVerse did not send the field', () => {
    expect(cardChargeForPayment([line({})], 'pay-9')).toBeUndefined()
    expect(cardChargeForPayment([line({ cardChargeCents: undefined })], 'pay-1')).toBeUndefined()
    expect(cardChargeForPayment(undefined, 'pay-1')).toBeUndefined()
    expect(cardChargeForPayment([line({})], null)).toBeUndefined()
  })

  it('never uses a refund row for the charge', () => {
    expect(cardChargeForPayment([line({ type: 'REFUND', direction: 'credit' })], 'pay-1')).toBeUndefined()
  })
})

describe('cardChargesByOrderNo', () => {
  it('maps order numbers to their AUD charge, keeping null and skipping refunds / old payloads', () => {
    const map = cardChargesByOrderNo([
      recent({}),
      recent({ orderNo: 'ORD-2', cardChargeAmount: null, cardChargeCurrency: null }),
      recent({ orderNo: 'REFUND-abc', type: 'REFUND' }),
      recent({ orderNo: 'ORD-3', cardChargeAmount: undefined, cardChargeCurrency: undefined }),
    ])
    expect(map.get('ORD-1')).toEqual({ amount: 0.86, currency: 'AUD' })
    expect(map.get('ORD-2')).toEqual({ amount: null, currency: null })
    expect(map.has('REFUND-abc')).toBe(false)
    expect(map.has('ORD-3')).toBe(false)
  })
})

describe('buildVeloxVerseActivity', () => {
  const detail = {
    orders: [{ orderNo: 'ORD-1', packageName: 'Japan 5GB', status: 'COMPLETED', priceUsd: 57.44, currency: 'INR' }],
  } as unknown as VVAdminUserDetail
  const byOrderNo = cardChargesByOrderNo([recent({})])

  it('carries the AUD card charge onto an eSIM timeline row', () => {
    const [item] = buildVeloxVerseActivity({ detail, transfers: [], tickets: [], cardChargeByOrderNo: (no) => (no ? byOrderNo.get(no) : undefined) })
    expect(item).toMatchObject({ amountUsd: 57.44, currency: 'INR', cardChargeAmount: 0.86, cardChargeCurrency: 'AUD' })
  })

  it('joins a VeloxClub membership to its ledger payment', () => {
    const membership = {
      id: 'm1', tier: 'Gold', status: 'ACTIVE', billingCycleEnd: '2027-10-12', purchasedAt: '2026-10-12',
      purchasePriceCents: 5744, currency: 'INR', paymentReferenceId: 'pay-1',
    } as unknown as ClubMembershipDetail
    const [item] = buildVeloxVerseActivity({ detail: undefined, transfers: [], tickets: [], clubMemberships: [membership], billingItems: [line({})] })
    expect(item).toMatchObject({ kind: 'CLUB', cardChargeAmount: 0.86, cardChargeCurrency: 'AUD' })
  })

  it('leaves the row without a card charge when it is not known', () => {
    const [item] = buildVeloxVerseActivity({ detail, transfers: [], tickets: [] })
    expect(item.cardChargeAmount).toBeUndefined()
  })
})
