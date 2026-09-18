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

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
