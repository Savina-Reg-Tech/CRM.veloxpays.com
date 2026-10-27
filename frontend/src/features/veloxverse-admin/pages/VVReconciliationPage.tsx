import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import DateRangeFilter from '../components/reports/DateRangeFilter'
import ExportCsvButton from '../components/reports/ExportCsvButton'
import { useVVReconciliation, useVVReconciliationRows } from '../hooks/useVVSupplierReports'
import { vvSupplierReportsService } from '../vvAdminService'
import { isReversedRange, type ReportRange } from '../reportRange'
import { centsMoney } from '../billingReports'
import {
  ISSUE_LABEL,
  RECON_SUPPLIER_LABEL,
  currencyList,
  issueVariant,
  reconOrderLink,
  reconRangeParams,
} from '../supplierReports'
import { formatDateTime, timeAgo } from '../utils'
import type { ReconIssue, ReconRow, ReconSupplier, ReconSupplierSummary } from '../types'

const LIMIT = 20

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors sm:text-sm'

const NOT_AVAILABLE = <span className="text-gray-400">not available</span>

function Count({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', value ? tone : 'text-gray-900')}>
        {value == null ? <span className="text-sm font-normal text-gray-400">n/a</span> : value.toLocaleString()}
      </p>
    </div>
  )
}

function SupplierCard({ s, selected, onSelect }: { s: ReconSupplierSummary; selected: boolean; onSelect: () => void }) {
  const syncFailed = s.lastSyncStatus && s.lastSyncStatus !== 'ok'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full flex-col gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors',
        selected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900">{s.name}</p>
        <span className={cn('text-[11px]', syncFailed ? 'text-red-600' : 'text-gray-400')}>
          {s.lastSyncedAt ? `${syncFailed ? 'Sync failed' : 'Synced'} ${timeAgo(s.lastSyncedAt)}` : 'Never synced'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Count label="Bookings" value={s.ourCount} />
        <Count label="Mismatch" value={s.mismatchCount} tone="text-red-600" />
        <Count label="Missing there" value={s.missingAtSupplierCount} tone="text-amber-600" />
        <Count label="Missing here" value={s.missingOnOursCount} tone="text-amber-600" />
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">We received</dt>
          <dd className="text-right tabular-nums text-gray-900">{currencyList(s.ourAmount)}</dd>
        </div>
        {s.supplierCost !== null && (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Supplier cost</dt>
              <dd className="text-right tabular-nums text-gray-900">{currencyList(s.supplierCost)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Margin</dt>
              <dd className="text-right tabular-nums text-gray-900">
                {currencyList(s.margin)}
                {s.marginAudCents != null && (
                  <span className="block text-gray-400">
                    {centsMoney(s.marginAudCents, 'AUD')} AUD on {s.marginAudRowCount?.toLocaleString()} booking
                    {s.marginAudRowCount === 1 ? '' : 's'}
                  </span>
                )}
              </dd>
            </div>
          </>
        )}
      </dl>
      {(!!s.rowsWithoutCost || s.notAvailable.length > 0) && (
        <p className="text-[11px] leading-snug text-gray-400">
          {!!s.rowsWithoutCost && `${s.rowsWithoutCost.toLocaleString()} without a saved supplier cost. `}
          {s.notAvailable.length > 0 && `Not available from ${s.name}: ${s.notAvailable.join(', ')}.`}
        </p>
      )}
      {s.truncated && (
        <p className="flex items-start gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Over 20,000 bookings — narrow the dates for full totals.
        </p>
      )}
    </button>
  )
}

export default function VVReconciliationPage() {
  const [range, setRange] = useState<ReportRange>({ preset: '30d' })
  const [supplier, setSupplier] = useState<ReconSupplier>('esimaccess')
  const [issue, setIssue] = useState<'' | ReconIssue>('mismatch')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search.trim(), 300)

  const reversed = isReversedRange(range)
  const dates = useMemo(() => (reversed ? {} : reconRangeParams(range)), [range, reversed])
  const filters = useMemo(
    () => ({ ...dates, issue: issue || undefined, search: debouncedSearch || undefined }),
    [dates, issue, debouncedSearch]
  )
  useEffect(() => {
    setPage(1)
  }, [filters, supplier])

  const summary = useVVReconciliation(dates)
  const rows = useVVReconciliationRows(supplier, page, LIMIT, filters)
  const current = summary.data?.suppliers.find((s) => s.supplier === supplier) ?? rows.data?.summary
  const supplierName = RECON_SUPPLIER_LABEL[supplier]
  const noCost = supplier === 'mint'

  const columns = [
    { key: 'createdAt', header: 'Date', render: (r: ReconRow) => <span className="whitespace-nowrap text-gray-500">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'orderNo',
      header: 'Booking',
      render: (r: ReconRow) => {
        const to = reconOrderLink(supplier, r)
        const text = <span className="font-mono text-xs">{r.orderNo ?? r.ourRef ?? '—'}</span>
        return (
          <div className="min-w-0">
            {to ? (
              <Link to={to} className="text-indigo-600 hover:underline">
                {text}
              </Link>
            ) : (
              text
            )}
            {r.customerEmail && <span className="block truncate text-xs text-gray-400">{r.customerEmail}</span>}
          </div>
        )
      },
    },
    {
      key: 'refs',
      header: `${supplierName} ref`,
      render: (r: ReconRow) => (r.supplierRef ? <span className="font-mono text-xs text-gray-700">{r.supplierRef}</span> : <span className="text-xs text-amber-600">none</span>),
    },
    {
      key: 'status',
      header: 'Status: ours / theirs',
      render: (r: ReconRow) => (
        <span className="whitespace-nowrap text-xs">
          <span className="text-gray-900">{r.ourStatus ?? '—'}</span>
          <span className="text-gray-300"> / </span>
          {r.supplierStatus ?? NOT_AVAILABLE}
          {r.paymentStatus && <span className="block text-gray-400">payment {r.paymentStatus.toLowerCase()}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'We received',
      render: (r: ReconRow) => <span className="whitespace-nowrap">{centsMoney(r.ourAmountCents, r.currency)}</span>,
    },
    ...(noCost
      ? []
      : [
          {
            key: 'cost',
            header: 'Supplier cost',
            render: (r: ReconRow) =>
              r.supplierCostCents == null ? (
                <span className="text-xs text-gray-400">not available from {supplierName}</span>
              ) : (
                <span className="whitespace-nowrap">
                  {centsMoney(r.supplierCostCents, r.supplierCurrency)}
                  {r.supplierCostInCurrencyCents != null && r.supplierCurrency !== r.currency && (
                    <span className="block text-xs text-gray-400">= {centsMoney(r.supplierCostInCurrencyCents, r.currency)}</span>
                  )}
                </span>
              ),
          },
          {
            key: 'margin',
            header: 'Margin',
            render: (r: ReconRow) =>
              r.marginCents == null ? (
                <span className="text-gray-300">—</span>
              ) : (
                <span className={cn('whitespace-nowrap', r.marginCents < 0 ? 'text-red-600' : 'text-emerald-700')}>
                  {centsMoney(r.marginCents, r.currency)}
                  {r.marginAudCents != null && r.currency !== 'AUD' && (
                    <span className="block text-xs text-gray-400">{centsMoney(r.marginAudCents, 'AUD')}</span>
                  )}
                </span>
              ),
          },
        ]),
    {
      key: 'issue',
      header: 'Result',
      render: (r: ReconRow) => (
        <div className="max-w-[18rem]">
          <Badge variant={issueVariant(r.issue)}>{ISSUE_LABEL[r.issue]}</Badge>
          {r.issueDetail && <p className="mt-1 text-xs text-gray-500">{r.issueDetail}</p>}
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier reconciliation</h1>
          <p className="text-sm text-gray-500">Our paid bookings checked against what each supplier last told us.</p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {summary.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : summary.isError || !summary.data ? (
        <Card>
          <p className="py-6 text-center text-sm text-red-600">Couldn&rsquo;t load reconciliation from VeloxVerse. Try reloading in a moment.</p>
        </Card>
      ) : (
        <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4', summary.isFetching && 'opacity-60')}>
          {summary.data.suppliers.map((s) => (
            <SupplierCard key={s.supplier} s={s} selected={s.supplier === supplier} onSelect={() => setSupplier(s.supplier)} />
          ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        Compared with what each supplier sync last saved, not a live check. Supplier cost is their price saved at checkout (suppliers
        send no invoice amounts). Margins are never worked out at today&rsquo;s exchange rate or across currencies; &ldquo;Missing here&rdquo; isn&rsquo;t
        available because VeloxVerse doesn&rsquo;t download suppliers&rsquo; full order lists.
      </p>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-base font-semibold text-gray-900">{supplierName}</h2>
          <select aria-label="Result" value={issue} onChange={(e) => setIssue(e.target.value as '' | ReconIssue)} className={selectClass}>
            <option value="">All results</option>
            <option value="mismatch">{ISSUE_LABEL.mismatch}</option>
            <option value="missing_supplier">{ISSUE_LABEL.missing_supplier}</option>
            <option value="matched">{ISSUE_LABEL.matched}</option>
            <option value="missing_ours" disabled>
              {ISSUE_LABEL.missing_ours} (not available)
            </option>
          </select>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order, ref, payment, email…"
              aria-label="Search bookings"
              className={`${selectClass} w-full pl-8`}
            />
          </div>
          {rows.isFetching && !rows.isLoading && <span className="text-xs text-gray-400">Refreshing…</span>}
          <ExportCsvButton
            className="w-full sm:ml-auto sm:w-auto"
            disabled={reversed}
            onExport={() => vvSupplierReportsService.exportReconciliation(supplier, filters)}
          />
        </div>

        {rows.isError ? (
          <Card>
            <p className="py-6 text-center text-sm text-red-600">Couldn&rsquo;t load {supplierName} bookings.</p>
          </Card>
        ) : (
          <Card padding="none">
            <Table
              columns={columns}
              data={rows.data?.rows ?? []}
              keyField="id"
              loading={rows.isLoading}
              emptyMessage={
                issue === 'mismatch' || issue === 'missing_supplier'
                  ? `No ${ISSUE_LABEL[issue].toLowerCase()} for ${supplierName} in this period.`
                  : 'No bookings match.'
              }
            />
          </Card>
        )}

        {rows.data && rows.data.pagination.total > LIMIT && (
          <Pagination page={page} pageSize={LIMIT} total={rows.data.pagination.total} onPageChange={setPage} />
        )}
        {current?.truncated && (
          <p className="text-xs text-amber-700">More than 20,000 bookings in this period — narrow the dates for complete results.</p>
        )}
      </section>
    </div>
  )
}
