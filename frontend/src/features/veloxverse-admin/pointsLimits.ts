import { formatMoney } from '@/lib/utils'

/**
 * Per-order limits on paying with points (Points → Settings → "Limit per order").
 *
 * The CRM only stores and shows these two numbers — VeloxVerse applies them at checkout (the
 * stricter one wins). 0 = no limit for both; whole numbers only; never null or empty.
 */
export type PerOrderLimitKey = 'maxRedeemPointsPerOrder' | 'maxRedeemPercentPerOrder'

export const PER_ORDER_LIMIT_FIELDS: { key: PerOrderLimitKey; label: string; help: string; auditField: string }[] = [
  {
    key: 'maxRedeemPointsPerOrder',
    label: 'Most points per order',
    help: 'The most points a customer can use on one order. 0 = no limit.',
    auditField: 'max_redeem_points_per_order',
  },
  {
    key: 'maxRedeemPercentPerOrder',
    label: 'Most of an order paid with points (%)',
    help: 'Example: 50 = points can pay up to half of the order, the rest is charged to the card. 0 = no limit.',
    auditField: 'max_redeem_percent_per_order',
  },
]

/** VeloxVerse's own upper bound for the points limit (validations/points.validation.ts). */
export const MAX_POINTS_PER_ORDER = 100_000_000

const isWholeNumber = (raw: string) => /^\d+$/.test(raw.trim())

/** A missing value (older VeloxVerse) is "no limit". */
export function limitOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

/** "20,000 pts" / "50%" — or "No limit" for 0. */
export function formatPerOrderLimit(key: PerOrderLimitKey, value: number | null | undefined): string {
  const v = limitOrZero(value)
  if (v === 0) return 'No limit'
  return key === 'maxRedeemPercentPerOrder' ? `${v}%` : `${v.toLocaleString()} pts`
}

/**
 * Form checks, done before anything is sent: whole numbers only; percent 0–100; a points limit
 * above 0 must be at least the minimum to redeem (otherwise no order could ever use points).
 */
export function validatePerOrderLimits(input: {
  points: string
  percent: string
  /** The minimum to redeem that will be in force after this save. */
  minRedeemPoints: number
}): { points?: string; percent?: string } {
  const errors: { points?: string; percent?: string } = {}

  if (!isWholeNumber(input.points)) {
    errors.points = 'Enter a whole number, 0 or more. 0 = no limit.'
  } else {
    const points = Number(input.points)
    if (points > MAX_POINTS_PER_ORDER) {
      errors.points = `Enter ${MAX_POINTS_PER_ORDER.toLocaleString()} or less.`
    } else if (points > 0 && points < input.minRedeemPoints) {
      errors.points = `Must be at least the minimum to redeem (${input.minRedeemPoints.toLocaleString()} pts), or 0 for no limit.`
    }
  }

  if (!isWholeNumber(input.percent) || Number(input.percent) > 100) {
    errors.percent = 'Enter a whole number from 0 to 100. 0 = no limit.'
  }
  return errors
}

/**
 * What a points limit is worth in each currency, from the fixed redemption rates already on the
 * page ("points to redeem 1 unit"): "20,000 pts = INR 2,000.00 · USD 20.00". Display only.
 * Currencies with no rate (redemption switched off) are skipped. Null when there is no limit.
 */
export function perOrderPointsWorth(
  points: number | null | undefined,
  pointsPerUnitRedeem: Record<string, number | null | undefined> | null | undefined,
  currencies: readonly string[]
): string | null {
  const limit = limitOrZero(points)
  if (limit === 0) return null
  const parts = currencies
    .filter((cur) => {
      const rate = pointsPerUnitRedeem?.[cur]
      return typeof rate === 'number' && rate > 0
    })
    .map((cur) => formatMoney(limit / (pointsPerUnitRedeem![cur] as number), cur))
  if (parts.length === 0) return null
  return `${limit.toLocaleString()} pts = ${parts.join(' · ')}`
}

// ── Points audit log ──────────────────────────────────────────────

const AUDIT_FIELD_LABEL: Record<string, string> = Object.fromEntries(PER_ORDER_LIMIT_FIELDS.map((f) => [f.auditField, f.label]))

/** Friendly name for an audit-log field, or null to show the raw field name as before. */
export function pointsAuditFieldLabel(fieldName: string | null | undefined): string | null {
  return fieldName ? AUDIT_FIELD_LABEL[fieldName] ?? null : null
}

/** Old / new value for the audit log — "No limit" for 0 on the two per-order limit fields. */
export function pointsAuditValue(fieldName: string | null | undefined, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (fieldName && AUDIT_FIELD_LABEL[fieldName] && Number(value) === 0) return 'No limit'
  return String(value)
}
