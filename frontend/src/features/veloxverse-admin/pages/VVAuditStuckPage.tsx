import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useVVAuditMeta, useVVAuditStuck } from '../hooks/useVVAudit'
import { SEVERITY_RANK, formatMinutes, humanize, serviceLabel, stuckDetailEntries } from '../audit'
import type { AuditStuckItem } from '../auditTypes'
import {
  AuditEmpty,
  AuditErrorState,
  AuditPageShell,
  AuditTime,
  CopyId,
  CustomerCell,
  MaskedNote,
  SeverityBadge,
  useCustomerHref,
} from '../components/audit/AuditUI'

const AUDIT = '/dashboard/veloxverse/audit-logs'

function Actions({ item }: { item: AuditStuckItem }) {
  const customerHref = useCustomerHref()
  const link = 'rounded-md px-2 py-1 text-xs font-medium text-indigo-600 ring-1 ring-indigo-100 hover:bg-indigo-50'
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.journeyId && <Link to={`${AUDIT}/journeys/${item.journeyId}`} className={link}>Open journey</Link>}
      <Link to={`${AUDIT}/bookings/${encodeURIComponent(item.referenceType)}/${encodeURIComponent(item.referenceId)}`} className={link}>Booking trail</Link>
      {item.userId && <Link to={customerHref(item.userId)} className={link}>Customer</Link>}
    </div>
  )
}

function Details({ item }: { item: AuditStuckItem }) {
  const entries = stuckDetailEntries(item.details ?? {})
  if (!entries.length) return <span className="text-gray-400">—</span>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500">{k}</dt>
          <dd className="min-w-0 break-words font-mono text-gray-800">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Customers stuck right now (computed live by VeloxVerse), most severe then longest first (§7.7). */
export default function VVAuditStuckPage() {
  const meta = useVVAuditMeta()
  const [rule, setRule] = useState('')
  const query = useVVAuditStuck(rule ? [rule] : undefined)
  const items = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.minutesStuck - a.minutesStuck),
    [query.data]
  )
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of query.data ?? []) m.set(i.rule, (m.get(i.rule) ?? 0) + 1)
    return m
  }, [query.data])
  const updated = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null

  return (
    <AuditPageShell
      title="Stuck customers"
      subtitle="People who got stuck right now — e.g. paid but not booked. Refreshes every minute."
      actions={
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} loading={query.isFetching}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRule('')}
          className={cn('rounded-full px-3 py-1 text-xs font-medium', !rule ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
        >
          All rules
        </button>
        {(meta.data?.stuckRules ?? []).map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRule(r.key)}
            title={`${r.description}${r.thresholdMinutes ? ` — after ${formatMinutes(r.thresholdMinutes)}` : ''}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              rule === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {r.description}
            {!rule && counts.get(r.key) ? <span className="rounded-full bg-white/80 px-1.5 text-[10px] text-gray-700">{counts.get(r.key)}</span> : null}
          </button>
        ))}
        {updated && <span className="ml-auto text-xs text-gray-400">Updated {updated.toLocaleTimeString()}</span>}
      </div>
      <MaskedNote />

      <Card padding="none">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" label="Checking for stuck customers…" /></div>
        ) : query.isError ? (
          <AuditErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <AuditEmpty icon={CheckCircle2} title="Nobody is stuck right now" text="Every checkout, payment and supplier booking is moving normally." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2.5">Severity</th>
                    <th className="px-3 py-2.5">Problem</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Service</th>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-3 py-2.5">Stuck for</th>
                    <th className="px-3 py-2.5">Details</th>
                    <th className="px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((i) => (
                    <tr key={`${i.rule}:${i.referenceId}`} className={i.severity === 'critical' ? 'bg-red-50/70' : undefined}>
                      <td className="px-3 py-3 align-top"><SeverityBadge severity={i.severity} /></td>
                      <td className={cn('px-3 py-3 align-top font-medium', i.severity === 'critical' ? 'text-red-800' : 'text-gray-900')}>{i.description}</td>
                      <td className="max-w-[14rem] px-3 py-3 align-top text-xs"><CustomerCell customer={i.customer} /></td>
                      <td className="px-3 py-3 align-top text-xs text-gray-700">{serviceLabel(i.service)}</td>
                      <td className="max-w-[12rem] px-3 py-3 align-top text-xs">
                        <span className="text-gray-500">{humanize(i.referenceType)}</span>
                        <CopyId value={i.referenceId} short />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <span className={cn('font-semibold', i.severity === 'critical' ? 'text-red-700' : 'text-gray-900')}>{formatMinutes(i.minutesStuck)}</span>
                        <span className="block text-xs text-gray-500">since <AuditTime iso={i.since} /></span>
                      </td>
                      <td className="max-w-[18rem] px-3 py-3 align-top"><Details item={i} /></td>
                      <td className="px-3 py-3 align-top"><Actions item={i} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 p-3 lg:hidden">
              {items.map((i) => (
                <li key={`${i.rule}:${i.referenceId}`} className={cn('rounded-lg border p-3', i.severity === 'critical' ? 'border-red-200 bg-red-50/70' : 'border-gray-200')}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{i.description}</p>
                    <SeverityBadge severity={i.severity} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{serviceLabel(i.service)} · stuck {formatMinutes(i.minutesStuck)}</p>
                  <div className="mt-1 text-xs"><CustomerCell customer={i.customer} /></div>
                  <div className="mt-2"><Details item={i} /></div>
                  <div className="mt-2"><Actions item={i} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </AuditPageShell>
  )
}
