import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRY_PRESETS, countryFlag, type CountryNames } from '../../availability'
import type { AvailabilityCountry } from '../../types'
import { CountryChip } from './AvailabilityUI'

interface Props {
  countries: AvailabilityCountry[]
  names: CountryNames
  selected: string[]
  onChange: (codes: string[]) => void
  error?: string | null
}

/** Selected countries as removable chips, quick-add presets, then a searchable checkbox list. */
export default function CountryPicker({ countries, names, selected, onChange, error }: Props) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const chosen = useMemo(() => new Set(selected), [selected])
  const known = useMemo(() => new Set(countries.map((c) => c.code)), [countries])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
  }, [countries, query])

  const set = (codes: Iterable<string>) => onChange([...new Set(codes)].sort())
  const toggle = (code: string) => set(chosen.has(code) ? selected.filter((c) => c !== code) : [...selected, code])
  const addPreset = (codes: string[]) => set([...selected, ...codes.filter((c) => known.has(c))])

  return (
    <div className="space-y-3">
      {/* Selected */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm', error ? 'text-red-600' : 'text-gray-600')}>
          {selected.length === 0 ? 'No countries selected' : `${selected.length} ${selected.length === 1 ? 'country' : 'countries'} selected`}
        </p>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Clear all
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {selected.map((code) => (
            <CountryChip key={code} code={code} names={names} full onRemove={() => toggle(code)} />
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {/* Quick add */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-500">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addPreset(p.codes)}
              className="min-h-[36px] rounded-full border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + list */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="relative border-b border-gray-200 bg-white">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor={searchId} className="sr-only">Search countries</label>
          <input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries…"
            className="block w-full border-0 py-2.5 pl-9 pr-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 sm:text-sm"
          />
        </div>
        <ul className="max-h-[45vh] overflow-y-auto lg:max-h-72">
          {visible.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-gray-500">No country matches “{query}”.</li>
          ) : (
            visible.map((c) => (
              <li key={c.code}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={chosen.has(c.code)}
                    onChange={() => toggle(c.code)}
                    aria-label={`${c.name} (${c.code})`}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span aria-hidden="true">{countryFlag(c.code)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400">{c.code}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
