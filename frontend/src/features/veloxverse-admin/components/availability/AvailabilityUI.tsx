import type { ReactNode } from 'react'
import { Ban } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { cn, zoneAbbr } from '@/lib/utils'
import { countryFlag, countryName, ruleSummary, type CountryNames } from '../../availability'
import type { AvailabilityCountry, AvailabilityRule } from '../../types'

/** "🇦🇺 AU" — the code is always there as text, flags don't render everywhere. */
export function CountryChip({ code, names, full = false, onRemove }: { code: string; names?: CountryNames; full?: boolean; onRemove?: () => void }) {
  const name = names ? countryName(code, names) : code
  return (
    <span
      title={name}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
    >
      <span aria-hidden="true">{countryFlag(code)}</span>
      <span className="truncate">{full ? name : code}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          ×
        </button>
      )}
    </span>
  )
}

/** State badge + up to 3 country chips + "+N more". */
export function RuleBadge({ rule, names }: { rule: Pick<AvailabilityRule, 'mode' | 'countries'>; names: CountryNames }) {
  const s = ruleSummary(rule)
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={s.variant}>
        {rule.mode === 'disabled' && <Ban size={12} aria-hidden="true" />}
        {s.label}
      </Badge>
      {s.chips.map((code) => (
        <CountryChip key={code} code={code} names={names} />
      ))}
      {s.more > 0 && <span className="text-xs text-gray-500">+{s.more} more</span>}
    </div>
  )
}

export function MiniChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200', className)}>
      {children}
    </span>
  )
}

/** "28 Oct 2026, 14:20 IST" (year dropped for this year when `short`). */
export function formatWhen(iso: string | null | undefined, short = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const text = d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(short && sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${text} ${zoneAbbr(d)}`.trim()
}

/** Native select (type-to-jump, phone pickers) over the ~250 countries. */
export function CountrySelect({
  id,
  value,
  onChange,
  countries,
  emptyLabel,
  className,
}: {
  id?: string
  value: string
  onChange: (code: string) => void
  countries: AvailabilityCountry[]
  /** Label for the "" option (e.g. "Country unknown"). */
  emptyLabel: string
  className?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 sm:h-10 sm:text-sm',
        'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100',
        className
      )}
    >
      <option value="">{emptyLabel}</option>
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {countryFlag(c.code)} {c.name} ({c.code})
        </option>
      ))}
    </select>
  )
}
