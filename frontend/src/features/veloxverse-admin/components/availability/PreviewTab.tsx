import { useMemo } from 'react'
import { Ban, Check, Clock, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { buildTree, countryName, displayShort, type CountryNames } from '../../availability'
import { useVVAvailabilityPreview } from '../../hooks/useVVAvailability'
import type { AvailabilityItem, AvailabilityOverview, ItemAvailabilityPreview } from '../../types'
import { AuditErrorState } from '../audit/AuditUI'
import { CountrySelect } from './AvailabilityUI'

interface Props {
  overview: AvailabilityOverview
  names: CountryNames
  /** ISO-2, or '' for "country unknown". */
  country: string
  onCountryChange: (code: string) => void
  onOpen: (key: string) => void
}

function Status({ p, byKey, self }: { p: ItemAvailabilityPreview | undefined; byKey: Map<string, AvailabilityItem>; self: string }) {
  if (!p) return <Badge variant="neutral">Unknown</Badge>
  if (p.available) {
    return (
      <Badge variant="success">
        <Check size={12} aria-hidden="true" /> Available
      </Badge>
    )
  }
  const display = p.display === 'show' ? 'hidden' : p.display
  const Icon = display === 'hidden' ? EyeOff : display === 'not-available' ? Ban : Clock
  const blocker = p.blockedBy && p.blockedBy !== self ? byKey.get(p.blockedBy) : undefined
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <Badge variant={display === 'hidden' ? 'neutral' : 'warning'}>
        <Icon size={12} aria-hidden="true" /> {displayShort(display)}
      </Badge>
      {blocker && <span className="text-xs text-gray-500">because {blocker.label} is off</span>}
    </span>
  )
}

export default function PreviewTab({ overview, names, country, onCountryChange, onOpen }: Props) {
  const preview = useVVAvailabilityPreview(country || null)
  const byKey = useMemo(() => new Map(overview.items.map((i) => [i.key, i])), [overview.items])
  const groups = useMemo(() => buildTree(overview.items), [overview.items])

  const services = preview.data?.services ?? {}
  const available = overview.items.filter((i) => services[i.key]?.available).length
  const where = country ? countryName(country, names) : 'Country unknown'

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <label htmlFor="vv-preview-country" className="mb-1.5 block text-sm font-medium text-gray-700">
          What does a customer in … see?
        </label>
        <CountrySelect
          id="vv-preview-country"
          value={country}
          onChange={onCountryChange}
          countries={overview.countries}
          emptyLabel="Country unknown (location can't be looked up)"
          className="sm:w-72"
        />
        <p className="mt-2 text-xs text-gray-500">
          {country
            ? `Shows what a customer sees when they live in ${where} and are in ${where} right now. Someone who lives elsewhere but is visiting is treated the same as a resident (unless 'Only if they live there and are there right now' is on).`
            : 'Shows what a customer sees when we know neither where they live nor where they are right now.'}
          {!overview.enforced && ' Not live yet — the master switch is off, so right now everyone still sees everything.'}
        </p>
      </Card>

      {preview.isError ? (
        <Card><AuditErrorState error={preview.error} onRetry={() => preview.refetch()} /></Card>
      ) : preview.isLoading ? (
        <Card className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{where}:</span> {available} available, {overview.items.length - available} not available
          </p>
          {groups.map((g) => (
            <Card key={g.group} padding="none">
              <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
                <h3 className="text-base font-semibold text-gray-900">{g.group}</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {g.nodes.flatMap(({ item, children }) =>
                  [item, ...children].map((i) => (
                    <li key={i.key}>
                      <button
                        type="button"
                        onClick={() => onOpen(i.key)}
                        className={cn(
                          'flex min-h-[44px] w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-gray-50 sm:px-5',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
                          i.parentKey && 'pl-8 sm:pl-10'
                        )}
                      >
                        <span className={cn('min-w-0 break-words text-sm text-gray-900', !i.parentKey && 'font-semibold')}>{i.label}</span>
                        <Status p={services[i.key]} byKey={byKey} self={i.key} />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
