import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Globe } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useVVAuditMeta, useVVAuditTimeline } from '../../hooks/useVVAudit'
import { fromLocalInput, serviceLabel, toLocalInput } from '../../audit'
import type { AuditTimelineFilters } from '../../auditTypes'
import { AuditEmpty, AuditErrorState, CopyId, MaskedNote, MultiSelect } from './AuditUI'
import { EventTable } from './EventTable'

const AUDIT = '/dashboard/veloxverse/audit-logs'

/** A customer's (or guest browser's) full activity, newest first (§7.5). Render <EventDrawer />
 * on the host page for row clicks. */
export function CustomerActivity({ kind, id }: { kind: 'user' | 'guest'; id: string | undefined }) {
  const meta = useVVAuditMeta()
  const [filters, setFilters] = useState<AuditTimelineFilters>({})
  const query = useVVAuditTimeline(kind, id, filters)
  const events = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.events), [query.data])
  const retentionDays = meta.data?.retentionDays ?? 5

  // Summary over what's loaded so far (VeloxVerse keeps `retentionDays` of detail anyway).
  const journeys = useMemo(() => {
    const map = new Map<string, { id: string; at: string; failed: boolean }>()
    for (const e of events) {
      if (!e.journeyId) continue
      const j = map.get(e.journeyId) ?? { id: e.journeyId, at: e.createdAt, failed: false }
      if (e.status === 'failure') j.failed = true
      if (e.createdAt > j.at) j.at = e.createdAt
      map.set(e.journeyId, j)
    }
    return [...map.values()].sort((a, b) => b.at.localeCompare(a.at))
  }, [events])
  const errorCount = events.filter((e) => e.status === 'failure').length
  const more = query.hasNextPage ? '+' : ''

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
          <Activity className="h-5 w-5 text-indigo-500" />
          <div><p className="text-lg font-bold text-gray-900">{events.length}{more}</p><p className="text-xs text-gray-500">Events (last {retentionDays} days)</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
          <Globe className="h-5 w-5 text-emerald-500" />
          <div><p className="text-lg font-bold text-gray-900">{journeys.length}{more}</p><p className="text-xs text-gray-500">Booking attempts</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
          <AlertTriangle className={`h-5 w-5 ${errorCount ? 'text-red-500' : 'text-gray-300'}`} />
          <div><p className={`text-lg font-bold ${errorCount ? 'text-red-600' : 'text-gray-900'}`}>{errorCount}{more}</p><p className="text-xs text-gray-500">Errors hit</p></div>
        </div>
      </div>

      {journeys.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recent journeys</p>
          <div className="flex flex-wrap gap-2">
            {journeys.slice(0, 8).map((j) => (
              <Link
                key={j.id}
                to={`${AUDIT}/journeys/${j.id}`}
                className={`rounded-full px-3 py-1 font-mono text-xs ring-1 ${j.failed ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-gray-50 text-gray-700 ring-gray-200'} hover:ring-indigo-300`}
              >
                {j.id.slice(0, 8)}…
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44"><MultiSelect label="Service" options={meta.data?.services ?? []} value={filters.service ?? []} onChange={(v) => setFilters((f) => ({ ...f, service: v }))} format={serviceLabel} /></div>
        <div className="w-40"><MultiSelect label="Severity" options={meta.data?.severities.map((s) => s.value) ?? []} value={filters.severity ?? []} onChange={(v) => setFilters((f) => ({ ...f, severity: v }))} /></div>
        <input type="datetime-local" aria-label="From" value={toLocalInput(filters.from)} onChange={(e) => setFilters((f) => ({ ...f, from: fromLocalInput(e.target.value) }))} className="h-10 rounded-lg border border-gray-300 px-2 text-sm" />
        <input type="datetime-local" aria-label="To" value={toLocalInput(filters.to)} onChange={(e) => setFilters((f) => ({ ...f, to: fromLocalInput(e.target.value) }))} className="h-10 rounded-lg border border-gray-300 px-2 text-sm" />
        {kind === 'guest' && id && <span className="text-xs text-gray-500">Browser id <CopyId value={id} /></span>}
        <span className="ml-auto"><MaskedNote /></span>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-10"><Spinner size="md" label="Loading activity…" /></div>
      ) : query.isError ? (
        <AuditErrorState error={query.error} onRetry={() => void query.refetch()} retentionDays={retentionDays} />
      ) : events.length === 0 ? (
        <AuditEmpty icon={Activity} title="No activity recorded" text={`Detailed activity is kept ${retentionDays} days.`} />
      ) : (
        <>
          <EventTable events={events} highlightCritical />
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
