import { isReversedRange, rangeParams, type ReportRange } from './reportRange'
import type { CardChargePeriod, CardCharges } from './types'

/**
 * Which window the "Card money collected (AUD)" panel shows: a rolling `period` VeloxVerse has
 * always supported, or a calendar range (This month, Last month, custom days) sent as `from` / `to`.
 */
export type CardChargeWindow = { kind: 'period'; period: CardChargePeriod } | { kind: 'range'; range: ReportRange }

/** Query params for GET /admin/analytics/card-charges ('all' sends nothing). */
export function cardChargeParams(window: CardChargeWindow, now = new Date()): Record<string, string> {
  if (window.kind === 'period') return window.period === 'all' ? {} : { period: window.period }
  return isReversedRange(window.range) ? {} : rangeParams(window.range, now)
}

/**
 * False when a calendar range was asked for but the answer has no `range` echo — a VeloxVerse
 * without date-range support ignored `from` / `to` and returned all-time totals, which must not be
 * shown under a "Last month" label.
 */
export function honoursWindow(window: CardChargeWindow, data: Pick<CardCharges, 'range'>): boolean {
  return window.kind === 'period' || data.range !== undefined
}

/** Average card payment (collected ÷ payments); null with no payments. */
export function averagePayment(charged: number, paymentCount: number): number | null {
  return paymentCount > 0 ? Math.round((charged / paymentCount) * 100) / 100 : null
}
