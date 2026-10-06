import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useVVAuditFunnel, useVVAuditMeta, useVVAuditSummaries } from '../hooks/useVVAudit'
import { SEVERITIES, SEVERITY_COLOUR, humanize, serviceLabel, sortedCounts, splitHttpStatus, supplierLabel, utcDay } from '../audit'
import type { AuditDailySummary } from '../auditTypes'
import { AuditEmpty, AuditErrorState, AuditPageShell, selectClass } from '../components/audit/AuditUI'
import { BarList, CATEGORICAL, Funnel, LineChart, StackedBars } from '../components/audit/AuditCharts'

const PRESETS = [7, 30, 90, 365]

function ChartCard({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
      {children}
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums text-gray-900', tone)}>{value}</p>
    </div>
  )
}

const sum = (rows: AuditDailySummary[], f: (r: AuditDailySummary) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0)

/** Daily trends from VeloxVerse's daily summaries — UTC days, up to a year (§7.9). */
export default function VVAuditTrendsPage() {
  const meta = useVVAuditMeta()
  const [days, setDays] = useState(30)
  const [service, setService] = useState('all')
  const from = utcDay(days)
  const to = utcDay(0)
  const query = useVVAuditSummaries({ from, to, service })
  const funnel = useVVAuditFunnel({
    service: service === 'all' ? undefined : service,
    from: `${from}T00:00:00.000Z`,
    to: new Date().toISOString().slice(0, 13) + ':00:00.000Z',
  })
  const rows = useMemo(() => query.data ?? [], [query.data])
  const [selectedDay, setSelectedDay] = useState<string>('')
  useEffect(() => {
    if (rows.length && !rows.some((r) => r.date === selectedDay)) setSelectedDay(rows[rows.length - 1].date)
  }, [rows, selectedDay])
  const day = rows.find((r) => r.date === selectedDay)

  const dates = rows.map((r) => r.date)
  const suppliers = useMemo(() => {
    const order = meta.data?.suppliers ?? []
    const present = new Set(rows.flatMap((r) => Object.keys(r.supplierLatency ?? {})))
    return [...order.filter((s) => present.has(s)), ...[...present].filter((s) => !order.includes(s))]
  }, [rows, meta.data])
  const supplierColour = (s: string) => CATEGORICAL[Math.max(0, (meta.data?.suppliers ?? []).indexOf(s)) % CATEGORICAL.length]

  const started = sum(rows, (r) => r.journeysStarted)
  const completed = sum(rows, (r) => r.journeysCompleted)
  const summaryRetention = meta.data?.summaryRetentionDays ?? 365

  return (
    <AuditPageShell
      title="Daily trends"
      subtitle={`One row per UTC day, kept ${summaryRetention} days. A day's summary appears about an hour after midnight UTC.`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.filter((p) => p <= summaryRetention).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setDays(p)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium', days === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {p === 365 ? '1 year' : `${p} days`}
          </button>
        ))}
        <select value={service} onChange={(e) => setService(e.target.value)} className={cn(selectClass, 'w-56')} aria-label="Service">
          <option value="all">All services</option>
          {(meta.data?.services ?? []).map((s) => <option key={s} value={s}>{serviceLabel(s)}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400">Days are UTC</span>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" label="Loading trends…" /></div>
      ) : query.isError ? (
        <Card><AuditErrorState error={query.error} onRetry={() => void query.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card><AuditEmpty title="No daily summaries in this range" text="Summaries start from when the audit log went live, and are kept for the configured number of days." /></Card>
      ) : (
        <>
          {rows.length < days && (
            <p className="text-xs text-gray-500">{rows.length} of {days} days have a summary — days without one had no data.</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Events" value={sum(rows, (r) => r.totalEvents).toLocaleString()} />
            <Stat label="Journeys started" value={started.toLocaleString()} />
            <Stat label="Completed" value={`${completed.toLocaleString()}${started ? ` · ${Math.round((completed / started) * 1000) / 10}%` : ''}`} />
            <Stat label="Errors" value={sum(rows, (r) => r.totalErrors).toLocaleString()} tone={sum(rows, (r) => r.totalErrors) ? 'text-red-600' : undefined} />
            <Stat label="Paid but not booked" value={sum(rows, (r) => r.paymentFailures?.paidNotBooked ?? 0).toLocaleString()} tone={sum(rows, (r) => r.paymentFailures?.paidNotBooked ?? 0) ? 'text-red-600' : undefined} />
            <Stat label="Downtime" value={`${sum(rows, (r) => r.downtimeMinutes).toLocaleString()} min`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Activity">
              <LineChart
                days={dates}
                series={[
                  { key: 'events', label: 'Events', colour: CATEGORICAL[0], values: rows.map((r) => r.totalEvents) },
                ]}
              />
            </ChartCard>
            <ChartCard title="Customers & guests">
              <LineChart
                days={dates}
                series={[
                  { key: 'customers', label: 'Customers', colour: CATEGORICAL[0], values: rows.map((r) => r.uniqueCustomers) },
                  { key: 'guests', label: 'Guests', colour: CATEGORICAL[1], values: rows.map((r) => r.uniqueGuests) },
                ]}
              />
            </ChartCard>
            <ChartCard title="Journeys started vs completed" sub={started ? `${Math.round((completed / started) * 1000) / 10}% conversion` : undefined}>
              <LineChart
                days={dates}
                series={[
                  { key: 'started', label: 'Started', colour: CATEGORICAL[0], values: rows.map((r) => r.journeysStarted) },
                  { key: 'completed', label: 'Completed', colour: CATEGORICAL[2], values: rows.map((r) => r.journeysCompleted) },
                ]}
              />
            </ChartCard>
            <ChartCard title="Errors by severity">
              <StackedBars
                days={dates}
                series={SEVERITIES.filter((s) => s !== 'info').map((s) => ({
                  key: s,
                  label: humanize(s),
                  colour: meta.data?.severities.find((x) => x.value === s)?.colour ?? SEVERITY_COLOUR[s],
                  values: rows.map((r) => r.errorsBySeverity?.[s] ?? 0),
                }))}
              />
            </ChartCard>
            <ChartCard title="Problems">
              <LineChart
                days={dates}
                series={[
                  { key: 'bookingFailures', label: 'Booking failures', colour: CATEGORICAL[0], values: rows.map((r) => r.bookingFailures) },
                  { key: 'declines', label: 'Payment declines', colour: CATEGORICAL[1], values: rows.map((r) => r.paymentFailures?.declines ?? 0) },
                  { key: 'stuck', label: 'Stuck journeys', colour: CATEGORICAL[2], values: rows.map((r) => r.stuckJourneys) },
                  { key: 'paidNotBooked', label: 'Paid not booked', colour: CATEGORICAL[3], values: rows.map((r) => r.paymentFailures?.paidNotBooked ?? 0) },
                ]}
              />
            </ChartCard>
            <ChartCard title="Downtime" sub={`${sum(rows, (r) => r.downtimeIncidents)} incidents`}>
              <LineChart days={dates} unit=" min" series={[{ key: 'downtime', label: 'Downtime minutes', colour: CATEGORICAL[7], values: rows.map((r) => r.downtimeMinutes) }]} />
            </ChartCard>
            <ChartCard title="Supplier latency (p95)">
              {suppliers.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No supplier calls in this range.</p>
              ) : (
                <LineChart
                  days={dates}
                  unit=" ms"
                  series={suppliers.map((s) => ({ key: s, label: supplierLabel(s), colour: supplierColour(s), values: rows.map((r) => r.supplierLatency?.[s]?.p95Ms ?? 0) }))}
                />
              )}
            </ChartCard>
            <ChartCard title={`Conversion funnel — ${service === 'all' ? 'all services' : serviceLabel(service)}`} sub="% of journeys that started checkout">
              {funnel.isLoading ? (
                <div className="flex justify-center py-8"><Spinner size="sm" /></div>
              ) : funnel.isError || !funnel.data ? (
                <AuditErrorState error={funnel.error} onRetry={() => void funnel.refetch()} />
              ) : (
                <Funnel
                  steps={funnel.data.steps.map((s) => ({ step: s.step, label: humanize(s.step), journeys: s.journeys, events: s.events, conversion: s.conversionFromCheckout }))}
                />
              )}
            </ChartCard>
          </div>

          {/* Selected day */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Day detail</h2>
              <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className={cn(selectClass, 'w-48')} aria-label="Day">
                {[...rows].reverse().map((r) => <option key={r.date} value={r.date}>{r.date} (UTC)</option>)}
              </select>
            </div>
            {day && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Top errors</h3>
                  {day.topErrors.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                    <ul className="space-y-1.5 text-sm">
                      {day.topErrors.map((t, i) => (
                        <li key={i} className="flex items-start justify-between gap-3">
                          <span className="min-w-0"><span className="font-mono text-xs font-semibold text-red-700">{t.errorCode ?? '—'}</span> <span className="break-words text-gray-700">{t.message}</span></span>
                          <span className="font-semibold tabular-nums">{t.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Top failing routes</h3>
                  {day.topFailingRoutes.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
                    <ul className="space-y-1.5 text-sm">
                      {day.topFailingRoutes.map((r, i) => (
                        <li key={i} className="flex items-start justify-between gap-3">
                          <span className="min-w-0 break-all font-mono text-xs text-gray-700">{r.route} <span className="text-gray-400">· {r.httpStatus ?? '—'}</span></span>
                          <span className="font-semibold tabular-nums">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Errors by HTTP status</h3>
                  {(() => {
                    const { codes, classes } = splitHttpStatus(day.errorsByHttpStatus)
                    return (
                      <div className="space-y-2">
                        <BarList items={classes.map(([k, v]) => ({ key: k, label: k, value: v }))} empty="None" />
                        {codes.length > 0 && <p className="text-xs text-gray-500">Exact: {codes.map(([k, v]) => `${k} × ${v}`).join(' · ')}</p>}
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Errors by supplier</h3>
                  <BarList items={sortedCounts(day.errorsBySupplier).map(([k, v]) => ({ key: k, label: supplierLabel(k), value: v, colour: supplierColour(k) }))} empty="None" />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Payments</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Declines" value={day.paymentFailures?.declines ?? 0} />
                    <Stat label="Paid not booked" value={day.paymentFailures?.paidNotBooked ?? 0} tone={day.paymentFailures?.paidNotBooked ? 'text-red-600' : undefined} />
                    <Stat label="Refund failures" value={day.paymentFailures?.refundFailures ?? 0} />
                  </div>
                  {sortedCounts(day.paymentFailures?.byDeclineCode).length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">Decline codes: {sortedCounts(day.paymentFailures.byDeclineCode).map(([k, v]) => `${k} × ${v}`).join(' · ')}</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Stuck & browser errors</h3>
                  {Object.keys(day.stuckByRule ?? {}).length === 0 ? (
                    <p className="text-sm text-gray-400">No stuck snapshot for this day.</p>
                  ) : (
                    <BarList items={sortedCounts(day.stuckByRule).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: meta.data?.stuckRules.find((r) => r.key === k)?.description ?? humanize(k), value: v }))} empty="Nobody stuck" />
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Browser network errors: {day.frontendErrors?.networkErrors ?? 0}
                    {sortedCounts(day.frontendErrors?.byStep).length > 0 && ` · ${sortedCounts(day.frontendErrors.byStep).map(([k, v]) => `${humanize(k)} × ${v}`).join(' · ')}`}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </AuditPageShell>
  )
}
