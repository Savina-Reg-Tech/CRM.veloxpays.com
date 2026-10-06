import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useVVAuditAlerts, useVVAuditErrors, useVVAuditMeta } from '../hooks/useVVAudit'
import { SEVERITIES, SEVERITY_COLOUR, lastHours, serviceLabel, sortedCounts, supplierLabel } from '../audit'
import { AuditErrorState, AuditPageShell, AuditTime, MultiSelect } from '../components/audit/AuditUI'
import { BarList, CATEGORICAL, SegmentBar } from '../components/audit/AuditCharts'

const AUDIT = '/dashboard/veloxverse/audit-logs'
const RANGES = [
  { key: 1, label: '1 hour' },
  { key: 24, label: '24 hours' },
  { key: 168, label: '7 days' },
]

/** Live error counts for a range (§7.8). Every bucket opens the event list with that filter. */
export default function VVAuditErrorsPage() {
  const navigate = useNavigate()
  const meta = useVVAuditMeta()
  const [hours, setHours] = useState(24)
  const [range, setRange] = useState(() => lastHours(24))
  const [services, setServices] = useState<string[]>([])
  const summary = useVVAuditErrors({ ...range, service: services })
  const alerts = useVVAuditAlerts({ status: 'open' })
  const openAlerts = (alerts.data?.alerts ?? []).filter((a) => a.type !== 'daily_digest').length
  const colourOf = (s: string) => meta.data?.severities.find((x) => x.value === s)?.colour ?? SEVERITY_COLOUR[s as keyof typeof SEVERITY_COLOUR]

  const openList = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ from: range.from, to: range.to, status: 'failure', ...extra })
    if (services.length && !extra.service) p.set('service', services.join(','))
    navigate(`${AUDIT}?${p.toString()}`)
  }

  const d = summary.data
  const supplierOrder = meta.data?.suppliers ?? []

  return (
    <AuditPageShell title="Errors" subtitle="Every error customers hit — API, supplier, payment, webhook, browser and downtime.">
      {openAlerts > 0 && (
        <Link to={`${AUDIT}/alerts`} className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100">
          <BellRing className="h-4 w-4" /> {openAlerts} open alert{openAlerts === 1 ? '' : 's'} — view
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              setHours(r.key)
              setRange(lastHours(r.key))
            }}
            className={cn('rounded-full px-3 py-1 text-xs font-medium', hours === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            Last {r.label}
          </button>
        ))}
        <div className="w-52"><MultiSelect label="Service" options={meta.data?.services ?? []} value={services} onChange={setServices} format={serviceLabel} /></div>
        {d && <span className="ml-auto text-xs text-gray-400"><AuditTime iso={d.from} /> → <AuditTime iso={d.to} /></span>}
      </div>

      {summary.isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" label="Loading errors…" /></div>
      ) : summary.isError || !d ? (
        <Card><AuditErrorState error={summary.error} onRetry={() => void summary.refetch()} /></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Errors by severity</h2>
              <button type="button" onClick={() => openList({})} className="text-2xl font-bold tabular-nums text-gray-900 hover:text-indigo-700">
                {d.total.toLocaleString()} <span className="text-sm font-normal text-gray-500">total</span>
              </button>
            </div>
            <div className="mt-3">
              <SegmentBar
                segments={SEVERITIES.map((s) => ({ key: s, label: s, value: d.bySeverity[s] ?? 0, colour: colourOf(s) }))}
                onSelect={(s) => openList({ severity: s })}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">By service</h2>
              <BarList items={sortedCounts(d.byService).map(([k, v]) => ({ key: k, label: serviceLabel(k), value: v }))} onSelect={(k) => openList({ service: k })} />
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">By supplier</h2>
              <BarList
                items={sortedCounts(d.bySupplier).map(([k, v]) => ({
                  key: k,
                  label: k === 'none' ? 'No supplier (our API / browser)' : supplierLabel(k),
                  value: v,
                  colour: k === 'none' ? '#9ca3af' : CATEGORICAL[Math.max(0, supplierOrder.indexOf(k)) % CATEGORICAL.length],
                }))}
                onSelect={(k) => (k === 'none' ? openList({}) : openList({ supplier: k }))}
              />
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">By HTTP status</h2>
              <BarList
                items={sortedCounts(d.byHttpStatusClass).map(([k, v]) => ({ key: k, label: k === 'none' ? 'No HTTP status' : k, value: v, colour: k === 'none' ? '#9ca3af' : undefined }))}
                // /events filters by exact status only, so a class ("4xx") opens all errors in range.
                onSelect={(k) => openList(/^\d{3}$/.test(k) ? { httpStatus: k } : {})}
              />
            </Card>
          </div>

          <Card padding="none">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Top errors</h2>
            {d.topErrors.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">No errors in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5">Error code</th>
                      <th className="px-4 py-2.5">Message</th>
                      <th className="px-4 py-2.5 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {d.topErrors.map((t, i) => (
                      <tr
                        key={`${t.errorCode}-${i}`}
                        tabIndex={0}
                        onClick={() => t.errorCode && openList({ errorCode: t.errorCode })}
                        onKeyDown={(k) => k.key === 'Enter' && t.errorCode && openList({ errorCode: t.errorCode })}
                        className={cn(t.errorCode && 'cursor-pointer hover:bg-indigo-50/40')}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-red-700">{t.errorCode ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700"><span className="line-clamp-2 break-words">{t.message ?? '—'}</span></td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{t.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </AuditPageShell>
  )
}
