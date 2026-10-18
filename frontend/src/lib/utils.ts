import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Date-only renderer for table cells and timeline summaries.
 * Example: `May 14, 2026`.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Date + time renderer for audit lines ("Created … Modified …").
 * Example: `May 14, 2026, 2:38 PM`.
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Format a decimal money amount with its real currency — never a hardcoded `$`. Used for
 * Velox eSIM purchase/customer amounts, which are charged (and reported) in whatever currency
 * the customer actually paid in, not always USD.
 * Example: `formatMoney(57.54, 'INR')` -> "INR 57.54" (falls back gracefully if `currency`
 * isn't a valid ISO 4217 code `Intl` recognizes).
 */
export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
    }).format(value)
  } catch {
    return `${code} ${value.toFixed(2)}`
  }
}

export type CardChargeKind = 'charged' | 'refunded'

export const CARD_CHARGE_TOOLTIP =
  "Payments are processed in AUD. The customer's bank may apply its own exchange rate and fees."
export const NO_CARD_CHARGE_TOOLTIP =
  'No card charge (paid with credit / points / VeloxClub benefit, or made before AUD charging)'

/**
 * Second line under a VeloxVerse customer amount: what Mint really moved on the card, e.g.
 * "AUD 0.86 charged" (or "… refunded" on a refund row). The amount is VeloxVerse's own figure,
 * locked at checkout — it is never derived from the customer amount here.
 *
 * Returns null — i.e. show the customer amount alone — when there is no card charge (`null` means
 * "no AUD amount", not zero) or when the customer's currency is already the card currency, where
 * the second line would only repeat the first.
 */
export function cardChargeLabel(
  customerCurrency: string | null | undefined,
  cardChargeAmount: number | null | undefined,
  cardChargeCurrency: string | null | undefined,
  kind: CardChargeKind = 'charged'
): string | null {
  if (typeof cardChargeAmount !== 'number' || !Number.isFinite(cardChargeAmount) || !cardChargeCurrency) return null
  if ((customerCurrency ?? '').toUpperCase() === cardChargeCurrency.toUpperCase()) return null
  return `${formatMoney(cardChargeAmount, cardChargeCurrency)} ${kind}`
}

/** Integer cents → major units, keeping `null`/absent as `null` (never 0). */
export function centsToMajorOrNull(cents: number | null | undefined): number | null {
  return typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : null
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** A named zone like "IST" where the platform has one; en-GB alone gives "GMT+5:30" for India. */
export function zoneAbbr(d: Date): string {
  let fallback = ''
  for (const locale of ['en-GB', 'en-IN', 'en-US']) {
    const name = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value
    if (!name) continue
    if (!/^(GMT|UTC)[+-]/.test(name)) return name
    fallback ||= name
  }
  return fallback
}
