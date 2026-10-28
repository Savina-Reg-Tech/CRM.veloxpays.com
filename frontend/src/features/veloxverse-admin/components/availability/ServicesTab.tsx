import { useEffect, useMemo, useState } from 'react'
import { Info, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import { useDebounce } from '@/hooks/useDebounce'
import { buildTree, isRestricted, type CountryNames } from '../../availability'
import type { AvailabilityItem, AvailabilityOverview } from '../../types'
import ServiceRuleRow from './ServiceRuleRow'

export interface ServicesFilters {
  q: string
  group: string
  restricted: boolean
}

interface Props {
  overview: AvailabilityOverview
  names: CountryNames
  filters: ServicesFilters
  onFiltersChange: (patch: Partial<ServicesFilters>) => void
  onEdit: (key: string) => void
}

function matches(item: AvailabilityItem, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return [item.label, item.group, item.key].some((v) => v.toLowerCase().includes(needle))
}

export default function ServicesTab({ overview, names, filters, onFiltersChange, onEdit }: Props) {
  // The box is local so typing stays snappy; the URL gets the debounced value.
  const [search, setSearch] = useState(filters.q)
  const debounced = useDebounce(search, 300)
  useEffect(() => {
    if (debounced !== filters.q) onFiltersChange({ q: debounced })
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSearch(filters.q), [filters.q])

  const byKey = useMemo(() => new Map(overview.items.map((i) => [i.key, i])), [overview.items])
  const groupNames = useMemo(() => [...new Set(overview.items.map((i) => i.group))], [overview.items])
  const restrictedCount = overview.items.filter((i) => isRestricted(i.rule)).length

  const groups = useMemo(() => {
    const keep = (i: AvailabilityItem) => matches(i, filters.q) && (!filters.restricted || isRestricted(i.rule))
    return buildTree(overview.items)
      .filter((g) => !filters.group || g.group === filters.group)
      .map((g) => ({
        ...g,
        nodes: g.nodes
          .map((n) => {
            const children = n.children.filter(keep)
            // A parent stays visible when one of its children matches, so the tree still reads.
            return keep(n.item) || children.length > 0 ? { ...n, children } : null
          })
          .filter((n): n is NonNullable<typeof n> => n !== null),
      }))
      .filter((g) => g.nodes.length > 0)
  }, [overview.items, filters])

  const hasFilters = Boolean(filters.q || filters.group || filters.restricted)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80">
          <Input
            aria-label="Search services"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            className="text-base sm:text-sm"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            aria-label="Group"
            value={filters.group}
            onChange={(e) => onFiltersChange({ group: e.target.value })}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-10 sm:text-sm"
          >
            <option value="">All groups</option>
            {groupNames.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <Switch checked={filters.restricted} onChange={(v) => onFiltersChange({ restricted: v })} label="Only restricted" />
        </div>
        <p className="text-sm text-gray-500 lg:ml-auto">
          <span className="font-semibold text-gray-900">{restrictedCount}</span> of {overview.items.length} restricted
        </p>
      </div>

      {groups.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-gray-500">No services match your search.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                onFiltersChange({ q: '', group: '', restricted: false })
              }}
              className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </button>
          )}
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.group} padding="none">
            <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
              <h3 className="text-base font-semibold text-gray-900">{g.group}</h3>
            </div>
            <div className="divide-y divide-gray-100 px-1 py-1 sm:px-2">
              {g.nodes.map(({ item, children }) => {
                const allChildren = overview.items.filter((i) => i.parentKey === item.key)
                return (
                  <div key={item.key} className="py-1">
                    <ServiceRuleRow item={item} parent={null} names={names} onEdit={onEdit} />
                    {isRestricted(item.rule) && allChildren.length > 0 && (
                      <p className="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <Info size={14} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                        <span>
                          Its parts below follow this rule too
                          {item.rule.mode === 'disabled' &&
                            ` — while ${item.label} is off, ${allChildren.slice(0, 2).map((c) => c.label).join(', ')}${allChildren.length > 2 ? ' and the rest' : ''} are off as well`}
                          .
                        </span>
                      </p>
                    )}
                    {children.map((child) => (
                      <ServiceRuleRow key={child.key} item={child} parent={byKey.get(child.parentKey!) ?? null} names={names} onEdit={onEdit} />
                    ))}
                  </div>
                )
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
