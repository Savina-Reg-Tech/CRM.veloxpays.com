import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { formatDurationMs, formatMinutes, humanize, journeyPhase, relativeOffset, serviceLabel, sourceLabel, supplierLabel } from '../../audit'
import type { AuditEvent } from '../../auditTypes'
import { AuditTime, EventTypeIcon, SeverityBadge, StatusIcon } from './AuditUI'
import { useOpenEvent } from './EventTable'

const GAP_MINUTES = 5

/**
 * Vertical, oldest-first timeline (trace, journey, booking trail). Failures are red with the
 * reason inline, rows recorded by a webhook / job / system get a "system" tag, and pauses longer
 * than 5 minutes are called out ("customer left for 12 min"). Click a row → event drawer.
 */
export function EventTimeline({
  events,
  groupByPhase = false,
  showOffsets = true,
}: {
  events: AuditEvent[]
  groupByPhase?: boolean
  showOffsets?: boolean
}) {
  const open = useOpenEvent()
  const start = events[0]?.createdAt
  let lastPhase = ''

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const prev = events[i - 1]
        const gapMin = prev ? (new Date(e.createdAt).getTime() - new Date(prev.createdAt).getTime()) / 60_000 : 0
        const phase = journeyPhase(e.eventType, e.step)
        const showPhase = groupByPhase && phase !== lastPhase
        lastPhase = phase
        const failed = e.status === 'failure'
        const system = e.source === 'webhook' || e.source === 'job' || e.actor === 'system'
        const operation = typeof e.metadata?.operation === 'string' ? e.metadata.operation : null
        const upstream = e.metadata?.upstreamStatus

        return (
          <Fragment key={e.id}>
            {showPhase && (
              <li className="pb-1 pl-8 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{phase}</li>
            )}
            {gapMin > GAP_MINUTES && (
              <li className="relative py-1 pl-8">
                <span className="absolute left-[11px] top-0 h-full border-l border-dashed border-gray-300" />
                <span className="text-xs italic text-gray-400">
                  {e.actor === 'customer' || e.actor === 'guest' ? 'Customer was away' : 'Nothing happened'} for {formatMinutes(gapMin)}
                </span>
              </li>
            )}
            <li className="relative pb-3 pl-8">
              {i < events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-gray-200" />}
              <span
                className={cn(
                  'absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                  failed ? 'bg-red-100' : e.status === 'warning' ? 'bg-amber-100' : e.status === 'success' ? 'bg-emerald-100' : 'bg-gray-100'
                )}
              >
                <EventTypeIcon type={e.eventType} className={cn('h-3.5 w-3.5', failed && 'text-red-600')} />
              </span>
              <button
                type="button"
                onClick={() => open(e.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition hover:shadow-sm',
                  failed ? 'border-red-200 bg-red-50/60 hover:border-red-300' : 'border-gray-100 bg-white hover:border-indigo-200'
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusIcon status={e.status} />
                  <span className={cn('font-medium', failed ? 'text-red-800' : 'text-gray-900')}>{humanize(e.step)}</span>
                  {e.severity !== 'info' && <SeverityBadge severity={e.severity} />}
                  {system && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600" title={sourceLabel(e.source)}>
                      system
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                    {showOffsets && start && i > 0 && <span className="tabular-nums text-gray-400">{relativeOffset(start, e.createdAt)}</span>}
                    <AuditTime iso={e.createdAt} />
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {serviceLabel(e.service)}
                  {e.supplier && ` · ${supplierLabel(e.supplier)}`}
                  {operation && <> · <span className="font-mono">{operation}</span></>}
                  {upstream != null && ` · upstream ${String(upstream)}`}
                  {e.durationMs != null && ` · ${formatDurationMs(e.durationMs)}`}
                  {e.httpStatus != null && ` · HTTP ${e.httpStatus}`}
                </p>
                {(e.errorCode || e.errorMessage) && (
                  <p className="mt-1 break-words text-xs text-red-700">
                    {e.errorCode && <span className="font-mono font-semibold">{e.errorCode}</span>}
                    {e.errorCode && e.errorMessage && ' — '}
                    {e.errorMessage}
                  </p>
                )}
              </button>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
