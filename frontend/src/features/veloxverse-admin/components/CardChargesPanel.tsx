import { useState, type ReactNode } from 'react'
import { CreditCard, Info, Landmark, Receipt, Undo2 } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { formatMoney } from '@/lib/utils'
import { useVVCardCharges } from '../hooks/useVVAnalytics'
import type { CardChargePeriod } from '../types'

const PERIODS: { value: CardChargePeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All time' },
]

const SERVICE_LABEL: Record<string, string> = {
  ESIM_ORDER: 'eSIM',
  ESIM_TOPUP: 'eSIM top-up',
  LOUNGE_VISIT: 'Lounge & benefits',
  TRANSFER: 'Pick & Drop',
  CLUB_MEMBERSHIP: 'VeloxClub',
  FLIGHT_BOOKING: 'Flights',
}

function serviceLabel(service: string): string {
  return SERVICE_LABEL[service] ?? service.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

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
        <p className={`truncate font-bold tabular-nums ${prominent ? 'text-2xl text-emerald-700' : 'text-xl text-gray-900'}`}>
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
  const [period, setPeriod] = useState<CardChargePeriod>('30d')
  const { data, isLoading, isError, isFetching } = useVVCardCharges(period)
  const cur = data?.currency ?? 'AUD'

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Card money collected (AUD)</h2>
          <p className="text-xs text-gray-500">Actual card money collected through Mint, in AUD.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                period === p.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : isError || !data ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Couldn&rsquo;t load the AUD card totals from VeloxVerse. Try reloading in a moment.
        </p>
      ) : (
        <div className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      )}
    </section>
  )
}
