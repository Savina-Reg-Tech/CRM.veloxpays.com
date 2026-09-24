import { describe, it, expect } from 'vitest'
import { buildReferralSummary, referralReasonLabel } from './referralHistory'
import type { PointsLedgerEntry } from './types'

let n = 0
function row(amount: number, metadata: Record<string, unknown>, extra: Partial<PointsLedgerEntry> = {}): PointsLedgerEntry {
  n += 1
  return {
    id: `row-${n}`,
    amount,
    type: 'REFERRAL',
    serviceType: 'REFERRAL',
    referenceId: null,
    description: null,
    balanceAfter: 0,
    metadata,
    createdAt: `2026-09-${String(10 + n).padStart(2, '0')}T00:00:00Z`,
    ...extra,
  }
}

describe('buildReferralSummary', () => {
  it('counts an award that has not been reversed as rewarded', () => {
    const award = row(500, { role: 'referrer', refereeId: 'B' }, { referenceId: 'bk1' })
    const s = buildReferralSummary([award])
    expect(s.rewardedCount).toBe(1)
    expect(s.pointsInForce).toBe(500)
    expect(s.threads[0]).toMatchObject({ counterpartyId: 'B', role: 'referrer', status: 'REWARDED' })
  })

  it('goes back to reversed after a cancelled booking, then rewarded again on the next booking', () => {
    const a1 = row(500, { role: 'referrer', refereeId: 'B' }, { referenceId: 'bk1' })
    const r1 = row(-500, { clawback_of: a1.id, reason: 'booking_cancelled', role: 'referrer', refereeId: 'B' })
    let s = buildReferralSummary([a1, r1])
    expect(s.threads[0].status).toBe('REVERSED')
    expect(s.rewardedCount).toBe(0)
    expect(s.pointsInForce).toBe(0)

    const a2 = row(600, { role: 'referrer', refereeId: 'B' }, { referenceId: 'bk2' })
    s = buildReferralSummary([a1, r1, a2])
    expect(s.threads).toHaveLength(1)
    expect(s.threads[0].events.map((e) => e.kind)).toEqual(['award', 'reversal', 'award'])
    expect(s.threads[0].status).toBe('REWARDED')
    expect(s.pointsInForce).toBe(600)
  })

  it('marks a blocked referee as revoked', () => {
    const a1 = row(500, { role: 'referrer', refereeId: 'B' })
    const r1 = row(-500, { clawback_of: a1.id, reason: 'referee_blocked' })
    const s = buildReferralSummary([a1, r1])
    expect(s.threads[0].status).toBe('REVOKED')
    expect(s.rewardedCount).toBe(0)
  })

  it('does not count REFERRAL rows alone — only un-reversed awards, per referee', () => {
    const toB = row(500, { role: 'referrer', refereeId: 'B' })
    const toC = row(500, { role: 'referrer', refereeId: 'C' })
    const revC = row(-500, { clawback_of: toC.id, reason: 'booking_cancelled' })
    const s = buildReferralSummary([toB, toC, revC])
    expect(s.threads).toHaveLength(2)
    expect(s.rewardedCount).toBe(1)
    expect(s.pointsInForce).toBe(500)
  })

  it('groups a referee welcome bonus by the referrer and ignores non-referral rows', () => {
    const bonus = row(200, { role: 'referee', referrerId: 'A' })
    const earn = row(50, {}, { type: 'EARN' })
    const s = buildReferralSummary([bonus, earn])
    expect(s.threads).toHaveLength(1)
    expect(s.threads[0]).toMatchObject({ counterpartyId: 'A', role: 'referee', status: 'REWARDED' })
  })
})

describe('referralReasonLabel', () => {
  it('labels each reason', () => {
    expect(referralReasonLabel('booking_cancelled')).toBe('Reversed: booking cancelled')
    expect(referralReasonLabel('referee_blocked')).toBe('Clawed back: account blocked')
    expect(referralReasonLabel(undefined)).toBe('Reversed')
  })
})
