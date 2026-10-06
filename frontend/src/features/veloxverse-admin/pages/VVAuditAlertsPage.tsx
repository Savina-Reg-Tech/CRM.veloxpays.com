import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellOff, MailWarning } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useVVAuditAlerts, useVVAuditMeta } from '../hooks/useVVAudit'
import { alertTypeLabel, serviceLabel, supplierLabel } from '../audit'
import type { AuditAlert } from '../auditTypes'
import { AuditEmpty, AuditErrorState, AuditPageShell, AuditTime, SeverityBadge, selectClass, useAuditViewer } from '../components/audit/AuditUI'

const AUDIT = '/dashboard/veloxverse/audit-logs'
type Tab = 'open' | 'resolved' | 'all' | 'digests'

/** Alerts VeloxVerse raised and emailed (§7.10). daily_digest rows are "digest sent" markers,
 * not incidents, so they live in their own tab. */
export default function VVAuditAlertsPage() {
  const navigate = useNavigate()
  const meta = useVVAuditMeta()
  const { isAdmin } = useAuditViewer()
  const [tab, setTab] = useState<Tab>('open')
  const [type, setType] = useState('')
  const query = useVVAuditAlerts({
    status: tab === 'digests' ? 'all' : tab,
    type: tab === 'digests' ? 'daily_digest' : type || undefined,
    limit: 500,
  })
  const alerts = useMemo(
    () => (query.data?.alerts ?? []).filter((a) => (tab === 'digests' ? a.type === 'daily_digest' : a.type !== 'daily_digest')),
    [query.data, tab]
  )

  const openEvents = (a: AuditAlert) => {
    const p = new URLSearchParams({ from: a.firstSeenAt, to: new Date(new Date(a.lastSeenAt).getTime() + 1000).toISOString() })
    if (a.service) p.set('service', a.service)
    if (a.supplier) p.set('supplier', a.supplier)
    if (a.errorCode) p.set('errorCode', a.errorCode)
    navigate(`${AUDIT}?${p.toString()}`)
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'open', label: `Open${query.data && tab === 'open' ? ` (${alerts.length})` : ''}` },
    { key: 'resolved', label: 'Resolved' },
    { key: 'all', label: 'All' },
    { key: 'digests', label: 'Digests' },
  ]

  return (
    <AuditPageShell
      title={
        <span className="flex items-center gap-2">
          Alerts {query.data && query.data.openCount > 0 && <Badge variant="danger">{query.data.openCount} open</Badge>}
        </span>
      }
      subtitle="Problems VeloxVerse detected and emailed about. Click an alert to see the events behind it."
    >
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium', tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {t.label}
          </button>
        ))}
        {tab !== 'digests' && (
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(selectClass, 'w-48')} aria-label="Alert type">
            <option value="">All types</option>
            {(meta.data?.alertTypes ?? []).filter((t) => t !== 'daily_digest').map((t) => <option key={t} value={t}>{alertTypeLabel(t)}</option>)}
          </select>
        )}
      </div>

      <Card padding="none">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" label="Loading alerts…" /></div>
        ) : query.isError ? (
          <AuditErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : alerts.length === 0 ? (
          <AuditEmpty icon={BellOff} title={tab === 'open' ? 'No open alerts' : 'No alerts'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Alert</th>
                  <th className="px-3 py-2.5">About</th>
                  <th className="px-3 py-2.5">First seen</th>
                  <th className="px-3 py-2.5">Last seen</th>
                  <th className="px-3 py-2.5 text-right">Times</th>
                  <th className="px-3 py-2.5">Emailed to</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alerts.map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => openEvents(a)}
                    onKeyDown={(k) => k.key === 'Enter' && openEvents(a)}
                    className={cn('cursor-pointer hover:bg-indigo-50/40', !a.resolvedAt && a.severity === 'critical' && 'bg-red-50/60')}
                  >
                    <td className="px-3 py-2.5 align-top"><SeverityBadge severity={a.severity} /></td>
                    <td className="max-w-[18rem] px-3 py-2.5 align-top">
                      <p className="font-medium text-gray-900">{a.subject}</p>
                      <p className="text-xs text-gray-500">{alertTypeLabel(a.type)}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs text-gray-700">
                      {a.service && <p>{serviceLabel(a.service)}</p>}
                      {a.supplier && <p>{supplierLabel(a.supplier)}</p>}
                      {a.errorCode && <p className="font-mono text-red-700">{a.errorCode}</p>}
                      {!a.service && !a.supplier && !a.errorCode && '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs"><AuditTime iso={a.firstSeenAt} /></td>
                    <td className="px-3 py-2.5 align-top text-xs"><AuditTime iso={a.lastSeenAt} /></td>
                    <td className="px-3 py-2.5 text-right align-top font-semibold tabular-nums">{a.occurrenceCount.toLocaleString()}</td>
                    <td className="max-w-[14rem] px-3 py-2.5 align-top text-xs">
                      {a.recipients.length ? (
                        <span className="break-words text-gray-700">{a.recipients.join(', ')}</span>
                      ) : (
                        <span className="inline-flex items-start gap-1 text-amber-700">
                          <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            No one received this alert
                            {isAdmin && (
                              <> — <Link to={`${AUDIT}/settings`} onClick={(e) => e.stopPropagation()} className="underline">add recipients</Link></>
                            )}
                          </span>
                        </span>
                      )}
                      {a.lastSentAt && <span className="block text-gray-400">last sent <AuditTime iso={a.lastSentAt} /></span>}
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs">
                      {a.resolvedAt ? (
                        <span className="text-emerald-700">Resolved <AuditTime iso={a.resolvedAt} /></span>
                      ) : (
                        <Badge variant="danger">Open</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AuditPageShell>
  )
}
