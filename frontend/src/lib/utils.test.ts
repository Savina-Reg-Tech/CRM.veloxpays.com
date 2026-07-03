import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateTime, getInitials } from './utils'

describe('cn', () => {
  it('merges classnames and de-duplicates conflicting Tailwind utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', false && 'text-blue-500', 'font-bold')).toBe(
      'text-red-500 font-bold'
    )
  })
})

describe('formatDate', () => {
  it('renders an ISO date as a short, locale-friendly date', () => {
    expect(formatDate('2026-05-14T08:30:00Z')).toMatch(/May 1[34], 2026/)
  })

  it('returns em-dash for missing or invalid input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('renders an ISO datetime with both date and time parts', () => {
    const out = formatDateTime('2026-05-14T08:30:00Z')
    expect(out).toMatch(/May 1[34], 2026/)
    expect(out).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns em-dash for missing input', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })
})

describe('getInitials', () => {
  it('returns up to two initials, uppercased', () => {
    expect(getInitials('Jane Smith')).toBe('JS')
    expect(getInitials('jane mary smith')).toBe('JM')
    expect(getInitials('madonna')).toBe('M')
  })
})
