// API Health (§4.4 / §5.8): KPIs, status-class bar, supplier health, slowest operations, top errors
// and "needs attention now" from GET /api-logs/stats. Every number is text; every clickable thing
// is a real link to the filtered API Logs list.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { API_STATUS_CLASS_META, apiSupplierLabel, formatApiDuration, type ApiStatusClassKey } from '../../audit'
import type { ApiLogStats } from '../../auditTypes'
import { AuditEmpty } from '../audit/AuditUI'
import { ApiLogList } from './ApiLogList'
import { apiLogsHref } from './ApiBits'

type Params = Record<string, string | number | undefined>

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 1000) / 10}%` : '—')
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString()

/** Failure-rate badge: always text ("0.7% failed"), tinted by how bad it is. */
function FailureBadge({ percent }: { percent: number }) {
  const tone =
    percent >= 5 ? 'bg-red-50 text-red-800 ring-red-200' : percent >= 1 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-green-50 text-green-800 ring-green-200'
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset', tone)}>
      {Math.round(percent * 10) / 10}% failed
    </span>
  )
}

function AttentionBadge({ count }: { count: number }) {
  if (!count) return <span className="tabular-nums text-gray-500">0</span>
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-800 ring-1 ring-inset ring-violet-200">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {count.toLocaleString()} need attention
    </span>
  )
}

function Kpi({ label, value, sub, to, tone }: { label: string; value: string; sub?: string; to?: string; tone?: 'attention' | 'bad' }) {
  const body = (
    <>
      <p className={cn('text-xs', tone === 'attention' ? 'font-medium text-violet-800' : 'text-gray-500')}>{label}</p>
      <p className={cn('break-words text-2xl font-bold tabular-nums', tone === 'attention' ? 'text-violet-800' : tone === 'bad' ? 'text-red-700' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </>
  )
  const cls = cn(
    'block min-h-[88px] min-w-0 rounded-xl border px-3 py-3 shadow-sm',
    tone === 'attention' ? 'border-violet-200 bg-violet-50' : 'border-gray-200 bg-white'
  )
  if (!to) return <div className={cls}>{body}</div>
  return (
    <Link to={to} className={cn(cls, 'hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500')}>
      {body}
    </Link>
  )
}

const CLASS_ORDER: ApiStatusClassKey[] = ['2xx', '3xx', '4xx', '5xx', 'none']

function StatusClassBar({ stats, href }: { stats: ApiLogStats; href: (p: Params) => string }) {
  const keys: ApiStatusClassKey[] = (stats.byStatusClass['1xx'] ?? 0) > 0 ? ['1xx', ...CLASS_ORDER] : CLASS_ORDER
  const segments = keys.map((k) => ({ key: k, value: stats.byStatusClass[k] ?? 0, meta: API_STATUS_CLASS_META[k] }))
  const total = segments.reduce((s, x) => s + x.value, 0)
  const label = (k: ApiStatusClassKey) => (k === 'none' ? 'No answer' : `${k} ${API_STATUS_CLASS_META[k].label}`)
  // 1xx isn't a list filter value; it opens the unfiltered range.
  const linkFor = (k: ApiStatusClassKey) => href(k === '1xx' ? {} : { statusClass: k })

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Status codes</h2>
      {!total ? (
        <p className="py-2 text-sm text-gray-500">No responses in this range.</p>
      ) : (
        <>
          {/* Mouse shortcut; the legend below is the keyboard / screen-reader path. */}
          <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            {segments.filter((s) => s.value > 0).map((s) => (
              <Link
                key={s.key}
                to={linkFor(s.key)}
                tabIndex={-1}
                title={`${label(s.key)}: ${s.value.toLocaleString()} (${pct(s.value, total)})`}
                className="h-full min-w-1 hover:opacity-80"
                style={{ width: `${(s.value / total) * 100}%`, background: s.meta.colour }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {segments.map((s) => (
              <li key={s.key} className="min-w-0">
                <Link
                  to={linkFor(s.key)}
                  aria-label={`${label(s.key)}: ${s.value.toLocaleString()} calls, ${pct(s.value, total)} — show in API Logs`}
                  className={cn(
                    'flex min-h-11 w-full flex-col rounded-lg border border-gray-100 px-2.5 py-1.5 hover:border-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    !s.value && 'opacity-60'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.meta.colour }} aria-hidden="true" />
                    <span className="truncate">{label(s.key)}</span>
                  </span>
                  <span className="text-base font-bold tabular-nums text-gray-900">
                    {s.value.toLocaleString()} <span className="text-xs font-normal text-gray-500">{pct(s.value, total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/** Card with a title; `table` shows on lg+, `cards` below. */
function Panel({ title, sub, empty, isEmpty, table, cards }: { title: string; sub?: ReactNode; empty: string; isEmpty: boolean; table: ReactNode; cards: ReactNode }) {
  return (
    <Card padding="none" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
      {isEmpty ? (
        <p className="px-4 py-6 text-sm text-gray-500">{empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">{table}</div>
          <ul className="divide-y divide-gray-100 lg:hidden">{cards}</ul>
        </>
      )}
    </Card>
  )
}

const th = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500'
const thNum = `${th} text-right`
const td = 'px-4 py-2.5'
const tdNum = 'px-4 py-2.5 text-right tabular-nums'
/** Whole row clickable via a stretched link in the first cell (one tab stop per row). */
const rowCls = 'relative hover:bg-indigo-50/40 focus-within:bg-indigo-50/40'
const stretched = 'after:absolute after:inset-0 after:content-[""] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-indigo-500'
const cardLink = 'flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500'

/** Top error → list link. VeloxVerse groups by error code or HTTP status: a 3-digit status opens the
 * list filtered by that status; a route-looking key opens it by route; any other error code (not a
 * list filter) opens all errors in the range. */
export function topErrorParams(error: string): Params {
  const e = error.trim()
  if (/^\d{3}$/.test(e)) return { statusCode: Number(e) }
  if (/^(GET|POST|PUT|PATCH|DELETE)?\s*\//i.test(e)) return { route: e }
  return { errorsOnly: 'true' }
}

export function ApiHealth({ stats, direction }: { stats: ApiLogStats; direction?: string }) {
  // Click-throughs keep the range and direction the health view is showing.
  const href = (p: Params) => apiLogsHref({ from: stats.from, to: stats.to, direction, ...p })
  const total = stats.total
  const ok = stats.byOutcome.success ?? 0
  const errors = (stats.byStatusClass['4xx'] ?? 0) + (stats.byStatusClass['5xx'] ?? 0)
  const attention = (stats.byOutcome.unknown ?? 0) + (stats.byOutcome.timeout ?? 0)
  const noAnswer = stats.byStatusClass.none ?? 0

  if (!total) {
    return (
      <Card>
        <AuditEmpty title="No API calls in this range" text="Try a longer range, or check that API logging is turned on in Settings." />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total calls" value={n(total)} to={href({})} />
        <Kpi label="Success" value={pct(ok, total)} sub={`${n(ok)} calls`} to={href({ outcome: 'success' })} />
        <Kpi label="Errors (4xx + 5xx)" value={n(errors)} sub={pct(errors, total)} to={href({ statusClass: '4xx,5xx' })} tone={errors ? 'bad' : undefined} />
        <Kpi label="Needs attention" value={n(attention)} sub="Unknown outcome or timed out" to={href({ outcome: 'unknown,timeout' })} tone={attention ? 'attention' : undefined} />
        <Kpi label="No answer" value={n(noAnswer)} sub={pct(noAnswer, total)} to={href({ statusClass: 'none' })} />
      </div>

      <StatusClassBar stats={stats} href={href} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Supplier health"
          sub="Click a supplier to see its calls"
          isEmpty={!stats.suppliers.length}
          empty="No supplier calls in this range."
          table={
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th scope="col" className={th}>Supplier</th>
                  <th scope="col" className={thNum}>Calls</th>
                  <th scope="col" className={thNum}>Failed</th>
                  <th scope="col" className={thNum}>Failure %</th>
                  <th scope="col" className={th}>Needs attention</th>
                  <th scope="col" className={thNum}>p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.suppliers.map((s) => (
                  <tr key={s.supplier} className={rowCls}>
                    <td className={cn(td, 'font-medium text-gray-900')}>
                      <Link to={href({ supplier: s.supplier })} className={stretched}>{apiSupplierLabel(s.supplier)}</Link>
                    </td>
                    <td className={tdNum}>{n(s.calls)}</td>
                    <td className={tdNum}>{n(s.failed)}</td>
                    <td className={cn(td, 'text-right')}><FailureBadge percent={s.failureRatePercent} /></td>
                    <td className={td}><AttentionBadge count={s.needsAttention} /></td>
                    <td className={tdNum}>{formatApiDuration(s.p95Ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={stats.suppliers.map((s) => (
            <li key={s.supplier}>
              <Link to={href({ supplier: s.supplier })} className={cardLink}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{apiSupplierLabel(s.supplier)}</span>
                    <FailureBadge percent={s.failureRatePercent} />
                    {s.needsAttention > 0 && <AttentionBadge count={s.needsAttention} />}
                  </div>
                  <p className="mt-0.5 text-sm tabular-nums text-gray-600">
                    {n(s.calls)} calls · {n(s.failed)} failed · p95 {formatApiDuration(s.p95Ms)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        />

        <Panel
          title="Top errors"
          sub="Top 10 by count"
          isEmpty={!stats.topErrors.length}
          empty="No errors in this range."
          table={
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th scope="col" className={th}>Error / HTTP status</th>
                  <th scope="col" className={th}>Latest message</th>
                  <th scope="col" className={thNum}>Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.topErrors.map((t, i) => (
                  <tr key={`${t.error}-${i}`} className={rowCls}>
                    <td className={cn(td, 'whitespace-nowrap font-mono text-xs font-semibold text-red-700')}>
                      <Link to={href(topErrorParams(t.error))} className={stretched}>{t.error}</Link>
                    </td>
                    <td className={cn(td, 'text-gray-700')}><span className="line-clamp-2 break-words">{t.message ?? '—'}</span></td>
                    <td className={cn(tdNum, 'font-semibold')}>{n(t.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          cards={stats.topErrors.map((t, i) => (
            <li key={`${t.error}-${i}`}>
              <Link to={href(topErrorParams(t.error))} className={cardLink}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs font-semibold text-red-700">{t.error}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">× {n(t.count)}</span>
                  </div>
                  {t.message && <p className="mt-0.5 line-clamp-2 break-words text-sm text-gray-600">{t.message}</p>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
        />
      </div>

      <Panel
        title="Slowest operations"
        sub="Top 10 by p95"
        isEmpty={!stats.slowest.length}
        empty="No timed calls in this range."
        table={
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th scope="col" className={th}>Operation</th>
                <th scope="col" className={th}>Method</th>
                <th scope="col" className={thNum}>Calls</th>
                <th scope="col" className={thNum}>p95</th>
                <th scope="col" className={thNum}>Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.slowest.map((s, i) => (
                <tr key={`${s.operation}-${i}`} className={rowCls}>
                  <td className={cn(td, 'max-w-[28rem] font-mono text-xs text-gray-900')}>
                    <Link to={href({ route: s.operation })} className={cn(stretched, 'break-all')} title={s.operation}>{s.operation}</Link>
                  </td>
                  <td className={cn(td, 'font-mono text-xs font-semibold text-gray-700')}>{s.method ?? '—'}</td>
                  <td className={tdNum}>{n(s.calls)}</td>
                  <td className={tdNum}>{formatApiDuration(s.p95Ms)}</td>
                  <td className={tdNum}>{formatApiDuration(s.maxMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        cards={stats.slowest.map((s, i) => (
          <li key={`${s.operation}-${i}`}>
            <Link to={href({ route: s.operation })} className={cardLink}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-all font-mono text-xs text-gray-900">
                  {s.method && <span className="font-semibold">{s.method} </span>}
                  {s.operation}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-gray-600">
                  {n(s.calls)} calls · p95 {formatApiDuration(s.p95Ms)} · max {formatApiDuration(s.maxMs)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
            </Link>
          </li>
        ))}
      />

      <Card padding="none" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Needs attention now</h2>
            <p className="text-xs text-gray-500">Latest calls with an unknown outcome or no answer in time.</p>
          </div>
          {attention > 0 && (
            <Link
              to={href({ outcome: 'unknown,timeout' })}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 md:min-h-9"
            >
              View all {n(attention)} <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        {stats.needsAttention.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Nothing needs attention in this range.</p>
        ) : (
          <ApiLogList logs={stats.needsAttention} />
        )}
      </Card>
    </div>
  )
}
