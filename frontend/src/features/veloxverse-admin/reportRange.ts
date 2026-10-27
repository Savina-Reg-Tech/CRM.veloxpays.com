/**
 * Date-range filter for VeloxVerse admin lists and their CSV exports.
 *
 * Days are the admin's own local days: `from` is the local start of the first day and `to` the local
 * start of the day after the last day (exclusive), both sent as ISO instants so VeloxVerse never has
 * to guess a timezone.
 */

export type RangePreset = 'all' | 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom'

/** `customFrom` / `customTo` are `YYYY-MM-DD` from `<input type="date">`; `customTo` is inclusive. */
export type ReportRange = { preset: RangePreset; customFrom?: string; customTo?: string }

export const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom dates' },
]

export const ALL_TIME: ReportRange = { preset: 'all' }

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** `YYYY-MM-DD` → local midnight of that day; undefined when empty or malformed. */
function parseDay(value?: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** The `from` / `to` query params for a range (omitted ends mean "no limit"). */
export function rangeParams(range: ReportRange, now = new Date()): { from?: string; to?: string } {
  const today = startOfDay(now)
  const iso = (from?: Date, to?: Date) => ({
    ...(from ? { from: from.toISOString() } : {}),
    ...(to ? { to: to.toISOString() } : {}),
  })
  switch (range.preset) {
    case 'today':
      return iso(today, addDays(today, 1))
    case '7d':
      return iso(addDays(today, -6), addDays(today, 1))
    case '30d':
      return iso(addDays(today, -29), addDays(today, 1))
    case 'thisMonth':
      return iso(new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1))
    case 'lastMonth':
      return iso(new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 1))
    case 'custom': {
      const from = parseDay(range.customFrom)
      const lastDay = parseDay(range.customTo)
      return iso(from, lastDay ? addDays(lastDay, 1) : undefined)
    }
    default:
      return {}
  }
}

/** True when a custom range has its last day before its first — nothing could match. */
export function isReversedRange(range: ReportRange): boolean {
  if (range.preset !== 'custom') return false
  const from = parseDay(range.customFrom)
  const to = parseDay(range.customTo)
  return !!from && !!to && to < from
}

/** Reads a range kept in the URL as `?range=…&from=YYYY-MM-DD&to=YYYY-MM-DD` (from/to for custom). */
export function rangeFromSearch(params: URLSearchParams): ReportRange {
  const preset = params.get('range') as RangePreset | null
  if (!preset || !RANGE_PRESETS.some((p) => p.value === preset)) return ALL_TIME
  if (preset !== 'custom') return { preset }
  return { preset, customFrom: params.get('from') || undefined, customTo: params.get('to') || undefined }
}

/** Writes `range` into `params` (mutates); "All time" removes the keys. */
export function writeRangeToSearch(params: URLSearchParams, range: ReportRange): void {
  params.delete('range')
  params.delete('from')
  params.delete('to')
  if (range.preset === 'all') return
  params.set('range', range.preset)
  if (range.preset === 'custom') {
    if (range.customFrom) params.set('from', range.customFrom)
    if (range.customTo) params.set('to', range.customTo)
  }
}
