import type { PointsLedgerEntry } from './types'

/**
 * Refer & Earn history, rebuilt from a user's own `REFERRAL` ledger rows — VeloxVerse exposes no
 * admin referral-usage endpoint. Awards are positive rows (`metadata.role` + the other side's id in
 * `metadata.refereeId` / `metadata.referrerId`); reversals are negative rows whose
 * `metadata.clawback_of` is the award row id, with `metadata.reason` = `booking_cancelled` or
 * `referee_blocked`. Never matched on idempotency keys (their shape changed per booking).
 *
 * A referral goes COMPLETED → PENDING (booking cancelled) → COMPLETED again, or ends REVOKED
 * (referee blocked). It counts as rewarded only while it has an award row that isn't reversed.
 */

export type ReferralReversalReason = 'booking_cancelled' | 'referee_blocked'

export interface ReferralEvent {
  id: string
  kind: 'award' | 'reversal'
  amount: number
  reason: string | null
  bookingRef: string | null
  createdAt: string
}

export type ReferralThreadStatus = 'REWARDED' | 'REVERSED' | 'REVOKED'

export interface ReferralThread {
  /** The other person in the referral (the referee for a referrer, and vice versa). */
  counterpartyId: string | null
  role: 'referrer' | 'referee' | null
  events: ReferralEvent[]
  status: ReferralThreadStatus
  /** Points from award rows that haven't been reversed. */
  pointsInForce: number
}

export interface ReferralSummary {
  threads: ReferralThread[]
  /** Referrals with at least one award still in force. */
  rewardedCount: number
  pointsInForce: number
}

export function referralReasonLabel(reason: string | null | undefined): string {
  if (reason === 'booking_cancelled') return 'Reversed: booking cancelled'
  if (reason === 'referee_blocked') return 'Clawed back: account blocked'
  return 'Reversed'
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function roleOf(meta: Record<string, unknown>): 'referrer' | 'referee' | null {
  if (meta.role === 'referrer' || meta.role === 'referee') return meta.role
  if (str(meta.refereeId)) return 'referrer'
  if (str(meta.referrerId)) return 'referee'
  return null
}

function counterpartyOf(meta: Record<string, unknown>): string | null {
  return roleOf(meta) === 'referee' ? str(meta.referrerId) : str(meta.refereeId) ?? str(meta.referrerId)
}

export function buildReferralSummary(entries: PointsLedgerEntry[]): ReferralSummary {
  const rows = entries
    .filter((e) => e.type === 'REFERRAL')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const threads = new Map<string, ReferralThread>()
  const threadOfAward = new Map<string, ReferralThread>()
  const reversedAwardIds = new Set<string>()

  const threadFor = (key: string, counterpartyId: string | null, role: ReferralThread['role']) => {
    let t = threads.get(key)
    if (!t) {
      t = { counterpartyId, role, events: [], status: 'REWARDED', pointsInForce: 0 }
      threads.set(key, t)
    }
    return t
  }

  for (const row of rows) {
    const meta = row.metadata ?? {}
    const clawbackOf = str(meta.clawback_of)
    if (row.amount < 0 || clawbackOf) {
      // Reversal: file it under the award it reverses; fall back to its own (copied) metadata.
      const byAward = clawbackOf ? threadOfAward.get(clawbackOf) : undefined
      const cp = counterpartyOf(meta)
      const thread = byAward ?? threadFor(cp ?? `unknown:${row.id}`, cp, roleOf(meta))
      if (clawbackOf) reversedAwardIds.add(clawbackOf)
      thread.events.push({
        id: row.id, kind: 'reversal', amount: row.amount, reason: str(meta.reason),
        bookingRef: row.referenceId, createdAt: row.createdAt,
      })
      continue
    }
    const cp = counterpartyOf(meta)
    const thread = threadFor(cp ?? `unknown:${row.referenceId ?? row.id}`, cp, roleOf(meta))
    threadOfAward.set(row.id, thread)
    thread.events.push({
      id: row.id, kind: 'award', amount: row.amount, reason: null,
      bookingRef: row.referenceId, createdAt: row.createdAt,
    })
  }

  for (const t of threads.values()) {
    const awards = t.events.filter((e) => e.kind === 'award')
    t.pointsInForce = awards.filter((a) => !reversedAwardIds.has(a.id)).reduce((s, a) => s + a.amount, 0)
    const lastReversal = [...t.events].reverse().find((e) => e.kind === 'reversal')
    t.status = awards.some((a) => !reversedAwardIds.has(a.id))
      ? 'REWARDED'
      : lastReversal?.reason === 'referee_blocked' ? 'REVOKED' : 'REVERSED'
  }

  const list = [...threads.values()].sort((a, b) =>
    (b.events.at(-1)?.createdAt ?? '').localeCompare(a.events.at(-1)?.createdAt ?? '')
  )
  return {
    threads: list,
    rewardedCount: list.filter((t) => t.status === 'REWARDED').length,
    pointsInForce: list.reduce((s, t) => s + t.pointsInForce, 0),
  }
}
