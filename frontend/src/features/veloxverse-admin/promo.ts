import { formatMoney } from '@/lib/utils'
import type { PromoCode, PromoCodeStats } from './types'

// Checkouts a promo code can be applied to (backend: promoCheckout.service.ts). LOUNGE covers every
// VeloxLounge product (Lounge, Dining, Fast Track, Fitness); BENEFIT narrows to Dining/Fast
// Track/Fitness only.
export const SERVICE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All services' },
  { value: 'LOUNGE', label: 'VeloxLounge' },
  { value: 'BENEFIT', label: 'Dining / Fast Track / Fitness' },
  { value: 'ESIM', label: 'eSIM' },
  { value: 'TRANSFER', label: 'VeloxAssist' },
  { value: 'CLUB', label: 'VeloxClub' },
]

/** Services a usage can be reported under — the checkout services plus the report-only ones. */
export const USAGE_SERVICE_OPTIONS: Array<{ value: string; label: string }> = [
  ...SERVICE_OPTIONS.filter((o) => o.value !== 'ALL'),
  { value: 'FLIGHT', label: 'Flights' },
  { value: 'WALLET', label: 'Wallet credit' },
]

export function serviceLabel(value: string): string {
  return USAGE_SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** The promo's base money fields (discount, min purchase, max discount) are USD cents — always
 * shown with an explicit "USD", never a bare "$". */
export function formatUsdCents(cents: number): string {
  return formatMoney(cents / 100, 'USD')
}

/** "20% off, max USD 50.00" / "USD 10.00 off". */
export function discountLabel(p: PromoCode): string {
  if (p.discountType === 'PERCENTAGE') {
    const pct = `${Number((p.discountValue / 100).toFixed(2))}% off`
    return p.maxDiscountCents ? `${pct}, max ${formatUsdCents(p.maxDiscountCents)}` : pct
  }
  return `${formatUsdCents(p.discountValue)} off`
}

export function isPromoExpired(p: PromoCode): boolean {
  return Boolean(p.expiresAt && new Date(p.expiresAt).getTime() < Date.now())
}

/** "INR 12,450.00 · AUD 84.00 saved" — one figure per currency, never summed together. */
export function savingsByCurrencyLabel(stats: PromoCodeStats): string {
  if (stats.byCurrency.length === 0) return 'nothing saved yet'
  return `${stats.byCurrency.map((c) => formatMoney(c.discountCents / 100, c.currency)).join(' · ')} saved`
}
