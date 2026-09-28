import { describe, it, expect } from 'vitest'
import { pointsValueLabel, referralsToCsv, valueAtRate } from './referral'
import type { ReferralRow } from './types'

const row: ReferralRow = {
  id: 'r1',
  createdAt: '2026-09-28T10:00:00.000Z',
  completedAt: '2026-09-28T11:00:00.000Z',
  lastActivityAt: '2026-09-28T11:00:00.000Z',
  code: 'PRIYA42',
  status: 'COMPLETED',
  displayStatus: 'REWARDED',
  reversalCount: 2,
  referrer: { id: 'a', name: 'Priya Sharma', email: 'priya@example.test', isActive: true, currency: 'INR', pointsInForce: 500, value: { cents: 5000, currency: 'INR' } },
  referee: { id: 'b', name: 'Liam Walker', email: 'liam@example.test', isActive: true, currency: 'AUD', pointsInForce: 250, value: null },
}

describe('referral helpers', () => {
  it('values points at the rate of their own currency, and not at all without a rate', () => {
    expect(valueAtRate(500, 'INR', 10)).toEqual({ cents: 5000, currency: 'INR' })
    expect(valueAtRate(500, 'AUD', null)).toBeNull()
    expect(pointsValueLabel({ cents: 5000, currency: 'INR' })).toMatch(/^≈ INR\s50\.00$/)
    expect(pointsValueLabel(null)).toBeNull()
  })

  it('keeps each side of a mixed-currency referral in its own currency in the CSV', () => {
    const [header, line] = referralsToCsv([row]).split('\n')
    const cols = header.split(',').map((c) => c.replace(/"/g, ''))
    const cells = line.split(',').map((c) => c.replace(/"/g, ''))
    const at = (name: string) => cells[cols.indexOf(name)]
    expect(at('Referrer currency')).toBe('INR')
    expect(at('Referrer points')).toBe('500')
    expect(at('Referrer value')).toBe('50.00')
    expect(at('Referee currency')).toBe('AUD')
    expect(at('Referee points')).toBe('250')
    expect(at('Referee value')).toBe('')
    expect(line).not.toContain('$')
  })
})
