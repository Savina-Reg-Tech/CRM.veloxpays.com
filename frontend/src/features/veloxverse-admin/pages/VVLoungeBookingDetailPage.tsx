import { useState, type ElementType, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  FileJson,
  Lock,
  Mail,
  Plane,
  Sparkles,
  Ticket,
  User,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVLoungeVisitDetail } from '../hooks/useVVLounge'
import {
  formatCentsIn,
  formatInZone,
  formatStamp,
  formatVisitDate,
  isWalkIn,
  partyLabel,
  paymentStatusVariant,
  serviceLabel,
  visitStatusLabel,
  visitStatusVariant,
} from '../loungeUtils'
import type { LoungeVisitDetail, LoungeVoucher } from '../types'

/* ─────────── small building blocks ─────────── */

type Val = ReactNode | string | number | boolean | null | undefined

function isEmpty(v: Val) {
  return v == null || v === '' || v === '—' || (Array.isArray(v) && v.length === 0)
}

function Section({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: ElementType
  title: string
  badge?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card padding="none" className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        {badge}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  )
}

/** Label/value grid; rows with empty values are skipped. */
function Fields({ rows, cols = 2 }: { rows: [string, Val][]; cols?: 2 | 3 }) {
  const visible = rows.filter(([, v]) => !isEmpty(v))
  if (!visible.length) return <p className="text-sm text-gray-400">No data.</p>
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {visible.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="break-words text-sm text-gray-900">
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[13px]">{children}</span>
}

function CopyValue({ value }: { value: string }) {
  const { showToast } = useToast()
  return (
    <span className="inline-flex items-center gap-1.5">
      <Mono>{value}</Mono>
      <button
        type="button"
        title="Copy"
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => showToast({ type: 'success', title: 'Copied' }))
        }
        className="text-gray-400 transition-colors hover:text-gray-700"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

function CopyList({ values }: { values: (string | null | undefined)[] | null | undefined }) {
  const list = (values ?? []).filter((v): v is string => !!v)
  if (!list.length) return null
  return (
    <span className="flex flex-col gap-1">
      {list.map((v) => (
        <CopyValue key={v} value={v} />
      ))}
    </span>
  )
}

/** Renders a `qrCode` value: image URL / data URI as-is, anything else encoded locally. */
function QrBlock({ value, label }: { value: string; label?: string }) {
  const isImage = /^(https?:|data:image\/)/i.test(value)
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {isImage ? (
        <img src={value} alt={label ?? 'QR code'} className="h-36 w-36 object-contain" />
      ) : (
        <QRCodeSVG value={value} size={144} />
      )}
      {label && <span className="max-w-[160px] break-all text-center font-mono text-[11px] text-gray-500">{label}</span>}
    </div>
  )
}

function str(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return null
}

function pick(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = str(rec[k])
    if (v) return v
  }
  return null
}

/** Best-effort rendering for loosely-typed upstream blobs (DragonPass status history, fitness vouchers…). */
function Loose({ value }: { value: unknown }) {
  if (value == null || value === '') return <span className="text-gray-400">—</span>
  const s = str(value)
  if (s) return <>{s}</>
  if (Array.isArray(value) && value.every((x) => str(x))) return <>{value.join(', ')}</>
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

/* ─────────── vouchers ─────────── */

function voucherCode(v: LoungeVoucher) {
  return v.code ?? v.voucherCode ?? pick(v, 'voucherNo', 'number', 'barcode') ?? null
}

function VoucherCard({ voucher, index }: { voucher: LoungeVoucher; index: number }) {
  const code = voucherCode(voucher)
  const type = (voucher.voucherType ?? voucher.type ?? '').toString().toUpperCase()
  const holder = voucher.passengerName ?? voucher.name ?? null
  const showQr = !!code && (type.includes('QR') || type === '')
  return (
    <div className="flex gap-4 rounded-lg border border-gray-200 p-3">
      {showQr && code && <QrBlock value={voucher.url && /^https?:/.test(voucher.url) ? voucher.url : code} />}
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Voucher {index + 1}
          {type && ` · ${type}`}
        </p>
        {code ? <CopyValue value={code} /> : <span className="text-gray-400">No code</span>}
        {type.includes('BAR') && (
          <p className="text-xs text-gray-500">Barcode voucher — scan value shown above.</p>
        )}
        {holder && <p className="text-gray-700">{holder}</p>}
        {voucher.status != null && (
          <p className="text-xs text-gray-500">
            Status: <span className="text-gray-900">{String(voucher.status)}</span>
          </p>
        )}
        {voucher.url && !showQr && (
          <a href={voucher.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
            Open voucher <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

function Vouchers({ vouchers }: { vouchers: LoungeVoucher[] | null | undefined }) {
  if (!vouchers?.length) return <p className="text-sm text-gray-400">No vouchers.</p>
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {vouchers.map((v, i) => (
        <VoucherCard key={voucherCode(v) ?? i} voucher={v} index={i} />
      ))}
    </div>
  )
}

/* ─────────── sections ─────────── */

function CustomerSection({ v }: { v: LoungeVisitDetail }) {
  const c = v.customer
  const email = c?.email ?? v.contactEmail
  return (
    <Section
      icon={User}
      title="Customer"
      badge={c ? <Badge variant={c.isGuest ? 'warning' : 'info'}>{c.isGuest ? 'Guest' : 'Registered'}</Badge> : undefined}
    >
      {c ? (
        <Fields
          rows={[
            ['Name', c.name],
            ['Email', c.email && <CopyValue value={c.email} />],
            ['Account type', c.isGuest ? 'Guest checkout' : `Registered${c.role && c.role !== 'USER' ? ` (${c.role})` : ''}`],
            ['Verified', c.isVerified],
            ['Active', c.isActive],
            ['Preferred currency', c.preferredCurrency],
            ['Registered', formatStamp(c.registeredAt)],
          ]}
        />
      ) : (
        <p className="text-sm text-gray-400">No linked VeloxVerse account.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {c?.id && (
          <Link
            to={`/dashboard/veloxverse/users/${c.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            VeloxVerse user profile <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {email && (
          <Link
            to={`/dashboard/customers?search=${encodeURIComponent(email)}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Find in CRM customers <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Section>
  )
}

function BookingSection({ v }: { v: LoungeVisitDetail }) {
  const loc = v.dragonpass?.location ?? v.metadata
  const terminal = pick(loc, 'terminal', 'terminalName') ?? pick(v.metadata, 'terminal', 'terminalName')
  const city = pick(loc, 'city', 'cityName') ?? pick(v.metadata, 'city', 'cityName')
  const phone = v.contactPhone ? `${v.contactCallingCode ? `+${v.contactCallingCode.replace(/^\+/, '')} ` : ''}${v.contactPhone}` : null
  const walkIn = isWalkIn(v)
  return (
    <Section icon={CalendarDays} title="Booking">
      <Fields
        rows={[
          ['Order no.', v.orderId && <CopyValue value={v.orderId} />],
          ['Service', `${serviceLabel(v)}${v.bookingType ? ` · ${v.bookingType === 'WALK_IN' ? 'Walk-in' : 'Prebook'}` : ''}`],
          ['Venue', v.loungeName],
          ['Venue id', v.loungeId && <Mono>{v.loungeId}</Mono>],
          ['Airport', v.airportCode],
          ['Terminal', terminal],
          ['City', city],
          [
            'Visit (local time)',
            walkIn && !v.visitTime
              ? `${formatVisitDate(v.visitDate)} · Walk-in pass`
              : `${formatVisitDate(v.visitDate)}${v.visitTime ? `, ${v.visitTime}` : ''}`,
          ],
          ['Lounge time zone', v.timeZone],
          ['Party', partyLabel(v)],
          ['Flight', v.flightNumber],
          ['Contact name', v.contactName],
          ['Contact email', v.contactEmail && <CopyValue value={v.contactEmail} />],
          ['Contact phone', phone],
          ['Booked at', formatStamp(v.bookedAt ?? v.createdAt)],
        ]}
      />
      {v.passengers && v.passengers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-gray-500">Passengers</p>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
            {v.passengers.map((p, i) => (
              <li key={i} className="flex justify-between px-3 py-1.5">
                <span className="text-gray-900">{p.name}</span>
                <span className="text-xs capitalize text-gray-500">{p.type?.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

function WalkinPassSection({ v }: { v: LoungeVisitDetail }) {
  const w = v.walkinPass
  if (!w) return null
  const tz = w.timeZone ?? v.timeZone
  const qrValue = v.qrCode ?? w.ePassId ?? v.epassCode
  const scope = w.scope?.resourceIds?.length
    ? `This lounge only (${w.scope.resourceIds.join(', ')})`
    : w.scope?.iata?.length
    ? `Any DragonPass lounge at ${w.scope.iata.join(', ')}`
    : null
  return (
    <Section
      icon={Ticket}
      title="Walk-in pass"
      badge={<Badge variant={visitStatusVariant(v)}>{visitStatusLabel(v)}</Badge>}
    >
      <div className="flex flex-col gap-5 md:flex-row">
        {qrValue && <QrBlock value={qrValue} label={w.ePassId ?? undefined} />}
        <div className="flex-1">
          <Fields
            rows={[
              ['ePass ID', w.ePassId && <CopyValue value={w.ePassId} />],
              ['Visits on pass', w.usages],
              ['Valid from (local time)', w.validFrom && formatInZone(w.validFrom, tz)],
              ['Valid until (local time)', w.validUntil && formatInZone(w.validUntil, tz)],
              ['Scope', scope],
              ['Expired at (local time)', w.expiredAt && formatInZone(w.expiredAt, tz)],
            ]}
          />
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-xs text-gray-500">Desk scans</p>
        {w.scans?.length ? (
          <table className="w-full rounded-md border border-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">#</th>
                <th className="px-3 py-1.5 font-medium">Result</th>
                <th className="px-3 py-1.5 font-medium">Time (local)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {w.scans.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    {s.status === 2 ? (
                      <Badge variant="success">Used</Badge>
                    ) : s.status === 3 ? (
                      <Badge variant="warning">Reversed by lounge</Badge>
                    ) : (
                      <Badge variant="neutral">{String(s.status)}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-900">{formatInZone(s.usageDate, tz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Not scanned yet.</p>
        )}
      </div>
    </Section>
  )
}

function DragonpassSection({ v }: { v: LoungeVisitDetail }) {
  const dp = v.dragonpass
  const orderIds = dp?.orderIds?.length ? dp.orderIds : v.dragonpassOrderIds
  const epassIds = dp?.epassIds?.length ? dp.epassIds : dp?.epassId ? [dp.epassId] : null
  const vouchers = dp?.vouchers?.length ? dp.vouchers : v.vouchers
  const fitness = dp?.fitnessVouchers
  const hasFitness = Array.isArray(fitness) ? fitness.length > 0 : fitness != null
  return (
    <Section icon={Plane} title="DragonPass">
      <Fields
        rows={[
          ['Order id(s)', orderIds?.length ? <CopyList values={orderIds} /> : null],
          ['Reference', dp?.reference && <CopyValue value={dp.reference} />],
          ['ePass id(s)', <CopyList values={epassIds} />],
          ['ePass code', (dp?.epassCode ?? v.epassCode) && <CopyValue value={(dp?.epassCode ?? v.epassCode)!} />],
          ['ePass issued', dp?.epassIssued == null ? null : dp.epassLocal ? 'Local fallback (not issued by DragonPass)' : dp.epassIssued],
          ['Prebooked (time slot)', dp ? dp.prebooked : null],
          ['Last status', str(dp?.lastStatus)],
          ['Last walk-in status', str(dp?.lastWalkinStatus)],
        ]}
      />
      {dp?.lastStatusChangedDates != null && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-gray-500">Status change dates</p>
          <Loose value={dp.lastStatusChangedDates} />
        </div>
      )}
      {!isWalkIn(v) && v.qrCode && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-gray-500">Booking QR</p>
          <QrBlock value={v.qrCode} />
        </div>
      )}
      <div className="mt-4">
        <p className="mb-1.5 text-xs text-gray-500">Vouchers</p>
        <Vouchers vouchers={vouchers} />
      </div>
      {hasFitness && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-gray-500">Fitness vouchers (per person)</p>
          {Array.isArray(fitness) && fitness.every((f) => f && typeof f === 'object') ? (
            <Vouchers vouchers={fitness as LoungeVoucher[]} />
          ) : (
            <Loose value={fitness} />
          )}
        </div>
      )}
    </Section>
  )
}

function PaymentSection({ v }: { v: LoungeVisitDetail }) {
  const p = v.payment
  const cur = p?.currency ?? v.currency
  const cents = (n: number | null | undefined) => (n ? formatCentsIn(n, cur) : null)
  return (
    <Section
      icon={CreditCard}
      title="Payment"
      badge={p ? <Badge variant={paymentStatusVariant(p.status)}>{p.status}</Badge> : undefined}
    >
      {p ? (
        <>
          <Fields
            rows={[
              ['Charged to card', <span className="font-semibold">{formatCentsIn(p.amountCents, cur)}</span>],
              ['Booking total', formatCentsIn(v.totalCost, v.currency)],
              ['Provider', p.provider],
              ['Mint reference', p.providerReference && <CopyValue value={p.providerReference} />],
              ['Invoice no.', p.invoiceNumber && <CopyValue value={p.invoiceNumber} />],
              ['Wallet credit applied', cents(p.creditAppliedCents)],
              [
                'Points applied',
                p.pointsAppliedCents
                  ? `${formatCentsIn(p.pointsAppliedCents, cur)}${p.pointsRedeemed ? ` (${p.pointsRedeemed.toLocaleString()} pts)` : ''}`
                  : null,
              ],
              ['Promo code', p.promoCode && <Mono>{p.promoCode}</Mono>],
              ['Promo discount', cents(p.promoDiscountCents)],
              ['VeloxClub discount', cents(p.clubDiscountCents)],
              ['Charge attempted', formatStamp(p.chargeAttemptedAt)],
              [
                'Charge response',
                p.chargeResponse && (p.chargeResponse.code != null || p.chargeResponse.message)
                  ? `${p.chargeResponse.code ?? ''}${p.chargeResponse.message ? ` — ${p.chargeResponse.message}` : ''}`
                  : null,
              ],
              ['Payment id', <Mono>{p.id}</Mono>],
              ['Created', formatStamp(p.createdAt)],
              ['Updated', formatStamp(p.updatedAt)],
            ]}
          />
          {p.card && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Card</p>
              <Fields
                cols={3}
                rows={[
                  ['Brand', p.card.brand],
                  ['Number', p.card.number && <Mono>{p.card.number}</Mono>],
                  ['Holder', p.card.holderName],
                  ['Country', p.card.country],
                  ['Funding', p.card.funding],
                ]}
              />
            </div>
          )}
          {p.refund && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sky-700">Refund</p>
              <Fields
                rows={[
                  // Refund amount is reported in its own currency (may differ from the booking's).
                  ['Amount', p.refund.amount != null ? formatCentsIn(p.refund.amount, p.refund.currency ?? cur) : null],
                  ['Status', p.refund.status],
                  ['Reference', p.refund.reference && <CopyValue value={p.refund.reference} />],
                  ['Refunded at', formatStamp(p.refund.at)],
                ]}
              />
            </div>
          )}
        </>
      ) : (
        <Fields
          rows={[
            ['Payment', 'No card payment record (older wallet booking)'],
            ['Payment method', v.paymentMethod],
            ['Wallet transaction', v.walletTransactionId && <CopyValue value={v.walletTransactionId} />],
            ['Booking total', formatCentsIn(v.totalCost, v.currency)],
          ]}
        />
      )}
      {v.nativePrice && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Currency conversion</p>
          <Fields
            cols={3}
            rows={[
              [
                `Original price (${v.nativePrice.nativeCurrency})`,
                formatCentsIn(v.nativePrice.nativeAmountCents, v.nativePrice.nativeCurrency),
              ],
              [
                `FX rate (${v.nativePrice.nativeCurrency} → ${v.nativePrice.paymentCurrency})`,
                `${v.nativePrice.fxRate.toFixed(4)} via ${v.nativePrice.fxProvider}`,
              ],
              [
                `Customer price (${v.nativePrice.paymentCurrency})`,
                formatCentsIn(v.nativePrice.convertedAmountCents, v.nativePrice.paymentCurrency),
              ],
              ['Rate fetched', formatStamp(v.nativePrice.fxRateFetchedAt)],
            ]}
          />
        </div>
      )}
    </Section>
  )
}

function PricingSection({ v }: { v: LoungeVisitDetail }) {
  const b = v.breakdown
  if (!b) return null
  const row = (label: string, cents: number, sign = '', tone = 'text-gray-900') =>
    cents ? (
      <div className="flex justify-between">
        <span className="text-gray-600">{label}</span>
        <span className={tone}>
          {sign}
          {formatCentsIn(cents, b.currency)}
        </span>
      </div>
    ) : null
  return (
    <Section
      icon={Lock}
      title="Pricing"
      badge={<Badge variant="danger">Internal only — never share with customers</Badge>}
    >
      <div className="space-y-1.5 text-sm">
        {row('Base cost', b.baseCents)}
        {row('Margin', b.marginCents, '+', 'text-emerald-600')}
        {row('Surge', b.surgeCents, '+', 'text-emerald-600')}
        {row('Promo discount', b.promoDiscountCents, '−', 'text-red-500')}
        {row('Refund protection fee', b.refundFeeCents, '+')}
        <div className="flex justify-between border-t border-gray-200 pt-1.5">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-gray-900">{formatCentsIn(b.totalCents, b.currency)}</span>
        </div>
      </div>
      <div className="mt-4">
        <Fields
          cols={3}
          rows={[
            ['Profit (margin + surge)', formatCentsIn(b.marginCents + b.surgeCents, b.currency)],
            ['Price per visit', v.pricePerVisitCents != null ? formatCentsIn(v.pricePerVisitCents, b.currency) : null],
            ['Price per guest', v.pricePerGuestCents != null ? formatCentsIn(v.pricePerGuestCents, b.currency) : null],
            ['Surge applied', v.surgeApplied],
          ]}
        />
      </div>
    </Section>
  )
}

function CancellationSection({ v }: { v: LoungeVisitDetail }) {
  return (
    <Section
      icon={Ban}
      title="Cancellation"
      badge={<Badge variant={v.isRefundable ? 'success' : 'neutral'}>{v.isRefundable ? 'Flexible' : 'Standard'}</Badge>}
    >
      <Fields
        rows={[
          ['Refundable', v.isRefundable ? 'Yes (Flexible)' : 'No (Standard)'],
          ['Cancellable now', v.cancellable ?? null],
          ['Cancellation window', v.cancellationHoursBefore != null ? `${v.cancellationHoursBefore} h before visit (local time)` : null],
          ['Refundable amount', v.isRefundable ? formatCentsIn(v.refundableCents, v.currency) : null],
          ['Cancelled at', formatStamp(v.cancelledAt)],
          ['Cancelled by', v.cancelledBy],
        ]}
      />
      {v.cancellationPolicy && (
        <p className="mt-4 whitespace-pre-line rounded-md bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
          {v.cancellationPolicy}
        </p>
      )}
    </Section>
  )
}

function ClubDiningSection({ v }: { v: LoungeVisitDetail }) {
  const d = v.dining
  const club = v.club
  if (!d && !club?.applied) return null
  const items = d?.setMealItems
  return (
    <Section icon={Sparkles} title="Club & dining">
      <Fields
        rows={[
          ['VeloxClub benefit applied', club ? club.applied : null],
          ['Benefit key', club?.benefitKey && <Mono>{club.benefitKey}</Mono>],
          ['Claim id', club?.claimId && <Mono>{club.claimId}</Mono>],
          ['Cuisine', d?.cuisineType],
          ['Offer', d?.offerLabel ?? d?.offerType],
          ['Offer type', d?.offerLabel ? d?.offerType : null],
          [
            'Coupon value',
            d?.couponValueCents != null
              ? formatCentsIn(d.couponValueCents, d.couponCurrency ?? v.currency)
              : str(d?.couponValue),
          ],
          ['Discount', str(d?.discount)],
        ]}
      />
      {items != null && (Array.isArray(items) ? items.length > 0 : true) && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-gray-500">Set meal items</p>
          {Array.isArray(items) && items.every((i) => str(i) || pick(i, 'name', 'title')) ? (
            <ul className="list-inside list-disc text-sm text-gray-900">
              {items.map((i, idx) => (
                <li key={idx}>{str(i) ?? pick(i, 'name', 'title')}</li>
              ))}
            </ul>
          ) : (
            <Loose value={items} />
          )}
        </div>
      )}
    </Section>
  )
}

function EmailsSection({ v }: { v: LoungeVisitDetail }) {
  const e = v.emails
  const pending = e?.pendingConfirmationEmail
  return (
    <Section icon={Mail} title="Emails">
      <Fields
        rows={[
          ['Confirmation sent', e?.confirmationSentAt ? formatStamp(e.confirmationSentAt) : 'Not sent yet'],
          [
            'Pending confirmation email',
            pending == null || pending === false ? null : typeof pending === 'object' ? <Loose value={pending} /> : str(pending) ?? 'Yes',
          ],
        ]}
      />
    </Section>
  )
}

function RawRecordSection({ v }: { v: LoungeVisitDetail }) {
  const [open, setOpen] = useState(false)
  const { showToast } = useToast()
  if (!v.metadata) return null
  const json = JSON.stringify(v.metadata, null, 2)
  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Raw record</span>
          <span className="text-xs text-gray-400">stored booking metadata (DragonPass tokens removed)</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(json).then(() => showToast({ type: 'success', title: 'JSON copied' }))}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
          >
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </button>
          <pre className="max-h-[480px] overflow-auto rounded-md bg-gray-900 p-4 text-[11px] leading-relaxed text-gray-100">{json}</pre>
        </div>
      )}
    </Card>
  )
}

/* ─────────── page ─────────── */

export default function VVLoungeBookingDetailPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()
  const { data: visit, isLoading, isError, error } = useVVLoungeVisitDetail(visitId)

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard/veloxverse/lounge'))}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to bookings
    </button>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !visit) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <p className="text-sm text-red-600">
            Couldn't load this booking{error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </Card>
      </div>
    )
  }

  const walkIn = isWalkIn(visit)

  return (
    <div className="max-w-full space-y-5">
      {back}

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{visit.loungeName ?? 'Unknown venue'}</h1>
              <Badge variant={visitStatusVariant(visit)}>{visitStatusLabel(visit)}</Badge>
              <Badge variant="neutral">{serviceLabel(visit)}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-mono">{visit.orderId ?? visit.id}</span>
              {visit.airportCode && ` · ${visit.airportCode}`}
              {' · '}
              {formatVisitDate(visit.visitDate)}
              {walkIn ? ' · Walk-in pass' : visit.visitTime ? `, ${visit.visitTime} local time` : ''}
              {' · '}
              {partyLabel(visit)}
            </p>
            {(visit.customer || visit.contactName) && (
              <p className="mt-1 text-sm text-gray-700">
                {visit.customer?.name ?? visit.contactName}
                {(visit.customer?.email ?? visit.contactEmail) && (
                  <span className="text-gray-500"> · {visit.customer?.email ?? visit.contactEmail}</span>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatCentsIn(visit.totalCost, visit.currency)}</p>
            {visit.paymentStatus && (
              <Badge variant={paymentStatusVariant(visit.paymentStatus.status)}>{visit.paymentStatus.status}</Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CustomerSection v={visit} />
        <BookingSection v={visit} />
      </div>

      <WalkinPassSection v={visit} />
      <DragonpassSection v={visit} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PaymentSection v={visit} />
        <div className="space-y-5">
          <PricingSection v={visit} />
          <CancellationSection v={visit} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ClubDiningSection v={visit} />
        <EmailsSection v={visit} />
      </div>

      <RawRecordSection v={visit} />
    </div>
  )
}
