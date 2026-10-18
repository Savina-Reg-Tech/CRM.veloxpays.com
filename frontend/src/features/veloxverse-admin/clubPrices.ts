/**
 * VeloxClub "Prices by country" — display rules for components/ClubPricesPanel.tsx. VeloxVerse
 * sends every amount (today's AUD value, drift); these only decide what to show.
 */
import { formatCentsIn } from './loungeUtils'
import type { ClubPriceCountry, ClubPriceListTier, ClubPriceLists } from './types'

/** Countries that can get a new price list: not the home currency, a currency VeloxVerse accepts,
 * and no list for that currency yet. Sorted by name. */
export function addableCountries(lists: ClubPriceLists): ClubPriceCountry[] {
  const allowed = new Set(lists.currencies)
  const taken = new Set(lists.priceLists.map((l) => l.currency))
  return lists.countries
    .filter((c) => c.currency !== lists.homeCurrency && allowed.has(c.currency) && !taken.has(c.currency))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** "France, Germany and 8 more share EUR — they will use this price list too." Null when no other
 * country uses the picked country's currency. */
export function sharedCurrencyNote(picked: ClubPriceCountry, countries: ClubPriceCountry[]): string | null {
  const others = countries.filter((c) => c.currency === picked.currency && c.code !== picked.code).map((c) => c.name)
  if (others.length === 0) return null
  const names = [picked.name, ...others]
  const who = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}, ${names[1]} and ${names.length - 2} more`
  return `${who} share ${picked.currency} — they will use this price list too.`
}

/** "United Kingdom", "Australia, New Zealand", or "Austria, Belgium, …" for a long list. */
export function countriesTitle(countries: ClubPriceCountry[]): string {
  const names = countries.map((c) => c.name)
  if (names.length === 0) return 'No country'
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')}, …`
}

/** "≈ AUD 518.00 today (+3.8%)". */
export function todayValueLine(tier: Pick<ClubPriceListTier, 'audValueCents' | 'driftPct'>, homeCurrency: string): string {
  if (tier.audValueCents === null) return `Today's ${homeCurrency} value unavailable`
  const drift = tier.driftPct === null ? '' : ` (${tier.driftPct > 0 ? '+' : ''}${tier.driftPct.toFixed(1)}%)`
  return `≈ ${formatCentsIn(tier.audValueCents, homeCurrency)} today${drift}`
}

/** A typed price VeloxVerse will accept: at least 1.00, up to 2 decimals. */
export function isValidPrice(raw: string): boolean {
  const s = raw.trim()
  return /^\d+(\.\d{1,2})?$/.test(s) && Number(s) >= 1
}

/** 49900 → "499.00". */
export function majorAmount(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
