import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Download,
  Pencil,
  RefreshCw,
  Search,
  Ticket,
  X,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import { Table } from '@/components/ui/Table'
import { useToast } from '@/app/providers/ToastProvider'
import { formatMoney } from '@/lib/utils'
import { useVVPromo, useVVPromoStats, useVVPromoUsages, useVVUpdatePromo } from '../hooks/useVVPromo'
import { vvPromoService } from '../vvAdminService'
import { ANALYTICS_CURRENCIES, formatDate, formatDateTime, timeAgo } from '../utils'
import {
  USAGE_SERVICE_OPTIONS,
  discountLabel,
  formatUsdCents,
  isPromoExpired,
  serviceLabel,
} from '../promo'
import { PromoForm, PROMO_FORM_ID } from './VVPromoCodesPage'
import StatTile from '../components/StatTile'
import { csvAmount, downloadCsv, fetchAllPages, toCsv } from '../csv'
import type {
  CreatePromoCodeInput,
  PromoCode,
  PromoCodeStats,
  PromoUsageFilters,
  PromoUsageRow,
  PromoUsageService,
  PromoUsageStatus,
} from '../types'

const PAGE_SIZE = 25

// `text-base` below `sm` keeps iOS Safari from zooming the page when a filter gets focus.
const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm'

/** Row amounts are always in the row's own currency — never `formatCents`/`$`. */
function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency)
}

const STATUS_BADGE: Record<PromoUsageStatus, { label: string; variant: BadgeVariant }> = {
  USED: { label: 'Used', variant: 'success' },
  REFUNDED: { label: 'Refunded', variant: 'danger' },
  PROCESSING: { label: 'Processing', variant: 'warning' },
  FAILED: { label: 'Failed', variant: 'danger' },
}

function StatusBadge({ status }: { status: PromoUsageStatus }) {
  const { label, variant } = STATUS_BADGE[status] ?? { label: status, variant: 'neutral' as BadgeVariant }
  return <Badge variant={variant}>{label}</Badge>
}

// ── Filters (synced to the URL query string) ──────────────────────────

type StatusFilter = NonNullable<PromoUsageFilters['status']>

function readFilters(params: URLSearchParams): PromoUsageFilters {
  const status = params.get('status')
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: PAGE_SIZE,
    search: params.get('q') || undefined,
    currency: params.get('currency') || undefined,
    service: (params.get('service') as PromoUsageService | null) || undefined,
    status: status === 'used' || status === 'refunded' ? status : 'all',
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  }
}

// ── CSV export ────────────────────────────────────────────────────────

function usagesToCsv(rows: PromoUsageRow[]): string {
  return toCsv(
    ['Date', 'Customer name', 'Email', 'Service', 'Description', 'Invoice', 'Currency',
      'Order value', 'Discount', 'Paid', 'Status', 'Refund amount'],
    rows.map((r) => [
      r.usedAt,
      r.customer.name ?? '',
      r.customer.email,
      r.serviceLabel,
      r.description,
      r.invoiceNumber ?? '',
      r.currency,
      csvAmount(r.orderValueCents),
      csvAmount(r.discountCents),
      csvAmount(r.chargedCents),
      STATUS_BADGE[r.status]?.label ?? r.status,
      r.refund ? `${r.refund.currency} ${csvAmount(r.refund.amountCents)}` : '',
    ])
  )
}

// ── Small building blocks ─────────────────────────────────────────────

function ConfigItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  )
}

function CustomerCell({ row }: { row: PromoUsageRow }) {
  return (
    <div className="min-w-0">
      <Link
        to={`/dashboard/veloxverse/users/${row.customer.id}`}
        className="block truncate font-medium text-gray-900 hover:text-indigo-600"
      >
        {row.customer.name ?? row.customer.email ?? 'Unknown customer'}
      </Link>
      {row.customer.name && <p className="truncate text-xs text-gray-500">{row.customer.email}</p>}
    </div>
  )
}

function RefundNote({ row }: { row: PromoUsageRow }) {
  if (!row.refund) return null
  return (
    <p className="mt-0.5 text-xs text-red-600">
      Refunded {money(row.refund.amountCents, row.refund.currency)} · {formatDate(row.refund.refundedAt)}
    </p>
  )
}

// ── Sections ──────────────────────────────────────────────────────────

function ConfigurationCard({ promo }: { promo: PromoCode }) {
  const overrides = Object.entries(promo.currencyAmounts ?? {}).filter(([, a]) =>
    Object.values(a ?? {}).some((v) => v != null)
  )
  const services = promo.applicableServices.length ? promo.applicableServices : ['ALL']

  return (
    <Card padding="sm" className="sm:p-6">
      <CardHeader title="Configuration" description="Base amounts are USD; other currencies use their override or the live rate." className="mb-4" />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <ConfigItem label="Discount">{discountLabel(promo)}</ConfigItem>
        <ConfigItem label="Min purchase">
          {promo.minPurchaseCents ? formatUsdCents(promo.minPurchaseCents) : 'No minimum'}
        </ConfigItem>
        <ConfigItem label="Usage">
          {promo.currentUses ?? promo.usageCount ?? 0}
          {promo.maxUses ? ` / ${promo.maxUses}` : ''} uses
          <span className="text-gray-500">
            {' · '}
            {promo.maxUsesPerUser ? `${promo.maxUsesPerUser} per customer` : 'unlimited per customer'}
          </span>
        </ConfigItem>
        <ConfigItem label="Starts">{promo.startsAt ? formatDate(promo.startsAt) : 'Immediately'}</ConfigItem>
        <ConfigItem label="Expires">{promo.expiresAt ? formatDate(promo.expiresAt) : 'Never'}</ConfigItem>
        <ConfigItem label="Created">{formatDate(promo.createdAt)}</ConfigItem>
        <div className="sm:col-span-2 lg:col-span-3">
          <ConfigItem label="Applicable services">
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">
                  {serviceLabel(s)}
                </span>
              ))}
            </div>
          </ConfigItem>
        </div>
        {overrides.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <ConfigItem label="Per-currency amounts">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {overrides.map(([cur, a]) => (
                  <div key={cur} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">{cur}</p>
                    {a.minPurchaseCents != null && <p className="text-gray-600">Min {money(a.minPurchaseCents, cur)}</p>}
                    {a.discountCents != null && <p className="text-gray-600">{money(a.discountCents, cur)} off</p>}
                    {a.maxDiscountCents != null && <p className="text-gray-600">Max {money(a.maxDiscountCents, cur)}</p>}
                  </div>
                ))}
              </div>
            </ConfigItem>
          </div>
        )}
        {promo.description && (
          <div className="sm:col-span-2 lg:col-span-3">
            <ConfigItem label="Description">{promo.description}</ConfigItem>
          </div>
        )}
      </dl>
    </Card>
  )
}

function StatsSection({ stats, loading }: { stats?: PromoCodeStats; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const maxServiceUses = Math.max(1, ...stats.byService.map((s) => s.uses))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total uses" value={stats.totals.uses} sub="Completed orders + wallet credit" />
        <StatTile label="Unique customers" value={stats.totals.uniqueUsers} />
        <StatTile
          label="Refunded"
          value={<span className={stats.totals.refunded ? 'text-red-600' : undefined}>{stats.totals.refunded}</span>}
          sub="Excluded from savings"
        />
        <StatTile
          label="Last used"
          value={<span className="text-lg">{stats.lastUsedAt ? timeAgo(stats.lastUsedAt) : '—'}</span>}
          sub={stats.firstUsedAt ? `First used ${formatDate(stats.firstUsedAt)}` : 'Never used'}
        />
      </div>

      <Card padding="sm" className="sm:p-6">
        <CardHeader
          title="Savings by currency"
          description="Each currency is totalled separately — amounts are never added across currencies."
          className="mb-4"
        />
        {stats.byCurrency.length === 0 ? (
          <p className="text-sm text-gray-500">No completed orders yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.byCurrency.map((c) => (
              <div key={c.currency} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{c.currency}</span>
                  <span className="text-xs text-gray-500">
                    {c.uses} {c.uses === 1 ? 'use' : 'uses'}
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold text-emerald-600">{money(c.discountCents, c.currency)} saved</p>
                <p className="text-xs text-gray-500">
                  {money(c.chargedCents, c.currency)} paid · {money(c.orderValueCents, c.currency)} order value
                </p>
              </div>
            ))}
          </div>
        )}
        {stats.approxUsd &&
          !(stats.byCurrency.length === 1 && stats.byCurrency[0].currency === 'USD') && (
          <p className="mt-3 text-xs text-gray-400">
            ≈ {formatUsdCents(stats.approxUsd.discountCents)} saved in total at today&apos;s rates
            {stats.approxUsd.skippedCurrencies.length > 0 &&
              ` (excludes ${stats.approxUsd.skippedCurrencies.join(', ')} — rate unavailable)`}
          </p>
        )}
      </Card>

      {stats.byService.length > 0 && (
        <Card padding="sm" className="sm:p-6">
          <CardHeader title="Usage by service" className="mb-4" />
          <ul className="space-y-2.5">
            {stats.byService.map((s) => (
              <li key={s.service} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_auto]">
                <span className="truncate text-gray-700">{serviceLabel(s.service)}</span>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(s.uses / maxServiceUses) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-medium text-gray-900">{s.uses}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function UsageFilters({
  filters,
  onChange,
}: {
  filters: PromoUsageFilters
  onChange: (patch: Record<string, string | undefined>) => void
}) {
  // Debounce typing into the URL so every keystroke isn't a request.
  const [search, setSearch] = useState(filters.search ?? '')
  useEffect(() => setSearch(filters.search ?? ''), [filters.search])
  useEffect(() => {
    if (search === (filters.search ?? '')) return
    const t = setTimeout(() => onChange({ q: search.trim() || undefined }), 300)
    return () => clearTimeout(t)
  }, [search, filters.search, onChange])

  const active = Boolean(
    filters.search || filters.currency || filters.service || filters.status !== 'all' || filters.from || filters.to
  )

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customer, email, invoice or payment ID"
        leftIcon={<Search className="h-4 w-4" />}
        className="h-10 text-base sm:text-sm"
        aria-label="Search usages"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select
          className={selectClass}
          value={filters.status ?? 'all'}
          onChange={(e) => onChange({ status: e.target.value === 'all' ? undefined : (e.target.value as StatusFilter) })}
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          <option value="used">Used</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          className={selectClass}
          value={filters.currency ?? ''}
          onChange={(e) => onChange({ currency: e.target.value || undefined })}
          aria-label="Currency"
        >
          <option value="">All currencies</option>
          {ANALYTICS_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} col-span-2 sm:col-span-1`}
          value={filters.service ?? ''}
          onChange={(e) => onChange({ service: e.target.value || undefined })}
          aria-label="Service"
        >
          <option value="">All services</option>
          {USAGE_SERVICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={filters.from ?? ''}
          max={filters.to}
          onChange={(e) => onChange({ from: e.target.value || undefined })}
          className="h-10 text-base sm:text-sm"
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.to ?? ''}
          min={filters.from}
          onChange={(e) => onChange({ to: e.target.value || undefined })}
          className="h-10 text-base sm:text-sm"
          aria-label="To date"
        />
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            setSearch('')
            onChange({ q: undefined, status: undefined, currency: undefined, service: undefined, from: undefined, to: undefined })
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  )
}

function UsageCard({ row }: { row: PromoUsageRow }) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <CustomerCell row={row} />
        <div className="shrink-0">
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-2 text-xs">
        <div className="min-w-0">
          <p className="text-gray-500">Order</p>
          <p className="truncate font-medium text-gray-900">{money(row.orderValueCents, row.currency)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-gray-500">Discount</p>
          <p className="truncate font-medium text-emerald-600">−{money(row.discountCents, row.currency)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-gray-500">Paid</p>
          <p className="truncate font-medium text-gray-900">{money(row.chargedCents, row.currency)}</p>
        </div>
      </div>
      <div className="space-y-0.5 text-xs text-gray-500">
        <p className="text-gray-700">
          <span className="font-medium">{row.serviceLabel}</span> · {row.description}
        </p>
        <p>
          {formatDateTime(row.usedAt)}
          {row.invoiceNumber && <> · <span className="font-mono">{row.invoiceNumber}</span></>}
        </p>
        <RefundNote row={row} />
      </div>
    </div>
  )
}

function UsageHistory({ promo }: { promo: PromoCode }) {
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useVVPromoUsages(promo.id, filters)
  const [exporting, setExporting] = useState(false)

  const updateParams = useMemo(
    () => (patch: Record<string, string | undefined>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v)
            else next.delete(k)
          }
          // Any filter change returns to the first page; a page change keeps the filters.
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true }
      ),
    [setParams]
  )

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await fetchAllPages(async (page) => {
        const res = await vvPromoService.getUsages(promo.id, { ...filters, page, limit: 100 })
        return { items: res.usages, totalPages: res.pagination.totalPages }
      })
      downloadCsv(`promo-${promo.code.toLowerCase()}-usages.csv`, usagesToCsv(rows))
      showToast({ type: 'success', title: `Exported ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}` })
    } catch (err) {
      showToast({ type: 'error', title: 'Export failed', message: err instanceof Error ? err.message : undefined })
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.usages ?? []
  const filtered = Boolean(
    filters.search || filters.currency || filters.service || filters.status !== 'all' || filters.from || filters.to
  )
  const emptyMessage = filtered ? 'No usages match these filters.' : `No one has used ${promo.code} yet.`

  const columns = [
    {
      key: 'usedAt',
      header: 'Date',
      className: 'whitespace-nowrap text-gray-500',
      render: (r: PromoUsageRow) => formatDateTime(r.usedAt),
    },
    { key: 'customer', header: 'Customer', className: 'max-w-[14rem]', render: (r: PromoUsageRow) => <CustomerCell row={r} /> },
    { key: 'service', header: 'Service', className: 'whitespace-nowrap', render: (r: PromoUsageRow) => r.serviceLabel },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-[16rem]',
      render: (r: PromoUsageRow) => <span className="line-clamp-2">{r.description}</span>,
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      className: 'whitespace-nowrap font-mono text-xs',
      render: (r: PromoUsageRow) => r.invoiceNumber ?? '—',
    },
    {
      key: 'orderValueCents',
      header: 'Order value',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (r: PromoUsageRow) => money(r.orderValueCents, r.currency),
    },
    {
      key: 'discountCents',
      header: 'Discount',
      className: 'whitespace-nowrap text-right font-medium text-emerald-600',
      headerClassName: 'text-right',
      render: (r: PromoUsageRow) => `−${money(r.discountCents, r.currency)}`,
    },
    {
      key: 'chargedCents',
      header: 'Paid',
      className: 'whitespace-nowrap text-right font-medium text-gray-900',
      headerClassName: 'text-right',
      render: (r: PromoUsageRow) => money(r.chargedCents, r.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: PromoUsageRow) => (
        <div>
          <StatusBadge status={r.status} />
          <RefundNote row={r} />
        </div>
      ),
    },
  ]

  return (
    <Card padding="sm" className="sm:p-6">
      <CardHeader
        title="Usage history"
        description="Every order that used this code, in the currency the customer paid."
        className="mb-4"
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} loading={exporting} disabled={exporting || rows.length === 0}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        }
      />

      <UsageFilters filters={filters} onChange={updateParams} />

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="text-sm text-gray-600">
              {error instanceof Error ? error.message : 'Could not load usage history.'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <div className={isFetching && isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <div className="hidden md:block">
              <Table columns={columns} data={rows} keyField="id" emptyMessage={emptyMessage} />
            </div>
            <div className="space-y-2 md:hidden">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">{emptyMessage}</p>
              ) : (
                rows.map((r) => <UsageCard key={r.id} row={r} />)
              )}
            </div>
            {data && data.pagination.total > 0 && (
              <div className="mt-3">
                <Pagination
                  page={data.pagination.page}
                  pageSize={data.pagination.limit}
                  total={data.pagination.total}
                  onPageChange={(next) => updateParams({ page: next > 1 ? String(next) : undefined })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default function VVPromoCodeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const { data: promo, isLoading, isError, error, refetch } = useVVPromo(id)
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useVVPromoStats(id)
  const update = useVVUpdatePromo()
  const [editing, setEditing] = useState(false)

  const copyCode = () => {
    if (!promo) return
    navigator.clipboard
      .writeText(promo.code)
      .then(() => showToast({ type: 'success', title: `${promo.code} copied` }))
  }

  const toggleActive = async (next: boolean) => {
    if (!promo) return
    try {
      await update.mutateAsync({ id: promo.id, patch: { isActive: next } as Partial<CreatePromoCodeInput> })
      showToast({ type: 'success', title: next ? 'Promo code activated' : 'Promo code deactivated' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Could not update promo code',
      })
    }
  }

  const backLink = (
    <Link
      to="/dashboard/veloxverse/promo-codes"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Promo codes
    </Link>
  )

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        {backLink}
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !promo) {
    return (
      <div className="max-w-6xl space-y-6">
        {backLink}
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Promo code not found.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  const expired = isPromoExpired(promo)

  return (
    <div className="max-w-6xl space-y-6">
      {backLink}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <Ticket className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all font-mono text-xl font-bold text-gray-900 sm:text-2xl">{promo.code}</h1>
              <button
                type="button"
                onClick={copyCode}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Copy code"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={promo.isActive ? 'success' : 'neutral'} dot>
                {promo.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {expired && <Badge variant="danger">Expired</Badge>}
              <span className="text-sm text-gray-500">{discountLabel(promo)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={promo.isActive}
            disabled={update.isPending}
            onChange={toggleActive}
            label={promo.isActive ? 'Active' : 'Inactive'}
          />
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <ConfigurationCard promo={promo} />

      {statsError ? (
        <Card padding="sm" className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Could not load usage stats.</p>
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : (
        <StatsSection stats={stats} loading={statsLoading} />
      )}

      <UsageHistory promo={promo} />

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${promo.code}`}
        description="Changes apply to checkouts from now on."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" form={PROMO_FORM_ID}>
              Save
            </Button>
          </>
        }
      >
        {editing && <PromoForm promo={promo} onClose={() => setEditing(false)} />}
      </Modal>
    </div>
  )
}
