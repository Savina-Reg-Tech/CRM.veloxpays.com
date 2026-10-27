import { useEffect, useMemo, useState } from 'react'
import { Info, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import StatTile from '../components/StatTile'
import DateRangeFilter from '../components/reports/DateRangeFilter'
import ExportCsvButton from '../components/reports/ExportCsvButton'
import { useVVBillingPayments } from '../hooks/useVVBillingReports'
import { CustomerCell, OrderCell, PaymentDetail } from '../components/reports/BillingReportParts'
import { vvBillingReportsService } from '../vvAdminService'
import { ALL_TIME, isReversedRange, rangeParams, type ReportRange } from '../reportRange'
import { BILLING_SERVICES, OUTCOME_LABEL, centsMoney, outcomeVariant, paymentStatusLabel, serviceLabel } from '../billingReports'
import { formatDateTime } from '../utils'
import type { BillingOutcome, BillingPaymentFilters, BillingPaymentRow, BillingService } from '../types'

const LIMIT = 20

const selectClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors sm:text-sm'

/** The customer's price, with the AUD the card was really charged underneath. */
function AmountCell({ row }: { row: BillingPaymentRow }) {
  return (
    <div className="whitespace-nowrap">
      <span className="text-gray-900">{centsMoney(row.orderTotalCents, row.currency)}</span>
      {row.chargeAmountCents != null && row.chargeCurrency !== row.currency && (
        <span className="block text-xs text-gray-400">card {centsMoney(row.chargeAmountCents, row.chargeCurrency)}</span>
      )}
      {row.chargeAmountCents == null && row.outcome === 'paid' && (
        <span className="block text-xs text-gray-400" title="Paid with wallet credit or points, or before AUD charging">
          no card charge
        </span>
      )}
    </div>
  )
}

function RefundCell({ row }: { row: BillingPaymentRow }) {
  const r = row.refund
  if (!r.count && !r.withheldCents) return <span className="text-gray-300">—</span>
  return (
    <div className="whitespace-nowrap text-xs">
      {r.succeededCents > 0 && <span className="block text-gray-700">{centsMoney(r.succeededCents, row.currency)} refunded</span>}
      {r.pendingCount > 0 && <span className="block text-amber-600">{r.pendingCount} pending</span>}
      {r.failedCount > 0 && <span className="block text-red-600">{r.failedCount} failed</span>}
      {!!r.withheldCents && <span className="block text-gray-400">{centsMoney(r.withheldCents, row.currency)} kept</span>}
    </div>
  )
}

export default function VVPaymentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<'' | BillingOutcome>('')
  const [service, setService] = useState<'' | BillingService>('')
  const [provider, setProvider] = useState<'' | 'MINT' | 'STRIPE'>('')
  const [refunded, setRefunded] = useState<'' | 'true' | 'false'>('')
  const [range, setRange] = useState<ReportRange>(ALL_TIME)
  const [openId, setOpenId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search.trim(), 300)

  // VeloxVerse applies every filter across all payments (the summary covers every match); a
  // reversed custom range is not sent (the filter shows why).
  const filters = useMemo<BillingPaymentFilters>(
    () => ({
      search: debouncedSearch || undefined,
      outcome: outcome || undefined,
      service: service || undefined,
      provider: provider || undefined,
      refunded: refunded ? refunded === 'true' : undefined,
      ...(isReversedRange(range) ? {} : rangeParams(range)),
    }),
    [debouncedSearch, outcome, service, provider, refunded, range]
  )
  const hasFilters = Boolean(search || outcome || service || provider || refunded || range.preset !== 'all')
  useEffect(() => {
    setPage(1)
  }, [filters])

  const { data, isLoading, isFetching, isError } = useVVBillingPayments(page, LIMIT, filters)
  const summary = data?.summary
  const cur = summary?.currency ?? 'AUD'

  const clear = () => {
    setSearch('')
    setOutcome('')
    setService('')
    setProvider('')
    setRefunded('')
    setRange(ALL_TIME)
  }

  const columns = [
    { key: 'createdAt', header: 'Date', render: (r: BillingPaymentRow) => <span className="whitespace-nowrap text-gray-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'orderNo', header: 'Order', render: (r: BillingPaymentRow) => <OrderCell row={r} /> },
    { key: 'customer', header: 'Customer', render: (r: BillingPaymentRow) => <CustomerCell customer={r.customer} /> },
    { key: 'service', header: 'Service', render: (r: BillingPaymentRow) => <span className="whitespace-nowrap text-gray-700">{serviceLabel(r.service)}</span> },
    { key: 'amount', header: 'Amount', render: (r: BillingPaymentRow) => <AmountCell row={r} /> },
    {
      key: 'promo',
      header: 'Promo',
      render: (r: BillingPaymentRow) =>
        r.promoDiscountCents > 0 ? (
          <span className="whitespace-nowrap text-xs text-gray-600">
            −{centsMoney(r.promoDiscountCents, r.currency)}
            {r.promoCode && <span className="block font-mono text-gray-400">{r.promoCode}</span>}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    { key: 'refund', header: 'Refunds', render: (r: BillingPaymentRow) => <RefundCell row={r} /> },
    {
      key: 'status',
      header: 'Status',
      render: (r: BillingPaymentRow) => (
        <Badge variant={outcomeVariant(r.outcome)}>
          <span title={paymentStatusLabel(r.status)}>{r.outcome ? OUTCOME_LABEL[r.outcome] : paymentStatusLabel(r.status)}</span>
        </Badge>
      ),
    },
  ]

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">Every VeloxVerse payment across all customers. Click a row for the full details.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Charged (${cur})`} value={summary ? centsMoney(summary.chargedAudCents, cur) : '—'} sub={summary ? `${summary.paidCount.toLocaleString()} paid` : undefined} />
        <StatTile label={`Refunded (${cur})`} value={summary ? centsMoney(summary.refundedAudCents, cur) : '—'} sub="of these payments" />
        <StatTile label={`Net (${cur})`} value={summary ? centsMoney(summary.netAudCents, cur) : '—'} />
        <StatTile
          label="No card charge"
          value={summary ? summary.withoutAudCount.toLocaleString() : '—'}
          sub="wallet / points only — not in totals"
        />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        Totals cover every matching paid payment, in the real AUD charged. Refunds here belong to the payments listed, whenever they
        were refunded — Analytics counts a refund in the month it happened, so the two can differ.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order, customer, transaction ref, invoice, promo…"
            aria-label="Search payments"
            className={`${selectClass} w-full pl-8`}
          />
        </div>
        <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as '' | BillingOutcome)} className={selectClass}>
          <option value="">All outcomes</option>
          {(Object.keys(OUTCOME_LABEL) as BillingOutcome[]).map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
        <select aria-label="Service" value={service} onChange={(e) => setService(e.target.value as '' | BillingService)} className={selectClass}>
          <option value="">All services</option>
          {BILLING_SERVICES.map((s) => (
            <option key={s} value={s}>
              {serviceLabel(s)}
            </option>
          ))}
        </select>
        <select aria-label="Card provider" value={provider} onChange={(e) => setProvider(e.target.value as '' | 'MINT' | 'STRIPE')} className={selectClass}>
          <option value="">Any provider</option>
          <option value="MINT">Mint</option>
          <option value="STRIPE">Stripe</option>
        </select>
        <select aria-label="Refunded" value={refunded} onChange={(e) => setRefunded(e.target.value as '' | 'true' | 'false')} className={selectClass}>
          <option value="">Refunded or not</option>
          <option value="true">Refunded</option>
          <option value="false">Not refunded</option>
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
          onExport={() => vvBillingReportsService.exportPayments(filters)}
        />
      </div>

      {isError ? (
        <Card>
          <p className="py-8 text-center text-sm text-red-600">Couldn&rsquo;t load payments from VeloxVerse. Try reloading in a moment.</p>
        </Card>
      ) : (
        <Card padding="none">
          <Table
            columns={columns}
            data={data?.payments ?? []}
            keyField="id"
            loading={isLoading}
            onRowClick={(r) => setOpenId(r.id)}
            emptyMessage={hasFilters ? 'No payments match your filters.' : 'No payments yet.'}
          />
        </Card>
      )}

      {data && data.pagination.total > LIMIT && (
        <Pagination page={page} pageSize={LIMIT} total={data.pagination.total} onPageChange={setPage} />
      )}

      <Modal open={!!openId} onClose={() => setOpenId(null)} title="Payment details" size="lg">
        {openId && <PaymentDetail id={openId} />}
      </Modal>
    </div>
  )
}
