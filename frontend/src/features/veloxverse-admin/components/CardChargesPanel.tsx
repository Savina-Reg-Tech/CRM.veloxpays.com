import { useState, type ReactNode } from 'react'
import { CreditCard, Info, Landmark, Receipt, TicketPercent, Undo2, Wallet } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { formatMoney } from '@/lib/utils'
import { useVVCardCharges } from '../hooks/useVVAnalytics'
import { averagePayment, honoursWindow, type CardChargeWindow } from '../cardChargeWindow'
import { isReversedRange } from '../reportRange'
import { serviceLabel } from '../billingReports'

// Rolling periods VeloxVerse has always supported, then calendar ranges sent as from / to.
const WINDOWS: { key: string; label: string; window: CardChargeWindow }[] = [
  { key: '7d', label: '7 days', window: { kind: 'period', period: '7d' } },
  { key: '30d', label: '30 days', window: { kind: 'period', period: '30d' } },
  { key: '90d', label: '90 days', window: { kind: 'period', period: '90d' } },
  { key: '12m', label: '12 months', window: { kind: 'period', period: '12m' } },
  { key: 'thisMonth', label: 'This month', window: { kind: 'range', range: { preset: 'thisMonth' } } },
  { key: 'lastMonth', label: 'Last month', window: { kind: 'range', range: { preset: 'lastMonth' } } },
  { key: 'custom', label: 'Custom', window: { kind: 'range', range: { preset: 'custom' } } },
  { key: 'all', label: 'All time', window: { kind: 'period', period: 'all' } },
]

const dateInputClass =
  'h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-base text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-36 sm:flex-none sm:text-xs'

function Tile({
  icon,
  tint,
  label,
  value,
  sub,
  prominent = false,
}: {
  icon: ReactNode
  tint: string
  label: string
  value: string
  sub?: string
  prominent?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 shadow-sm ${
        prominent ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-gray-200 bg-white'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`break-words font-bold tabular-nums ${prominent ? 'text-2xl text-emerald-700' : 'text-xl text-gray-900'}`}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

/**
 * The real card money collected through Mint, in AUD (GET /admin/analytics/card-charges) — what
 * the Mint merchant portal shows. Deliberately separate from the "estimated" revenue cards, which
 * are FX-converted from each booking's customer currency at today's rate.
 */
export default function CardChargesPanel({ showByService = true }: { showByService?: boolean }) {
  const [key, setKey] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const base = WINDOWS.find((w) => w.key === key)!.window
  const selected: CardChargeWindow =
    key === 'custom' ? { kind: 'range', range: { preset: 'custom', customFrom: customFrom || undefined, customTo: customTo || undefined } } : base
  const reversed = selected.kind === 'range' && isReversedRange(selected.range)
  const { data, isLoading, isError, isFetching } = useVVCardCharges(selected)
  const cur = data?.currency ?? 'AUD'
  const average = data ? averagePayment(data.charged, data.paymentCount) : null
  const hasPromo = typeof data?.promoDiscount === 'number'

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Card money collected (AUD)</h2>
          <p className="text-xs text-gray-500">Actual card money collected through Mint, in AUD.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Period">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              role="tab"
              aria-selected={key === w.key}
              onClick={() => setKey(w.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                key === w.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {key === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <input type="date" aria-label="From date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={dateInputClass} />
          <span aria-hidden="true">–</span>
          <input type="date" aria-label="To date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={dateInputClass} />
          {reversed && <span className="w-full text-red-600">The end date is before the start date.</span>}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : isError || !data ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Couldn&rsquo;t load the AUD card totals from VeloxVerse. Try reloading in a moment.
        </p>
      ) : !honoursWindow(selected, data) ? (
        // Never show all-time money under a calendar label.
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          VeloxVerse doesn&rsquo;t support calendar months or custom dates yet, so these totals can&rsquo;t be shown for
          this choice. Use 7 / 30 / 90 days, 12 months or All time until it&rsquo;s updated.
        </p>
      ) : (
        <div className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Tile
              icon={<Landmark className="h-5 w-5 text-emerald-600" />}
              tint="bg-white ring-1 ring-emerald-200"
              label={`Net collected (${cur})`}
              value={formatMoney(data.net, cur)}
              sub="Collected − refunded"
              prominent
            />
            <Tile
              icon={<CreditCard className="h-5 w-5 text-indigo-500" />}
              tint="bg-indigo-50"
              label={`Collected (${cur})`}
              value={formatMoney(data.charged, cur)}
            />
            <Tile
              icon={<Undo2 className="h-5 w-5 text-red-500" />}
              tint="bg-red-50"
              label={`Refunded (${cur})`}
              value={formatMoney(data.refunded, cur)}
            />
            <Tile
              icon={<Receipt className="h-5 w-5 text-sky-500" />}
              tint="bg-sky-50"
              label="Card payments"
              value={data.paymentCount.toLocaleString()}
              sub={`${data.refundCount.toLocaleString()} refund${data.refundCount === 1 ? '' : 's'}`}
            />
            <Tile
              icon={<Wallet className="h-5 w-5 text-violet-500" />}
              tint="bg-violet-50"
              label={`Average card payment (${cur})`}
              value={average == null ? '—' : formatMoney(average, cur)}
              sub="Collected ÷ card payments"
            />
            {hasPromo && (
              <Tile
                icon={<TicketPercent className="h-5 w-5 text-amber-500" />}
                tint="bg-amber-50"
                label={`Promo discounts given (${cur})`}
                value={formatMoney(data.promoDiscount ?? 0, cur)}
                sub={`${(data.promoOrderCount ?? 0).toLocaleString()} order${data.promoOrderCount === 1 ? '' : 's'} with a promo code`}
              />
            )}
          </div>

          {showByService && data.byService.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5 text-left">By service</th>
                    <th className="px-4 py-2.5 text-right">Collected</th>
                    <th className="px-4 py-2.5 text-right">Refunded</th>
                    <th className="px-4 py-2.5 text-right">Net</th>
                    <th className="px-4 py-2.5 text-right">Payments</th>
                    <th className="px-4 py-2.5 text-right">Avg payment</th>
                    {hasPromo && <th className="px-4 py-2.5 text-right">Promo discounts</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.byService.map((s) => (
                    <tr key={s.service}>
                      <td className="px-4 py-2.5 text-gray-900">{serviceLabel(s.service)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{formatMoney(s.charged, cur)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{formatMoney(s.refunded, cur)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatMoney(s.net, cur)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">
                        {s.paymentCount.toLocaleString()}
                        {s.refundCount > 0 && <span className="text-gray-400"> · {s.refundCount.toLocaleString()} refunded</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                        {(() => {
                          const avg = averagePayment(s.charged, s.paymentCount)
                          return avg == null ? '—' : formatMoney(avg, cur)
                        })()}
                      </td>
                      {hasPromo && (
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                          {formatMoney(s.promoDiscount ?? 0, cur)}
                          {!!s.promoOrderCount && <span className="text-gray-400"> · {s.promoOrderCount.toLocaleString()}</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.paymentsWithoutAud > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              {data.paymentsWithoutAud.toLocaleString()} older payment{data.paymentsWithoutAud === 1 ? ' was' : 's were'} made
              before AUD charging and {data.paymentsWithoutAud === 1 ? 'is' : 'are'} not included.
            </p>
          )}
          {!!data.promoWithoutAud && (
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              {data.promoWithoutAud.toLocaleString()} promo order{data.promoWithoutAud === 1 ? ' has' : 's have'} no AUD card
              charge (wallet or points only, or made before AUD charging) and {data.promoWithoutAud === 1 ? 'is' : 'are'} not
              in the promo total.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
