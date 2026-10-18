import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { serviceLabel, supplierLabel, stepLabel } from '../../audit'
import type { AuditEvent } from '../../auditTypes'
import { AuditTime, CustomerCell, EventTypeIcon, SeverityBadge, StatusIcon } from './AuditUI'

/** Open the event drawer by putting `?event=<id>` in the URL (shareable, back-button friendly). */
export function useOpenEvent() {
  const [, setParams] = useSearchParams()
  return (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('event', id)
        return next
      },
      { replace: false }
    )
}

function ReferenceText({ e }: { e: AuditEvent }) {
  if (!e.referenceId) return <span className="text-gray-400">—</span>
  return (
    <span className="block truncate font-mono text-xs text-gray-600" title={`${e.referenceType ?? ''} ${e.referenceId}`}>
      {e.referenceType && <span className="text-gray-400">{e.referenceType}: </span>}
      {e.referenceId}
    </span>
  )
}

function ErrorText({ e }: { e: AuditEvent }) {
  if (!e.errorCode && !e.errorMessage) return <span className="text-gray-400">—</span>
  return (
    <span className="block truncate text-xs" title={[e.errorCode, e.errorMessage].filter(Boolean).join(' — ')}>
      {e.errorCode && <span className="font-mono font-semibold text-red-700">{e.errorCode}</span>}
      {e.errorCode && e.errorMessage && ' '}
      {e.errorMessage && <span className="text-gray-600">{e.errorMessage}</span>}
    </span>
  )
}

/** Newest-first event list: a table from lg (1024px), cards below. Row click → drawer. */
export function EventTable({ events, highlightCritical = false }: { events: AuditEvent[]; highlightCritical?: boolean }) {
  const open = useOpenEvent()
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-3 py-2.5">Time</th>
              <th scope="col" className="px-3 py-2.5">Severity</th>
              <th scope="col" className="px-3 py-2.5">Service</th>
              <th scope="col" className="px-3 py-2.5">Step</th>
              <th scope="col" className="px-3 py-2.5">Customer</th>
              <th scope="col" className="px-3 py-2.5">Supplier</th>
              <th scope="col" className="px-3 py-2.5">HTTP</th>
              <th scope="col" className="px-3 py-2.5">Error</th>
              <th scope="col" className="px-3 py-2.5">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {events.map((e) => (
              <tr
                key={e.id}
                tabIndex={0}
                onClick={() => open(e.id)}
                onKeyDown={(k) => k.key === 'Enter' && open(e.id)}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-indigo-50/40 focus:bg-indigo-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
                  highlightCritical && e.severity === 'critical' && 'bg-red-50/60'
                )}
              >
                <td className="px-3 py-2.5 text-xs text-gray-600"><AuditTime iso={e.createdAt} /></td>
                <td className="px-3 py-2.5"><SeverityBadge severity={e.severity} /></td>
                <td className="max-w-[10rem] px-3 py-2.5"><span className="block truncate text-gray-700">{serviceLabel(e.service)}</span></td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <EventTypeIcon type={e.eventType} />
                    <StatusIcon status={e.status} />
                    <span className="whitespace-nowrap font-medium text-gray-900">{stepLabel(e.step)}</span>
                  </span>
                </td>
                <td className="max-w-[14rem] px-3 py-2.5 text-xs"><CustomerCell customer={e.customer} anonId={e.anonId} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{e.supplier ? supplierLabel(e.supplier) : <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{e.httpStatus ?? <span className="text-gray-400">—</span>}</td>
                <td className="max-w-[16rem] px-3 py-2.5"><ErrorText e={e} /></td>
                <td className="max-w-[12rem] px-3 py-2.5"><ReferenceText e={e} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 lg:hidden">
        {events.map((e) => (
          <li key={e.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_96px]">
            <button
              type="button"
              onClick={() => open(e.id)}
              className={cn(
                'min-h-[72px] w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                highlightCritical && e.severity === 'critical' && 'border-red-200 bg-red-50/60'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <EventTypeIcon type={e.eventType} />
                  <StatusIcon status={e.status} />
                  <span className="truncate font-medium text-gray-900">{stepLabel(e.step)}</span>
                </span>
                <SeverityBadge severity={e.severity} className="shrink-0" />
              </div>
              <p className="mt-1 break-words text-xs text-gray-500">
                {serviceLabel(e.service)}
                {e.supplier && ` · ${supplierLabel(e.supplier)}`}
                {e.httpStatus && ` · ${e.httpStatus}`}
              </p>
              <div className="mt-1 text-xs"><ErrorText e={e} /></div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-500">
                <span className="min-w-0"><CustomerCell customer={e.customer} anonId={e.anonId} link={false} /></span>
                <AuditTime iso={e.createdAt} className="shrink-0" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
