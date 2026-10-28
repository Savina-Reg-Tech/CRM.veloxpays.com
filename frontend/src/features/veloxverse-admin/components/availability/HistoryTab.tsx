import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Globe2, Settings2, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { changeSourceWords, diffChange, type CountryNames } from '../../availability'
import { useVVAvailabilityChanges } from '../../hooks/useVVAvailability'
import type { AvailabilityChange, AvailabilityChangeEntity, AvailabilityOverview } from '../../types'
import { AuditErrorState } from '../audit/AuditUI'
import { formatWhen } from './AvailabilityUI'

const PAGE = 50
const MAX = 200

const selectClass =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-10 sm:text-sm'

function Entry({ change, overview, names }: { change: AvailabilityChange; overview: AvailabilityOverview; names: CountryNames }) {
  const lines = diffChange(change, names)
  const isRule = change.entity === 'rule'
  const item = isRule ? overview.items.find((i) => i.key === change.entityId) : undefined
  const source = changeSourceWords(change)
  const Icon = isRule ? Settings2 : UserRound

  return (
    <li className="flex gap-3 px-4 py-3 sm:px-5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
          <span>{formatWhen(change.createdAt)}</span>
          <span>·</span>
          <span className="break-all font-medium text-gray-700">{change.actorEmail || 'An admin'}</span>
        </p>
        <p className="text-sm text-gray-900">
          {isRule ? (
            <span className="font-semibold">{item?.label ?? change.entityId}</span>
          ) : (
            <>
              <span className="font-semibold">Customer </span>
              <Link to={`/dashboard/veloxverse/users/${encodeURIComponent(change.entityId)}`} className="font-mono text-xs text-indigo-600 hover:underline">
                {change.entityId.slice(0, 8)}
              </Link>
            </>
          )}
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-500">No visible change.</p>
        ) : (
          <ul className="space-y-0.5">
            {lines.map((l) => (
              <li key={l.field} className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-700">
                <span className="text-gray-500">{l.field}:</span>
                <span className="break-words">{l.from}</span>
                <ArrowRight size={12} className="text-gray-400" aria-label="changed to" />
                <span className="break-words font-medium text-gray-900">{l.to}</span>
                {source && !isRule && <span className="text-xs text-gray-500">({source})</span>}
              </li>
            ))}
          </ul>
        )}
        {change.reason && <p className="break-words text-sm italic text-gray-600">“{change.reason}”</p>}
      </div>
    </li>
  )
}

export default function HistoryTab({ overview, names }: { overview: AvailabilityOverview; names: CountryNames }) {
  const [entity, setEntity] = useState<AvailabilityChangeEntity | ''>('')
  const [entityId, setEntityId] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const params = useMemo(
    () => ({ entity: entity || undefined, entityId: entity === 'rule' && entityId ? entityId : undefined, limit }),
    [entity, entityId, limit]
  )
  const changes = useVVAvailabilityChanges(params)
  const rows = changes.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Type of change"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value as AvailabilityChangeEntity | '')
            setEntityId('')
            setLimit(PAGE)
          }}
          className={selectClass}
        >
          <option value="">All changes</option>
          <option value="rule">Service rules</option>
          <option value="customer_country">Customer countries</option>
        </select>
        {entity === 'rule' && (
          <select
            aria-label="Service"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value)
              setLimit(PAGE)
            }}
            className={`${selectClass} sm:max-w-xs`}
          >
            <option value="">All services</option>
            {overview.items.map((i) => (
              <option key={i.key} value={i.key}>
                {i.parentKey ? `— ${i.label}` : i.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card padding="none">
        {changes.isError ? (
          <AuditErrorState error={changes.error} onRetry={() => changes.refetch()} />
        ) : changes.isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Globe2 className="h-6 w-6 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No changes yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((c) => (
              <Entry key={c.id} change={c} overview={overview} names={names} />
            ))}
          </ul>
        )}
      </Card>

      {rows.length >= limit && limit < MAX && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => Math.min(MAX, l + PAGE))} loading={changes.isFetching}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
