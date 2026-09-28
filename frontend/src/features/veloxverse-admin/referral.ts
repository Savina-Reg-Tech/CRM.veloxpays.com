import type { BadgeVariant } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/utils'
import type { PointsValue, ReferralDisplayStatus, ReferralRow } from './types'
import { csvAmount, toCsv } from './csv'

export const REFERRAL_STATUS: Record<ReferralDisplayStatus, { label: string; variant: BadgeVariant; help: string }> = {
  PENDING: { label: 'Pending', variant: 'warning', help: 'Code applied — waiting for the first card-paid booking.' },
  REWARDED: { label: 'Rewarded', variant: 'success', help: 'Both sides have been awarded their points.' },
  REVERSED: {
    label: 'Reversed',
    variant: 'danger',
    help: 'The qualifying booking was cancelled, so the points were reversed. A new card-paid booking re-awards them.',
  },
  REVOKED: { label: 'Revoked', variant: 'danger', help: "The referred account was blocked — the referrer's reward was clawed back." },
  EXPIRED: { label: 'Expired', variant: 'neutral', help: 'The referral expired before it qualified.' },
}

export const REFERRAL_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'rewarded', label: 'Rewarded' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
]

export function formatPoints(points: number): string {
  return `${(points ?? 0).toLocaleString()} pts`
}

/** "≈ INR 50.00" in the points' own currency, or null when that currency can't be redeemed. */
export function pointsValueLabel(value: PointsValue | null): string | null {
  return value ? `≈ ${formatMoney(value.cents / 100, value.currency)}` : null
}

/** Points → value at a "points per 1 unit" redemption rate (client-side, for the config editor). */
export function valueAtRate(points: number, currency: string, rate: number | null | undefined): PointsValue | null {
  if (!rate || rate <= 0) return null
  return { cents: Math.round((points * 100) / rate), currency }
}

export function reversalReasonLabel(reason: string | null): string {
  if (reason === 'booking_cancelled') return 'Qualifying booking was cancelled'
  if (reason === 'referee_blocked') return 'Referred account was blocked'
  return 'Reversed'
}

export function personLabel(p: { name: string | null; email: string }): string {
  return p.name ?? p.email ?? 'Unknown'
}

/** CSV of referral rows — each side's points and value stay in that side's own currency column. */
export function referralsToCsv(rows: ReferralRow[]): string {
  return toCsv(
    [
      'Date', 'Code', 'Status', 'Referrer name', 'Referrer email', 'Referrer currency', 'Referrer points',
      'Referrer value', 'Referee name', 'Referee email', 'Referee currency', 'Referee points', 'Referee value',
      'Reversals', 'Rewarded at',
    ],
    rows.map((r) => [
      r.createdAt,
      r.code ?? '',
      REFERRAL_STATUS[r.displayStatus]?.label ?? r.displayStatus,
      r.referrer.name ?? '',
      r.referrer.email,
      r.referrer.currency,
      r.referrer.pointsInForce,
      r.referrer.value ? csvAmount(r.referrer.value.cents) : '',
      r.referee.name ?? '',
      r.referee.email,
      r.referee.currency,
      r.referee.pointsInForce,
      r.referee.value ? csvAmount(r.referee.value.cents) : '',
      r.reversalCount,
      r.completedAt ?? '',
    ])
  )
}
