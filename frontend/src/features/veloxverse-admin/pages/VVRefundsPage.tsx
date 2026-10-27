import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Info, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import StatTile from '../components/StatTile'
import DateRangeFilter from '../components/reports/DateRangeFilter'
import ExportCsvButton from '../components/reports/ExportCsvButton'
import { CustomerCell, OrderCell, PaymentDetail } from '../components/reports/BillingReportParts'
import { useVVBillingRefunds } from '../hooks/useVVBillingReports'
import { vvBillingReportsService } from '../vvAdminService'
import { ALL_TIME, isReversedRange, rangeParams, type ReportRange } from '../reportRange'
import { BILLING_SERVICES, INITIATOR_LABEL, centsMoney, refundStatusVariant, serviceLabel } from '../billingReports'
import { formatDateTime } from '../utils'
import type { BillingInitiatorKind, BillingRefundFilters, BillingRefundRow, BillingService } from '../types'

const LIMIT = 20

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors sm:text-sm'

type StatusChoice = '' | BillingRefundRow['status'] | 'STUCK'

/** "Refunded A$32.00 of A$40.00 · A$8.00 kept" — the money that really went back vs. the payment. */
function AmountCell({ row }: { row: BillingRefundRow }) {
  return (
    <div className="whitespace-nowrap">
      <span className="text-gray-900">{centsMoney(row.totalAmountCents, row.currency)}</span>
      {row.payment && <span className="text-xs text-gray-400"> of {centsMoney(row.payment.amountCents, row.payment.currency)}</span>}
      {row.chargeAmountCents != null && row.chargeCurrency !== row.currency && (
        <span className="block text-xs text-gray-400">card {centsMoney(row.chargeAmountCents, row.chargeCurrency)}</span>
      )}
      {!!row.payment?.withheldCents && (
        <span className="block text-xs text-gray-400">{centsMoney(row.payment.withheldCents, row.payment.currency)} kept</span>
      )}
    </div>
  )
}

export default function VVRefundsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusChoice>('')
  const [service, setService] = useState<'' | BillingService>('')
  const [initiatedBy, setInitiatedBy] = useState<'' | BillingInitiatorKind>('')
  const [range, setRange] = useState<ReportRange>(ALL_TIME)
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search.trim(), 300)

  // "Stuck" is its own filter on VeloxVerse (PENDING for more than 24 hours).
  const filters = useMemo<BillingRefundFilters>(
    () => ({
      search: debouncedSearch || undefined,
      status: status && status !== 'STUCK' ? status : undefined,
      stuck: status === 'STUCK' ? true : undefined,
      service: service || undefined,
      initiatedBy: initiatedBy || undefined,
      ...(isReversedRange(range) ? {} : rangeParams(range)),
    }),
    [debouncedSearch, status, service, initiatedBy, range]
  )
  const hasFilters = Boolean(search || status || service || initiatedBy || range.preset !== 'all')
  useEffect(() => {
    setPage(1)
  }, [filters])

  const { data, isLoading, isFetching, isError } = useVVBillingRefunds(page, LIMIT, filters)
  const summary = data?.summary
  const cur = summary?.currency ?? 'AUD'

  const clear = () => {
    setSearch('')
    setStatus('')
    setService('')
    setInitiatedBy('')
    setRange(ALL_TIME)
  }

  const columns = [
    { key: 'createdAt', header: 'Date', render: (r: BillingRefundRow) => <span className="whitespace-nowrap text-gray-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'orderNo', header: 'Order', render: (r: BillingRefundRow) => <OrderCell row={r} /> },
    { key: 'customer', header: 'Customer', render: (r: BillingRefundRow) => <CustomerCell customer={r.customer} /> },
    { key: 'service', header: 'Service', render: (r: BillingRefundRow) => <span className="whitespace-nowrap text-gray-700">{serviceLabel(r.service)}</span> },
    { key: 'amount', header: 'Refunded', render: (r: BillingRefundRow) => <AmountCell row={r} /> },
    {
      key: 'initiatedBy',
      header: 'Started by',
      render: (r: BillingRefundRow) => (
        <span className="text-xs text-gray-600" title={r.initiatedBy.kind === 'unknown' ? 'Made before VeloxVerse recorded who started refunds' : undefined}>
          {INITIATOR_LABEL[r.initiatedBy.kind]}
          {r.initiatedBy.email && r.initiatedBy.kind === 'staff' && <span className="block truncate text-gray-400">{r.initiatedBy.email}</span>}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r: BillingRefundRow) => <span className="line-clamp-2 max-w-[16rem] text-xs text-gray-600">{r.reason || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: BillingRefundRow) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge variant={refundStatusVariant(r.status)}>{r.status.toLowerCase()}</Badge>
          {r.stuck && <Badge variant="danger">Stuck</Badge>}
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
        <p className="text-sm text-gray-500">Every refund across VeloxVerse. Click a row to see the payment it belongs to.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Refunded (${cur})`}
          value={summary ? centsMoney(summary.succeededAudCents, cur) : '—'}
          sub={summary ? `${summary.succeededCount.toLocaleString()} succeeded` : undefined}
        />
        <StatTile
          label={`Pending (${cur})`}
          value={summary ? centsMoney(summary.pendingAudCents, cur) : '—'}
          sub={summary ? `${summary.pendingCount.toLocaleString()} waiting for the bank` : undefined}
        />
        <StatTile label="Failed" value={summary ? summary.failedCount.toLocaleString() : '—'} sub="could not be refunded" />
        <StatTile label="Stuck" value={summary ? summary.stuckCount.toLocaleString() : '—'} sub="pending over 24 hours" />
      </div>

      {!!summary?.stuckCount && status !== 'STUCK' && (
        <button
          type="button"
          onClick={() => setStatus('STUCK')}
          className="flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700 hover:bg-red-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {summary.stuckCount.toLocaleString()} refund{summary.stuckCount === 1 ? ' has' : 's have'} been pending for over 24 hours — show
          {summary.stuckCount === 1 ? ' it' : ' them'}.
        </button>
      )}
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        Amounts are what really went back. Money kept on a cancellation (such as the $8 flexible booking fee) is shown as “kept”, never as
        refunded.{summary?.withoutAudCount ? ` ${summary.withoutAudCount.toLocaleString()} refund${summary.withoutAudCount === 1 ? ' went' : 's went'} only to wallet credit or points and ${summary.withoutAudCount === 1 ? 'is' : 'are'} not in the AUD totals.` : ''}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order, customer, refund ref…"
            aria-label="Search refunds"
            className={`${selectClass} w-full pl-8`}
          />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusChoice)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="PENDING">Pending</option>
          <option value="STUCK">Stuck (pending over 24h)</option>
          <option value="FAILED">Failed</option>
        </select>
        <select aria-label="Service" value={service} onChange={(e) => setService(e.target.value as '' | BillingService)} className={selectClass}>
          <option value="">All services</option>
          {BILLING_SERVICES.map((s) => (
            <option key={s} value={s}>
              {serviceLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Started by"
          value={initiatedBy}
          onChange={(e) => setInitiatedBy(e.target.value as '' | BillingInitiatorKind)}
          className={selectClass}
        >
          <option value="">Started by anyone</option>
          {(Object.keys(INITIATOR_LABEL) as BillingInitiatorKind[]).map((k) => (
            <option key={k} value={k}>
              {INITIATOR_LABEL[k]}
            </option>
          ))}
        </select>
        <DateRangeFilter value={range} onChange={setRange} />
        {hasFilters && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
        {isFetching && !isLoading && <span className="text-xs text-gray-400">Refreshing…</span>}
        <ExportCsvButton
          className="w-full sm:ml-auto sm:w-auto"
          disabled={isReversedRange(range)}
          onExport={() => vvBillingReportsService.exportRefunds(filters)}
        />
      </div>

      {isError ? (
        <Card>
          <p className="py-8 text-center text-sm text-red-600">Couldn&rsquo;t load refunds from VeloxVerse. Try reloading in a moment.</p>
        </Card>
      ) : (
        <Card padding="none">
          <Table
            columns={columns}
            data={data?.refunds ?? []}
            keyField="id"
            loading={isLoading}
            onRowClick={(r) => setOpenPaymentId(r.paymentId)}
            emptyMessage={hasFilters ? 'No refunds match your filters.' : 'No refunds yet.'}
          />
        </Card>
      )}

      {data && data.pagination.total > LIMIT && (
        <Pagination page={page} pageSize={LIMIT} total={data.pagination.total} onPageChange={setPage} />
      )}

      <Modal open={!!openPaymentId} onClose={() => setOpenPaymentId(null)} title="Payment details" size="lg">
        {openPaymentId && <PaymentDetail id={openPaymentId} />}
      </Modal>
    </div>
  )
}
