import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Globe, Plug, Route as RouteIcon, User, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { useVVAuditMeta, useVVAuditTrace } from '../hooks/useVVAudit'
import { formatDurationMs, humanize, supplierLabel } from '../audit'
import {
  AuditEmpty,
  AuditErrorState,
  AuditPageShell,
  AuditTime,
  CopyId,
  CustomerCell,
  MaskedNote,
} from '../components/audit/AuditUI'
import { EventTimeline } from '../components/audit/EventTimeline'
import { EventDrawer } from '../components/audit/EventDrawer'
import { useOpenEvent } from '../components/audit/EventTable'

const AUDIT = '/dashboard/veloxverse/audit-logs'

function ChainStep({ icon: Icon, title, tone = 'gray', children, last = false }: { icon: typeof User; title: string; tone?: 'gray' | 'red' | 'indigo'; children: ReactNode; last?: boolean }) {
  const toneCls = tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls}`}><Icon className="h-4.5 w-4.5" /></span>
        {!last && <ChevronDown className="my-1 h-4 w-4 text-gray-300" />}
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
        <div className="mt-0.5 text-sm text-gray-900">{children}</div>
      </div>
    </div>
  )
}

/** Everything about one request — what support opens when a customer quotes "Ref: …" (§7.3). */
export default function VVAuditTracePage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { data, isLoading, error, refetch } = useVVAuditTrace(requestId)
  const meta = useVVAuditMeta()
  const open = useOpenEvent()
  const retentionDays = meta.data?.retentionDays ?? 5

  return (
    <AuditPageShell
      title={<span className="flex flex-wrap items-center gap-2">Request trace <CopyId value={requestId} /></span>}
      subtitle="Customer → journey → request → supplier calls → errors, then every event of the request."
      tabs={false}
      actions={
        <Link to={AUDIT} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Audit logs
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" label="Loading trace…" /></div>
      ) : error || !data ? (
        <Card><AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={retentionDays} /></Card>
      ) : data.events.length === 0 ? (
        <Card>
          <AuditEmpty title="No events for this reference" text={`It's older than ${retentionDays} days, or mistyped. References are 16 characters, e.g. c69b661dbe6e1615.`} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <Card className="h-fit space-y-1">
            <MaskedNote />
            <ChainStep icon={User} title="Customer">
              <CustomerCell customer={data.customer} anonId={data.anonId} />
              {data.customer?.name && <p className="text-xs text-gray-500">{data.customer.name}</p>}
            </ChainStep>
            <ChainStep icon={Globe} title="Journey" tone="indigo">
              {data.journeyId ? <CopyId value={data.journeyId} to={`${AUDIT}/journeys/${data.journeyId}`} short /> : <span className="text-gray-400">Not part of a booking attempt</span>}
            </ChainStep>
            <ChainStep icon={RouteIcon} title="Request">
              <span className="break-all font-mono text-xs">{data.route ?? '—'}</span>
              {data.references.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {data.references.map((r) => (
                    <li key={`${r.type}:${r.id}`} className="text-xs">
                      <span className="text-gray-500">{r.type}: </span>
                      <CopyId value={r.id} short to={r.type && r.id ? `${AUDIT}/bookings/${encodeURIComponent(r.type)}/${encodeURIComponent(r.id)}` : undefined} />
                    </li>
                  ))}
                </ul>
              )}
            </ChainStep>
            <ChainStep icon={Plug} title={`Supplier calls (${data.supplierCalls.length})`}>
              {data.supplierCalls.length === 0 ? (
                <span className="text-gray-400">None</span>
              ) : (
                <ul className="space-y-1.5">
                  {data.supplierCalls.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => open(c.id)} className="w-full rounded-md border border-gray-100 px-2 py-1.5 text-left text-xs hover:border-indigo-200">
                        <span className="font-medium">{supplierLabel(c.supplier)}</span>
                        <span className={c.status === 'failure' ? ' text-red-600' : ' text-emerald-600'}> · {humanize(c.step)}</span>
                        {typeof c.metadata?.operation === 'string' && <span className="block truncate font-mono text-gray-500">{c.metadata.operation}</span>}
                        <span className="text-gray-500">
                          {formatDurationMs(c.durationMs)}
                          {c.metadata?.upstreamStatus != null && ` · upstream ${String(c.metadata.upstreamStatus)}`}
                          {c.errorCode && ` · ${c.errorCode}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ChainStep>
            <ChainStep icon={XCircle} title={`Errors (${data.errors.length})`} tone={data.errors.length ? 'red' : 'gray'} last>
              {data.errors.length === 0 ? (
                <span className="text-emerald-600">No errors</span>
              ) : (
                <ul className="space-y-1.5">
                  {data.errors.map((er) => (
                    <li key={er.id}>
                      <button type="button" onClick={() => open(er.id)} className="w-full rounded-md border border-red-100 bg-red-50/60 px-2 py-1.5 text-left text-xs hover:border-red-300">
                        <span className="font-medium text-red-800">{humanize(er.step)}</span>
                        {er.errorCode && <span className="font-mono text-red-700"> · {er.errorCode}</span>}
                        {er.errorMessage && <span className="block break-words text-red-700">{er.errorMessage}</span>}
                        <AuditTime iso={er.createdAt} className="text-gray-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ChainStep>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">All {data.events.length} events, oldest first</h2>
            <EventTimeline events={data.events} />
          </Card>
        </div>
      )}
      <EventDrawer />
    </AuditPageShell>
  )
}
