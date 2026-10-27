import { describe, expect, it } from 'vitest'
import { averagePayment, cardChargeParams, honoursWindow } from './cardChargeWindow'

const NOW = new Date(2026, 9, 15, 14, 30)
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()

describe('cardChargeParams', () => {
  it('sends rolling periods as before, and nothing for all time', () => {
    expect(cardChargeParams({ kind: 'period', period: '30d' })).toEqual({ period: '30d' })
    expect(cardChargeParams({ kind: 'period', period: 'all' })).toEqual({})
  })

  it('sends calendar ranges as from / to and never a reversed custom range', () => {
    expect(cardChargeParams({ kind: 'range', range: { preset: 'lastMonth' } }, NOW)).toEqual({
      from: local(2026, 9, 1),
      to: local(2026, 10, 1),
    })
    expect(cardChargeParams({ kind: 'range', range: { preset: 'custom', customFrom: '2026-10-09', customTo: '2026-10-01' } }, NOW)).toEqual({})
  })
})

describe('honoursWindow', () => {
  it('trusts period answers, and range answers only when VeloxVerse echoes the range', () => {
    expect(honoursWindow({ kind: 'period', period: '7d' }, {})).toBe(true)
    expect(honoursWindow({ kind: 'range', range: { preset: 'lastMonth' } }, {})).toBe(false)
    expect(honoursWindow({ kind: 'range', range: { preset: 'lastMonth' } }, { range: { from: 'x', to: 'y' } })).toBe(true)
  })
})

describe('averagePayment', () => {
  it('divides collected by payments, rounded to cents, and is null with no payments', () => {
    expect(averagePayment(100, 3)).toBe(33.33)
    expect(averagePayment(0, 0)).toBeNull()
  })
})
