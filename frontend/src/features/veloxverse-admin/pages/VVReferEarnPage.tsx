import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  Gift,
  Pencil,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import StatTile from '../components/StatTile'
import { BarChart } from '../components/Charts'
import ReferralRewardsConfig from '../components/ReferralRewardsConfig'
import {
  useVVReferralCodes,
  useVVReferralOverview,
  useVVReferrals,
  useVVUpdateReferralCode,
} from '../hooks/useVVReferrals'
import { vvReferralService } from '../vvAdminService'
import { ANALYTICS_CURRENCIES, formatDate, formatDateTime } from '../utils'
import { downloadCsv, fetchAllPages } from '../csv'
import {
  REFERRAL_STATUS,
  REFERRAL_STATUS_FILTERS,
  formatPoints,
  personLabel,
  pointsValueLabel,
  referralsToCsv,
} from '../referral'
import type {
  AdminReferralCode,
  ReferralCodeFilters,
  ReferralDisplayStatus,
  ReferralListFilters,
  ReferralParty,
  ReferralRow,
} from '../types'

const PAGE_SIZE = 25
const TABS = ['overview', 'referrals', 'codes', 'config'] as const
type Tab = (typeof TABS)[number]

// `text-base` below `sm` keeps iOS Safari from zooming the page when a filter gets focus.
const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm'

/** Patch the URL query string; any change other than a page change returns to page 1 (`pageKey`). */
function useQueryPatch(pageKey: string) {
  const [, setParams] = useSearchParams()
  return useCallback(
    (patch: Record<string, string | undefined>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v)
            else next.delete(k)
          }
          if (!(pageKey in patch)) next.delete(pageKey)
          return next
        },
        { replace: true }
      ),
    [setParams, pageKey]
  )
}

/** A search box that writes to the URL 300ms after typing stops. */
function DebouncedSearch({
  value,
  onCommit,
  placeholder,
}: {
  value: string
  onCommit: (v: string | undefined) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const t = setTimeout(() => onCommit(draft.trim() || undefined), 300)
    return () => clearTimeout(t)
  }, [draft, value, onCommit])
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder}
      leftIcon={<Search className="h-4 w-4" />}
      className="h-10 text-base sm:text-sm"
      aria-label={placeholder}
    />
  )
}

function StatusBadge({ status }: { status: ReferralDisplayStatus }) {
  const s = REFERRAL_STATUS[status] ?? { label: status, variant: 'neutral' as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <p className="text-sm text-gray-600">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** A referral side: who, their currency, and their points in force (valued in that same currency). */
function PartyCell({ party, compact = false }: { party: ReferralParty; compact?: boolean }) {
  const worth = pointsValueLabel(party.value)
  return (
    <div className="min-w-0">
      <Link
        to={`/dashboard/veloxverse/users/${party.id}`}
        className="block truncate font-medium text-gray-900 hover:text-indigo-600"
      >
        {personLabel(party)}
      </Link>
      {party.name && !compact && <p className="truncate text-xs text-gray-500">{party.email}</p>}
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
        <span className="rounded bg-gray-100 px-1.5 py-px font-medium text-gray-600">{party.currency}</span>
        <span className="font-medium text-gray-800">{formatPoints(party.pointsInForce)}</span>
        {worth && party.pointsInForce > 0 && <span className="text-emerald-700">{worth}</span>}
        {!party.isActive && <span className="text-red-600">· blocked</span>}
      </p>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────

const PERIODS = [7, 30, 90, 365] as const
const TREND_METRICS = [
  { key: 'referrals', label: 'New referrals' },
  { key: 'rewarded', label: 'Rewarded' },
  { key: 'reversed', label: 'Reversed' },
] as const

function OverviewTab({ onOpenReferrals }: { onOpenReferrals: (status?: string) => void }) {
  const [params] = useSearchParams()
  const patch = useQueryPatch('page')
  const days = PERIODS.includes(Number(params.get('days')) as (typeof PERIODS)[number]) ? Number(params.get('days')) : 30
  const { data, isLoading, isError, error, refetch, isFetching } = useVVReferralOverview(days)
  const [metric, setMetric] = useState<(typeof TREND_METRICS)[number]['key']>('referrals')

  const periodPicker = (
    <select
      className={cn(selectClass, 'sm:w-44')}
      value={days}
      onChange={(e) => patch({ days: e.target.value === '30' ? undefined : e.target.value })}
      aria-label="Period"
    >
      {PERIODS.map((d) => (
        <option key={d} value={d}>
          Last {d === 365 ? '12 months' : `${d} days`}
        </option>
      ))}
    </select>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (isError || !data) return <ErrorState message={errorMessage(error, 'Could not load the overview.')} onRetry={() => refetch()} />

  const t = data.totals
  const trendPoints = data.trend.map((d) => ({ label: d.date, value: d[metric] }))

  return (
    <div className={cn('space-y-4', isFetching && 'opacity-70 transition-opacity')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Referrals whose code was applied since <span className="font-medium text-gray-700">{formatDate(data.since)}</span>.
        </p>
        {periodPicker}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Referrals" value={t.referrals.toLocaleString()} sub={`${t.uniqueReferrers} referrer${t.uniqueReferrers === 1 ? '' : 's'}`} />
        <StatTile
          label="Rewarded"
          value={<span className="text-emerald-600">{t.rewarded.toLocaleString()}</span>}
          sub={`${Math.round(t.conversionRate * 100)}% conversion`}
        />
        <StatTile
          label="Pending"
          value={t.pending + t.reversed}
          sub={t.reversed ? `${t.reversed} after a reversal` : 'Waiting for a first booking'}
        />
        <StatTile
          label="Reversals"
          value={<span className={t.reversals ? 'text-red-600' : undefined}>{t.reversals}</span>}
          sub={`${t.revoked} revoked · ${t.codes.active}/${t.codes.total} codes active`}
        />
      </div>

      <Card padding="sm" className="sm:p-6">
        <CardHeader
          title="Points by currency"
          description="Each side is awarded in their own currency — points of different currencies are never added together."
          className="mb-4"
        />
        {data.byCurrency.length === 0 ? (
          <p className="text-sm text-gray-500">No points awarded in this period.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.byCurrency.map((c) => {
              const worth = pointsValueLabel(c.value)
              return (
                <div key={c.currency} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{c.currency}</span>
                    <span className="text-xs text-gray-500">
                      {c.rewards} award{c.rewards === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">{formatPoints(c.pointsInForce)}</p>
                  <p className="text-xs">
                    {worth ? (
                      <span className="text-emerald-700">{worth} in force</span>
                    ) : (
                      <span className="text-gray-400">No {c.currency} redemption rate — value unavailable</span>
                    )}
                  </p>
                  <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-gray-100 pt-2 text-xs">
                    <div>
                      <dt className="text-gray-500">Referrers</dt>
                      <dd className="font-medium text-gray-800">{c.referrerPointsAwarded.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Referees</dt>
                      <dd className="font-medium text-gray-800">{c.refereePointsAwarded.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Reversed</dt>
                      <dd className={cn('font-medium', c.pointsReversed ? 'text-red-600' : 'text-gray-800')}>
                        {c.pointsReversed ? `−${c.pointsReversed.toLocaleString()}` : '0'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card padding="sm" className="sm:p-6 lg:col-span-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-gray-900">Daily trend</h3>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs">
              {TREND_METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    'flex-1 rounded-md px-2.5 py-1.5 font-medium transition-colors sm:flex-none',
                    metric === m.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {trendPoints.every((p) => p.value === 0) ? (
            <p className="py-10 text-center text-sm text-gray-400">Nothing in this period.</p>
          ) : (
            <BarChart points={trendPoints} />
          )}
        </Card>

        <Card padding="sm" className="sm:p-6 lg:col-span-2">
          <CardHeader
            title="Top referrers"
            description="Points in the referrer's own currency."
            className="mb-3"
            action={
              <button type="button" onClick={() => onOpenReferrals()} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                All referrals
              </button>
            }
          />
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-gray-500">No referrals in this period.</p>
          ) : (
            <ol className="divide-y divide-gray-100">
              {data.topReferrers.map((r, i) => {
                const worth = pointsValueLabel(r.value)
                return (
                  <li key={r.referrer.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/dashboard/veloxverse/users/${r.referrer.id}`}
                        className="block truncate text-sm font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {personLabel(r.referrer)}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {r.rewarded}/{r.referrals} rewarded{r.pending ? ` · ${r.pending} pending` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-gray-900">{formatPoints(r.pointsInForce)}</p>
                      <p className="text-xs text-gray-500">
                        {r.currency}
                        {worth && r.pointsInForce > 0 ? ` · ${worth}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>
      </div>

      {(t.pending > 0 || t.reversed > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {t.pending > 0 && (
            <button type="button" onClick={() => onOpenReferrals('pending')} className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">
              View {t.pending} pending
            </button>
          )}
          {t.reversed > 0 && (
            <button type="button" onClick={() => onOpenReferrals('reversed')} className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100">
              View {t.reversed} reversed
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Referrals ─────────────────────────────────────────────────────────

function readReferralFilters(params: URLSearchParams): ReferralListFilters {
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: PAGE_SIZE,
    search: params.get('q') || undefined,
    status: (params.get('status') as ReferralListFilters['status']) || undefined,
    currency: params.get('currency') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  }
}

function ReferralCard({ row }: { row: ReferralRow }) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-gray-900">{row.code ?? '—'}</p>
          <p className="text-xs text-gray-500">{formatDateTime(row.createdAt)}</p>
        </div>
        <StatusBadge status={row.displayStatus} />
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-2.5 min-[400px]:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Referrer</p>
          <PartyCell party={row.referrer} compact />
        </div>
        <div className="min-w-0">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Referred</p>
          <PartyCell party={row.referee} compact />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{row.reversalCount > 0 ? `${row.reversalCount} reversal${row.reversalCount === 1 ? '' : 's'}` : row.completedAt ? `Rewarded ${formatDate(row.completedAt)}` : 'Not rewarded yet'}</span>
        <Link to={`/dashboard/veloxverse/refer-earn/${row.id}`} className="inline-flex items-center gap-0.5 font-medium text-indigo-600">
          Details
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function ReferralsTab() {
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const filters = useMemo(() => readReferralFilters(params), [params])
  const patch = useQueryPatch('page')
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useVVReferrals(filters)
  const [exporting, setExporting] = useState(false)
  const rows = data?.referrals ?? []
  const filtered = Boolean(filters.search || filters.status || filters.currency || filters.from || filters.to)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await fetchAllPages(async (page) => {
        const res = await vvReferralService.list({ ...filters, page, limit: 100 })
        return { items: res.referrals, totalPages: res.pagination.totalPages }
      })
      downloadCsv(`referrals-${new Date().toISOString().slice(0, 10)}.csv`, referralsToCsv(all))
      showToast({ type: 'success', title: `Exported ${all.length} referral${all.length === 1 ? '' : 's'}` })
    } catch (err) {
      showToast({ type: 'error', title: 'Export failed', message: err instanceof Error ? err.message : undefined })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card padding="sm" className="sm:p-6">
      <CardHeader
        title="Referrals"
        description="Each side's points and value are shown in that person's own currency."
        className="mb-4"
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} loading={exporting} disabled={exporting || rows.length === 0}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        }
      />

      <div className="space-y-3">
        <DebouncedSearch
          value={filters.search ?? ''}
          onCommit={(q) => patch({ q })}
          placeholder="Search name, email or code"
        />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <select className={selectClass} value={filters.status ?? ''} onChange={(e) => patch({ status: e.target.value || undefined })} aria-label="Status">
            <option value="">All statuses</option>
            {REFERRAL_STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className={selectClass} value={filters.currency ?? ''} onChange={(e) => patch({ currency: e.target.value || undefined })} aria-label="Currency">
            <option value="">All currencies</option>
            {ANALYTICS_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => patch({ from: e.target.value || undefined })} className="h-10 text-base sm:text-sm" aria-label="From date" />
          <Input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => patch({ to: e.target.value || undefined })} className="h-10 text-base sm:text-sm" aria-label="To date" />
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => patch({ q: undefined, status: undefined, currency: undefined, from: undefined, to: undefined })}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={errorMessage(error, 'Could not load referrals.')} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {filtered ? 'No referrals match these filters.' : 'No one has used a referral code yet.'}
          </p>
        ) : (
          <div className={isFetching && isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Code', 'Referrer', 'Referred customer', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDateTime(r.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-gray-800">{r.code ?? '—'}</td>
                      <td className="max-w-[15rem] px-4 py-3"><PartyCell party={r.referrer} /></td>
                      <td className="max-w-[15rem] px-4 py-3"><PartyCell party={r.referee} /></td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.displayStatus} />
                        {r.reversalCount > 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            {r.reversalCount} reversal{r.reversalCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/dashboard/veloxverse/refer-earn/${r.id}`}
                          className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          View details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {rows.map((r) => (
                <ReferralCard key={r.id} row={r} />
              ))}
            </div>
          </div>
        )}
        {data && data.pagination.total > 0 && (
          <div className="mt-3">
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.limit}
              total={data.pagination.total}
              onPageChange={(next) => patch({ page: next > 1 ? String(next) : undefined })}
            />
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Codes ─────────────────────────────────────────────────────────────

function codeState(c: AdminReferralCode): { label: string; variant: 'success' | 'neutral' | 'danger' | 'warning' } {
  if (!c.isActive) return { label: 'Inactive', variant: 'neutral' }
  if (c.expired) return { label: 'Expired', variant: 'danger' }
  if (c.maxUses != null && c.currentUses >= c.maxUses) return { label: 'Limit reached', variant: 'warning' }
  return { label: 'Active', variant: 'success' }
}

function CodeEditModal({ code, onClose }: { code: AdminReferralCode | null; onClose: () => void }) {
  const { showToast } = useToast()
  const update = useVVUpdateReferralCode()
  const [isActive, setIsActive] = useState(true)
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setIsActive(code.isActive)
    setMaxUses(code.maxUses != null ? String(code.maxUses) : '')
    setExpiresAt(code.expiresAt ? code.expiresAt.slice(0, 10) : '')
    setError(null)
  }, [code])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code) return
    const max = maxUses.trim() ? Number(maxUses) : null
    if (max != null && (!Number.isInteger(max) || max < 1)) {
      setError('Max uses must be a whole number of 1 or more (or blank for unlimited).')
      return
    }
    if (max != null && max < code.currentUses) {
      setError(`This code has already been used ${code.currentUses} times — max uses can't be lower than that.`)
      return
    }
    try {
      await update.mutateAsync({
        id: code.id,
        patch: {
          isActive,
          maxUses: max,
          // End of the chosen day, so "expires on 31 Dec" still works on 31 Dec.
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        },
      })
      showToast({ type: 'success', title: `${code.code} updated` })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the code.')
    }
  }

  return (
    <Modal
      open={Boolean(code)}
      onClose={onClose}
      title={code ? `Edit ${code.code}` : 'Edit code'}
      description={code ? `Owned by ${personLabel(code.owner)}` : undefined}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="vv-referral-code-form" loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      {code && (
        <form id="vv-referral-code-form" onSubmit={submit} className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Code is active</p>
              <p className="text-xs text-gray-500">
                An inactive code is rejected when someone tries to use it. Referrals already made with it are not affected.
              </p>
            </div>
            <Switch checked={isActive} onChange={setIsActive} className="shrink-0" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Max uses"
              type="number"
              min={Math.max(1, code.currentUses)}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              helperText={`Used ${code.currentUses} time${code.currentUses === 1 ? '' : 's'} so far`}
              className="text-base sm:text-sm"
            />
            <Input
              label="Expires on"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              helperText="Blank = never expires"
              className="text-base sm:text-sm"
            />
          </div>
          {!isActive && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Each customer keeps one active code: if this one is deactivated, the customer is issued a new code the
              next time they open Refer &amp; Earn in the app.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Modal>
  )
}

function CodesTab() {
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const patch = useQueryPatch('cpage')
  const filters: ReferralCodeFilters = useMemo(
    () => ({
      page: Math.max(1, Number(params.get('cpage')) || 1),
      limit: PAGE_SIZE,
      search: params.get('cq') || undefined,
      status: (params.get('cstatus') as ReferralCodeFilters['status']) || undefined,
    }),
    [params]
  )
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useVVReferralCodes(filters)
  const update = useVVUpdateReferralCode()
  const [editing, setEditing] = useState<AdminReferralCode | null>(null)
  const codes = data?.codes ?? []

  const toggle = async (c: AdminReferralCode, next: boolean) => {
    try {
      await update.mutateAsync({ id: c.id, patch: { isActive: next } })
      showToast({ type: 'success', title: `${c.code} ${next ? 'activated' : 'deactivated'}` })
    } catch (err) {
      showToast({ type: 'error', title: 'Could not update code', message: err instanceof Error ? err.message : undefined })
    }
  }

  const usage = (c: AdminReferralCode) => `${c.currentUses}${c.maxUses != null ? ` / ${c.maxUses}` : ''}`

  return (
    <Card padding="sm" className="sm:p-6">
      <CardHeader title="Referral codes" description="Each customer's personal code. Deactivate a code or cap its uses and expiry." className="mb-4" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_12rem]">
        <DebouncedSearch value={filters.search ?? ''} onCommit={(cq) => patch({ cq })} placeholder="Search code, owner name or email" />
        <select className={selectClass} value={filters.status ?? ''} onChange={(e) => patch({ cstatus: e.target.value || undefined })} aria-label="Code status">
          <option value="">All codes</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={errorMessage(error, 'Could not load codes.')} onRetry={() => refetch()} />
        ) : codes.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No codes match.</p>
        ) : (
          <div className={isFetching && isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Code', 'Owner', 'Referrals', 'Uses', 'Expires', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {codes.map((c) => {
                    const st = codeState(c)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-gray-900">{c.code}</td>
                        <td className="max-w-[16rem] px-4 py-3">
                          <Link to={`/dashboard/veloxverse/users/${c.owner.id}`} className="block truncate font-medium text-gray-900 hover:text-indigo-600">
                            {personLabel(c.owner)}
                          </Link>
                          {c.owner.name && <p className="truncate text-xs text-gray-500">{c.owner.email}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          <span className="font-medium">{c.referrals}</span>
                          <span className="text-xs text-gray-500"> · {c.rewarded} rewarded{c.pending ? ` · ${c.pending} pending` : ''}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{usage(c)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Switch checked={c.isActive} disabled={update.isPending} onChange={(next) => toggle(c, next)} />
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {codes.map((c) => {
                const st = codeState(c)
                return (
                  <div key={c.id} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-gray-900">{c.code}</p>
                        <Link to={`/dashboard/veloxverse/users/${c.owner.id}`} className="block truncate text-xs text-gray-600 hover:text-indigo-600">
                          {personLabel(c.owner)}
                        </Link>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-2 text-xs">
                      <div>
                        <p className="text-gray-500">Referrals</p>
                        <p className="font-medium text-gray-900">{c.referrals} <span className="font-normal text-gray-500">({c.rewarded} ✓)</span></p>
                      </div>
                      <div>
                        <p className="text-gray-500">Uses</p>
                        <p className="font-medium text-gray-900">{usage(c)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-500">Expires</p>
                        <p className="truncate font-medium text-gray-900">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Switch
                        checked={c.isActive}
                        disabled={update.isPending}
                        onChange={(next) => toggle(c, next)}
                        label={c.isActive ? 'Active' : 'Inactive'}
                        className="text-sm text-gray-600"
                      />
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {data && data.pagination.total > 0 && (
          <div className="mt-3">
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.limit}
              total={data.pagination.total}
              onPageChange={(next) => patch({ cpage: next > 1 ? String(next) : undefined })}
            />
          </div>
        )}
      </div>

      <CodeEditModal code={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, ReactNode> = {
  overview: 'Overview',
  referrals: 'Referrals',
  codes: 'Codes',
  config: 'Rewards config',
}

export default function VVReferEarnPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'

  // Switching tab keeps each tab's own filters in the URL but drops the page numbers.
  const setTab = (next: string, extra: Record<string, string> = {}) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        p.delete('page')
        p.delete('cpage')
        for (const [k, v] of Object.entries(extra)) p.set(k, v)
        return p
      },
      { replace: true }
    )

  return (
    <div className="max-w-6xl space-y-5 sm:space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
          <Gift className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Refer &amp; Earn</h1>
          <p className="text-sm text-gray-500">Who referred whom, the points each side earned, reversals, codes and reward settings.</p>
        </div>
      </div>

      <Tabs defaultValue="overview" value={tab} onChange={(v) => setTab(v)}>
        {/* Scrolls sideways on narrow phones instead of wrapping or overflowing the page. */}
        <TabsList className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="shrink-0 whitespace-nowrap px-3 sm:px-4">
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'overview' && <OverviewTab onOpenReferrals={(status) => setTab('referrals', status ? { status } : {})} />}
      {tab === 'referrals' && <ReferralsTab />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'config' && <ReferralRewardsConfig />}
    </div>
  )
}
