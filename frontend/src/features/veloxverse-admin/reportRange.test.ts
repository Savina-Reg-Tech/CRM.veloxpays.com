import { describe, expect, it } from 'vitest'
import { isReversedRange, rangeFromSearch, rangeParams, writeRangeToSearch } from './reportRange'

// A fixed local "now": Wednesday 15 Oct 2026, 14:30 in the test runner's own timezone.
const NOW = new Date(2026, 9, 15, 14, 30)
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()

describe('rangeParams', () => {
  it('sends nothing for all time', () => {
    expect(rangeParams({ preset: 'all' }, NOW)).toEqual({})
  })

  it('covers whole local days with an exclusive end', () => {
    expect(rangeParams({ preset: 'today' }, NOW)).toEqual({ from: local(2026, 10, 15), to: local(2026, 10, 16) })
    expect(rangeParams({ preset: '7d' }, NOW)).toEqual({ from: local(2026, 10, 9), to: local(2026, 10, 16) })
    expect(rangeParams({ preset: '30d' }, NOW)).toEqual({ from: local(2026, 9, 16), to: local(2026, 10, 16) })
  })

  it('handles this month and last month, including across a year boundary', () => {
    expect(rangeParams({ preset: 'thisMonth' }, NOW)).toEqual({ from: local(2026, 10, 1), to: local(2026, 10, 16) })
    expect(rangeParams({ preset: 'lastMonth' }, NOW)).toEqual({ from: local(2026, 9, 1), to: local(2026, 10, 1) })
    expect(rangeParams({ preset: 'lastMonth' }, new Date(2027, 0, 10))).toEqual({ from: local(2026, 12, 1), to: local(2027, 1, 1) })
  })

  it('makes the custom last day inclusive and allows an open end', () => {
    expect(rangeParams({ preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-31' }, NOW)).toEqual({
      from: local(2026, 10, 1),
      to: local(2026, 11, 1),
    })
    expect(rangeParams({ preset: 'custom', customFrom: '2026-10-01' }, NOW)).toEqual({ from: local(2026, 10, 1) })
    expect(rangeParams({ preset: 'custom', customFrom: 'nope' }, NOW)).toEqual({})
  })
})

describe('isReversedRange', () => {
  it('flags a custom range that ends before it starts', () => {
    expect(isReversedRange({ preset: 'custom', customFrom: '2026-10-10', customTo: '2026-10-01' })).toBe(true)
    expect(isReversedRange({ preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-01' })).toBe(false)
  })

})

describe('range in the URL', () => {
  it('round-trips presets and custom days, and ignores junk', () => {
    const p = new URLSearchParams('page=2')
    writeRangeToSearch(p, { preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-31' })
    expect(p.toString()).toBe('page=2&range=custom&from=2026-10-01&to=2026-10-31')
    expect(rangeFromSearch(p)).toEqual({ preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-31' })
    writeRangeToSearch(p, { preset: 'all' })
    expect(p.toString()).toBe('page=2')
    expect(rangeFromSearch(new URLSearchParams('range=lastMonth'))).toEqual({ preset: 'lastMonth' })
    expect(rangeFromSearch(new URLSearchParams('range=bogus'))).toEqual({ preset: 'all' })
  })
})
