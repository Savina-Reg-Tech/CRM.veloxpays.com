import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { useVVBillingPayment } from '../../hooks/useVVBillingReports'
import { INITIATOR_LABEL, centsMoney, orderLink, outcomeVariant, paymentStatusLabel, refundStatusVariant } from '../../billingReports'
import { formatDateTime } from '../../utils'
import type { BillingCustomer, BillingPaymentRow } from '../../types'

/** Shared cells and the payment detail for the Payments and Refunds report pages. */

export function OrderCell({ row }: { row: Pick<BillingPaymentRow, 'service' | 'orderNo' | 'visitId'> }) {
  if (!row.orderNo) return <span className="text-gray-300" title="No booking was made for this payment">—</span>
  const to = orderLink(row)
  const text = <span className="font-mono text-xs">{row.orderNo}</span>
  return to ? (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline">
      {text}
    </Link>
  ) : (
    <span className="text-gray-700">{text}</span>
  )
}

export function CustomerCell({ customer }: { customer: BillingCustomer | null }) {
  if (!customer) return <span className="text-gray-300">—</span>
  return (
    <Link
      to={`/dashboard/veloxverse/users/${encodeURIComponent(customer.id)}`}
      onClick={(e) => e.stopPropagation()}
      className="block min-w-0 hover:text-indigo-600"
    >
      <span className="block truncate text-gray-900">{customer.name || customer.email}</span>
      {customer.name && <span className="block truncate text-xs text-gray-400">{customer.email}</span>}
    </Link>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-right text-gray-900">{children}</span>
    </div>
  )
}

/** One payment with its amounts, refunds and card attempts (GET /admin/billing/payments/:id). */
export function PaymentDetail({ id }: { id: string }) {
  const { data, isLoading, isError } = useVVBillingPayment(id)
  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !data) return <p className="text-sm text-red-600">Couldn&rsquo;t load this payment.</p>
  const p = data.payment
  return (
    <div className="space-y-5">
      <section>
        <p className="mb-1 text-sm font-medium text-gray-900">{p.description}</p>
        <div className="divide-y divide-gray-50">
          <DetailRow label="Status">
            <Badge variant={outcomeVariant(p.outcome)}>{paymentStatusLabel(p.status)}</Badge>
          </DetailRow>
          <DetailRow label="Order">
            <OrderCell row={p} />
          </DetailRow>
          <DetailRow label="Customer">
            <CustomerCell customer={p.customer} />
          </DetailRow>
          <DetailRow label="Date">{formatDateTime(p.createdAt)}</DetailRow>
          <DetailRow label="Card provider">
            {p.provider}
            {p.metadata.cardBrand ? ` · ${p.metadata.cardBrand}` : ''}
          </DetailRow>
          {p.providerReference && (
            <DetailRow label="Transaction ref">
              <span className="font-mono text-xs">{p.providerReference}</span>
            </DetailRow>
          )}
          {p.invoiceNumber && <DetailRow label="Invoice">{p.invoiceNumber}</DetailRow>}
          <DetailRow label="Payment ID">
            <span className="font-mono text-xs">{p.id}</span>
          </DetailRow>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Amounts</h3>
        <div className="divide-y divide-gray-50">
          <DetailRow label="Order total">{centsMoney(p.orderTotalCents, p.currency)}</DetailRow>
          {p.creditAppliedCents > 0 && <DetailRow label="Paid with wallet credit">{centsMoney(p.creditAppliedCents, p.currency)}</DetailRow>}
          {p.pointsAppliedCents > 0 && <DetailRow label="Points applied">{centsMoney(p.pointsAppliedCents, p.currency)}</DetailRow>}
          {p.clubDiscountCents > 0 && <DetailRow label="VeloxClub discount">{centsMoney(p.clubDiscountCents, p.currency)}</DetailRow>}
          {p.promoDiscountCents > 0 && (
            <DetailRow label={`Promo ${p.promoCode ?? ''}`.trim()}>{centsMoney(p.promoDiscountCents, p.currency)}</DetailRow>
          )}
          <DetailRow label="Paid by card">{centsMoney(p.amountCents, p.currency)}</DetailRow>
          <DetailRow label="Card charge (real)">
            {p.chargeAmountCents == null ? 'No card charge' : centsMoney(p.chargeAmountCents, p.chargeCurrency)}
            {p.fxRate && p.chargeCurrency !== p.currency && (
              <span className="block text-xs text-gray-400">
                rate {Number(p.fxRate).toPrecision(6)} {p.chargeCurrency} per {p.currency}
              </span>
            )}
          </DetailRow>
          {!!p.refund.withheldCents && (
            <DetailRow label="Kept on cancellation">{centsMoney(p.refund.withheldCents, p.currency)}</DetailRow>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Refunds</h3>
        {data.refunds.length === 0 ? (
          <p className="text-sm text-gray-400">No refunds.</p>
        ) : (
          <ul className="space-y-2">
            {data.refunds.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">
                    {centsMoney(r.totalAmountCents, r.currency)}
                    {r.chargeAmountCents != null && r.chargeCurrency !== r.currency && (
                      <span className="ml-1 text-xs font-normal text-gray-400">card {centsMoney(r.chargeAmountCents, r.chargeCurrency)}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {r.stuck && <Badge variant="danger">Stuck</Badge>}
                    <Badge variant={refundStatusVariant(r.status)}>{r.status.toLowerCase()}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateTime(r.createdAt)} · by {INITIATOR_LABEL[r.initiatedBy.kind]}
                  {r.initiatedBy.email ? ` (${r.initiatedBy.email})` : ''}
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Card attempts</h3>
        {data.attempts.length === 0 ? (
          <p className="text-sm text-gray-400">No card attempts recorded.</p>
        ) : (
          <ul className="space-y-1 text-xs text-gray-600">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {formatDateTime(a.createdAt)} · {a.source}
                </span>
                <span className="font-medium">{a.providerStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

