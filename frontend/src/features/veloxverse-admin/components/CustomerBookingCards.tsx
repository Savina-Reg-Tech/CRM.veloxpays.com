import { useState, type ElementType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair,
  Briefcase,
  CalendarDays,
  Car,
  ChevronDown,
  Clock,
  Crown,
  Dumbbell,
  ExternalLink,
  FileText,
  Hash,
  LifeBuoy,
  Luggage,
  Mail,
  MapPin,
  Phone,
  Plane,
  QrCode,
  Receipt,
  Route,
  ShieldCheck,
  Smartphone,
  Ticket,
  User,
  Users,
  UtensilsCrossed,
  Wifi,
  Zap,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { formatMoney } from '@/lib/utils'
import { useForm } from '@/features/forms/hooks/useForms'
import { formApi } from '@/features/forms/formService'
import { SubmissionDataView } from '@/features/forms/utils/submissionDisplay'
import type { Lead } from '@/features/forms/types'
import { useVVEsimDetail } from '../hooks/useVVEsim'
import { formatDate, formatDateTime, statusBadgeVariant } from '../utils'
import {
  formatCentsIn,
  formatVisitDate,
  isWalkIn,
  partyLabel,
  paymentStatusVariant,
  serviceLabel,
  visitStatusLabel,
  visitStatusVariant,
} from '../loungeUtils'
import type {
  AdminBillingLineItem,
  AdminTransferBooking,
  ClubMembershipDetail,
  LoungeVisit,
  VVAdminUserDetail,
  VVSupportTicket,
} from '../types'

// ── Shared building blocks ──────────────────────────────────────────

/** Booking card that shows the essentials collapsed and the full booking on click. Details are
 * only mounted once opened, so per-card lazy fetches (eSIM live status, form labels) cost
 * nothing until an admin actually looks. */
function ExpandableCard({
  icon: Icon,
  tint,
  title,
  subtitle,
  status,
  amount,
  amountSub,
  children,
  fullViewHref,
  fullViewLabel = 'Open full booking',
}: {
  icon: ElementType
  tint: string
  title: ReactNode
  subtitle?: ReactNode
  status?: ReactNode
  amount?: ReactNode
  amountSub?: ReactNode
  children: ReactNode
  fullViewHref?: string
  fullViewLabel?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition ${
        open ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-semibold text-gray-900">{title}</p>
            {status}
          </div>
          {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {amount !== undefined && (
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{amount}</p>
              {amountSub && <p className="text-[11px] text-gray-500">{amountSub}</p>}
            </div>
          )}
          <ChevronDown
            className={`mt-0.5 h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          {children}
          {fullViewHref && (
            <div className="flex justify-end">
              <Link
                to={fullViewHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {fullViewLabel} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function Field({ icon: Icon, label, children }: { icon?: ElementType; label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <div className="flex min-w-0 items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <div className="break-words text-sm text-gray-900">{empty ? <span className="text-gray-400">—</span> : children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
        <Icon className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}

/** Status filter chips built from the statuses actually present — so an admin can narrow a long
 * booking history to e.g. just CANCELLED without any status the customer never had cluttering it. */
export function StatusChips({
  statuses,
  value,
  onChange,
}: {
  statuses: string[]
  value: string
  onChange: (s: string) => void
}) {
  const counts = new Map<string, number>()
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1)
  if (counts.size < 2) return null
  const chip = (key: string, label: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        value === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {chip('', 'All', statuses.length)}
      {[...counts.entries()].map(([s, n]) => chip(s, s.replace(/_/g, ' '), n))}
    </div>
  )
}

const PAYMENT_METHOD_LABELS: Record<string, string> = { STRIPE: 'Card (Stripe)', MINT: 'Card (Mint)', WALLET: 'Wallet' }
function paymentMethodLabel(method: string | null | undefined): string | null {
  if (!method) return null
  return PAYMENT_METHOD_LABELS[method.toUpperCase()] ?? method
}

function formatBytes(bytes?: number | null): string | null {
  if (bytes === undefined || bytes === null) return null
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

// ── eSIM ───────────────────────────────────────────────────────────

type EsimOrder = VVAdminUserDetail['orders'][number]

export function EsimOrderCard({ order, payment }: { order: EsimOrder; payment?: AdminBillingLineItem }) {
  return (
    <ExpandableCard
      icon={Wifi}
      tint="bg-blue-50 text-blue-600"
      title={order.packageName || 'eSIM package'}
      status={<Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>}
      subtitle={
        <span className="flex flex-wrap gap-x-3">
          <span className="font-mono">{order.orderNo}</span>
          {payment && <span>Ordered {formatDateTime(payment.date)}</span>}
        </span>
      }
      amount={formatMoney(order.priceUsd ?? 0, order.currency)}
      amountSub={paymentMethodLabel(payment?.paymentMethod) ?? undefined}
      fullViewHref={`/dashboard/veloxverse/esim-orders/${encodeURIComponent(order.orderNo)}`}
      fullViewLabel="Open eSIM order"
    >
      <EsimOrderDetails orderNo={order.orderNo} payment={payment} />
    </ExpandableCard>
  )
}

function EsimOrderDetails({ orderNo, payment }: { orderNo: string; payment?: AdminBillingLineItem }) {
  const { data: d, isLoading, isError } = useVVEsimDetail(orderNo)
  if (isLoading) return <div className="flex justify-center py-4"><Spinner size="sm" label="Loading eSIM…" /></div>
  if (isError || !d) return <p className="text-sm text-red-600">Could not load live eSIM details for this order.</p>

  const usedPct = d.dataUsagePercent ?? null
  return (
    <>
      <DetailGroup title="Package">
        <Field icon={MapPin} label="Coverage">{d.locationCode ?? d.packages?.[0]?.location}</Field>
        <Field icon={Wifi} label="Data">{formatBytes(d.totalVolume)}</Field>
        <Field icon={Clock} label="Validity">
          {d.totalDuration ? `${d.totalDuration} ${(d.durationUnit ?? 'day').toLowerCase()}${d.totalDuration === 1 ? '' : 's'}` : null}
        </Field>
        <Field icon={Hash} label="Quantity">{d.quantity}</Field>
      </DetailGroup>

      {usedPct !== null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Data used {formatBytes(d.dataUsage)}</span>
            <span>{d.remainingVolumeGB != null ? `${d.remainingVolumeGB.toFixed(2)} GB left` : `${usedPct}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, usedPct))}%` }}
            />
          </div>
        </div>
      )}

      <DetailGroup title="eSIM">
        <Field icon={Smartphone} label="ICCID"><span className="font-mono text-xs">{d.iccid}</span></Field>
        <Field label="eSIM status">{d.esimStatus}</Field>
        <Field label="SM-DP+ status">{d.smdpStatus}</Field>
        <Field icon={CalendarDays} label="Activated">{d.activatedAt ? formatDateTime(d.activatedAt) : null}</Field>
        <Field icon={CalendarDays} label="Expires">{d.profileExpiresAt ? formatDateTime(d.profileExpiresAt) : null}</Field>
      </DetailGroup>

      <DetailGroup title="Payment">
        <Field icon={Receipt} label="Paid">{formatMoney(d.sellingPriceUsd ?? 0, d.currency)}</Field>
        <Field label="Method">{paymentMethodLabel(d.paymentMethod)}</Field>
        <Field label="Invoice">{d.invoiceNo ?? payment?.invoiceNo}</Field>
        {payment?.promoCode && (
          <Field label="Promo">
            {payment.promoCode}
            {payment.promoDiscountCents ? ` (−${formatCentsIn(payment.promoDiscountCents, payment.currency)})` : ''}
          </Field>
        )}
        <Field icon={CalendarDays} label="Ordered">{formatDateTime(d.createdAt)}</Field>
      </DetailGroup>
    </>
  )
}

// ── Lounge / Dining / Fast Track / Fitness ──────────────────────────

function loungeIcon(v: LoungeVisit): { icon: ElementType; tint: string } {
  switch (v.resourceType) {
    case 'DINING': return { icon: UtensilsCrossed, tint: 'bg-orange-50 text-orange-600' }
    case 'FAST_TRACK': return { icon: Zap, tint: 'bg-sky-50 text-sky-600' }
    case 'FITNESS': return { icon: Dumbbell, tint: 'bg-emerald-50 text-emerald-600' }
    default: return isWalkIn(v) ? { icon: Ticket, tint: 'bg-violet-50 text-violet-600' } : { icon: Armchair, tint: 'bg-indigo-50 text-indigo-600' }
  }
}

export function LoungeVisitCard({ v }: { v: LoungeVisit }) {
  const { icon, tint } = loungeIcon(v)
  const epass = v.walkinPass?.ePassId ?? v.epassCode
  const pay = v.paymentStatus
  const phone = v.contactPhone ? `${v.contactCallingCode ? `+${v.contactCallingCode.replace(/^\+/, '')} ` : ''}${v.contactPhone}` : null
  return (
    <ExpandableCard
      icon={icon}
      tint={tint}
      title={v.loungeName ?? 'Unknown venue'}
      status={<Badge variant={visitStatusVariant(v)}>{visitStatusLabel(v)}</Badge>}
      subtitle={
        <span className="flex flex-wrap gap-x-3">
          <span>{serviceLabel(v)}{v.airportCode ? ` · ${v.airportCode}` : ''}</span>
          <span>
            {formatVisitDate(v.visitDate)}
            {isWalkIn(v) ? ' · walk-in' : v.visitTime ? ` · ${v.visitTime}` : ''}
          </span>
          <span>{partyLabel(v)}</span>
        </span>
      }
      amount={formatCentsIn(v.totalCost, v.currency)}
      amountSub={pay ? pay.status : 'No card charge'}
      fullViewHref={`/dashboard/veloxverse/lounge-bookings/${v.id}`}
    >
      <DetailGroup title="Visit">
        <Field icon={MapPin} label="Venue">{v.loungeName}{v.airportCode ? ` (${v.airportCode})` : ''}</Field>
        <Field icon={CalendarDays} label="Date & time">
          {formatVisitDate(v.visitDate)}
          {v.visitTime ? ` · ${v.visitTime} local` : ''}
          {v.timeZone ? <span className="block text-xs text-gray-500">{v.timeZone}</span> : null}
        </Field>
        <Field icon={Plane} label="Flight">{v.flightNumber}</Field>
        <Field icon={Users} label="Party">{partyLabel(v)}</Field>
        <Field label="Booking type">{serviceLabel(v)}</Field>
        <Field icon={CalendarDays} label="Booked">{formatDateTime(v.createdAt)}</Field>
      </DetailGroup>

      <DetailGroup title="Lead traveller">
        <Field icon={User} label="Name">{v.contactName}</Field>
        <Field icon={Mail} label="Email">{v.contactEmail}</Field>
        <Field icon={Phone} label="Phone">{phone}</Field>
      </DetailGroup>

      <DetailGroup title="Pass & references">
        <Field icon={Hash} label="Order no."><span className="font-mono text-xs">{v.orderId ?? v.id}</span></Field>
        <Field icon={QrCode} label="ePass">{epass ? <span className="font-mono text-xs">{epass}</span> : null}</Field>
        <Field label="DragonPass order">
          {v.dragonpassOrderIds?.length ? <span className="font-mono text-xs">{v.dragonpassOrderIds.join(', ')}</span> : null}
        </Field>
        {v.walkinPass?.validUntil && <Field icon={Clock} label="Pass valid until">{formatDateTime(v.walkinPass.validUntil)}</Field>}
      </DetailGroup>

      <DetailGroup title="Payment & cancellation">
        <Field icon={Receipt} label="Total">{formatCentsIn(v.totalCost, v.currency)}</Field>
        <Field label="Payment">
          {pay ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant={paymentStatusVariant(pay.status)}>{pay.status}</Badge>
              {formatCentsIn(pay.amountCents, pay.currency)} charged
            </span>
          ) : 'No card charge (credit or VeloxClub)'}
        </Field>
        <Field icon={ShieldCheck} label="Refundable">
          {v.isRefundable === undefined ? null : v.isRefundable ? 'Yes' : 'No'}
          {v.cancellationHoursBefore ? <span className="block text-xs text-gray-500">Cancel up to {v.cancellationHoursBefore}h before</span> : null}
        </Field>
      </DetailGroup>
      {v.cancellationPolicy && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{v.cancellationPolicy}</p>
      )}
    </ExpandableCard>
  )
}

/** Fallback when the lounge visits endpoint can't be reached — the billing ledger still knows
 * what was paid for, just not the per-visit details. */
export function LoungePaymentCard({ li }: { li: AdminBillingLineItem }) {
  return (
    <ExpandableCard
      icon={Armchair}
      tint="bg-indigo-50 text-indigo-600"
      title={li.description}
      status={<Badge variant={statusBadgeVariant(li.status)}>{li.status}</Badge>}
      subtitle={formatDateTime(li.date)}
      amount={li.clubRedeemed ? 'VeloxClub' : formatMoney(li.amountUsd, li.currency)}
    >
      <PaymentFields li={li} />
    </ExpandableCard>
  )
}

// ── Pick & Drop (VeloxAssist transfers) ─────────────────────────────

export function TransferCard({ t }: { t: AdminTransferBooking }) {
  const travellers = t.adults + t.children + t.infants
  const vehicle = [t.vehicleMake, t.vehicleModel].filter(Boolean).join(' ') || t.vehicleSegment
  return (
    <ExpandableCard
      icon={Car}
      tint="bg-amber-50 text-amber-600"
      title={
        <>
          {t.pickupName || 'Pickup'} <span className="text-gray-400">→</span> {t.dropoffName || 'Drop-off'}
        </>
      }
      status={<Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>}
      subtitle={
        <span className="flex flex-wrap gap-x-3">
          <span className="font-mono">{t.orderNo}</span>
          {t.flightArrival && <span>{formatDateTime(t.flightArrival)}</span>}
          <span>{travellers} traveller{travellers === 1 ? '' : 's'}</span>
          {t.flightNumber && <span>✈ {t.flightNumber}</span>}
        </span>
      }
      amount={formatMoney((t.salePriceCents ?? 0) / 100, t.currency)}
      amountSub={t.paymentStatus ?? undefined}
      fullViewHref="/dashboard/veloxverse/transfers"
      fullViewLabel="Open Pick & Drop bookings"
    >
      <DetailGroup title="Journey">
        <Field icon={MapPin} label={`Pickup${t.pickupType ? ` (${t.pickupType.toLowerCase()})` : ''}`}>{t.pickupName}</Field>
        <Field icon={MapPin} label={`Drop-off${t.dropoffType ? ` (${t.dropoffType.toLowerCase()})` : ''}`}>{t.dropoffName}</Field>
        <Field icon={Clock} label="Pickup / arrival time">{t.flightArrival ? formatDateTime(t.flightArrival) : null}</Field>
        <Field icon={Plane} label="Flight">{t.flightNumber}</Field>
        <Field icon={Route} label="Distance">{t.distanceKm != null ? `${t.distanceKm} km` : null}</Field>
      </DetailGroup>

      <DetailGroup title="Passengers & luggage">
        <Field icon={Users} label="Passengers">
          {t.adults} adult{t.adults === 1 ? '' : 's'}
          {t.children ? `, ${t.children} child${t.children === 1 ? '' : 'ren'}` : ''}
          {t.infants ? `, ${t.infants} infant${t.infants === 1 ? '' : 's'}` : ''}
        </Field>
        <Field icon={Luggage} label="Suitcases">{t.suitcases}</Field>
        <Field icon={Briefcase} label="Small bags">{t.smallBags}</Field>
      </DetailGroup>

      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
        {t.vehicleImage ? (
          <img src={t.vehicleImage} alt={vehicle ?? 'Vehicle'} className="h-12 w-16 shrink-0 rounded-md bg-white object-contain" loading="lazy" />
        ) : (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-white"><Car className="h-5 w-5 text-gray-300" /></div>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Field label="Vehicle">
            {vehicle}
            {t.maxPassengers ? <span className="block text-xs text-gray-500">Up to {t.maxPassengers} passengers</span> : null}
          </Field>
          <Field label="Driver">
            {t.driverName}
            {t.driverPhone && <span className="block text-xs text-gray-500">{t.driverPhone}</span>}
          </Field>
          <Field label="Plate">{t.driverVehiclePlate}</Field>
        </div>
      </div>

      <DetailGroup title="Payment & references">
        <Field icon={Receipt} label="Charged">{formatMoney((t.salePriceCents ?? 0) / 100, t.currency)}</Field>
        <Field label="Method">{paymentMethodLabel(t.paymentMethod) ?? 'No card charge (credit or VeloxClub)'}</Field>
        <Field label="Payment status">{t.paymentStatus}</Field>
        <Field icon={Hash} label="Reservation no.">{t.reservationNo ? <span className="font-mono text-xs">{t.reservationNo}</span> : null}</Field>
        <Field icon={CalendarDays} label="Booked">{formatDateTime(t.createdAt)}</Field>
      </DetailGroup>
      {t.cancellationReason && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Cancelled: {t.cancellationReason}</p>
      )}
    </ExpandableCard>
  )
}

// ── VeloxClub ──────────────────────────────────────────────────────

export function ClubMembershipCard({ m }: { m: ClubMembershipDetail }) {
  return (
    <ExpandableCard
      icon={Crown}
      tint="bg-amber-50 text-amber-600"
      title={`${m.tier} membership`}
      status={<Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>}
      subtitle={`Cycle ${formatDate(m.billingCycleStart)} – ${formatDate(m.billingCycleEnd)} · ${m.usage.length} benefit${m.usage.length === 1 ? '' : 's'} used`}
      amount={formatCentsIn(m.purchasePriceCents, m.currency)}
      amountSub={m.autoRenew ? 'Auto-renews' : 'No auto-renew'}
    >
      <DetailGroup title="Membership">
        <Field icon={CalendarDays} label="Purchased">{formatDate(m.purchasedAt)}</Field>
        <Field label="Invoice">{m.invoiceNumber}</Field>
        <Field label="Renewal">{m.autoRenew ? 'Auto-renews' : 'Does not auto-renew'}</Field>
      </DetailGroup>
      <section>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Benefit usage this cycle</h4>
        {m.usage.length === 0 ? (
          <p className="text-sm text-gray-500">No benefits used yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {m.usage.map((u, i) => (
              <li key={i} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 ring-1 ring-amber-200">
                {u.benefitKey.replace(/_/g, ' ')} · {formatDateTime(u.consumedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ExpandableCard>
  )
}

// ── Payments ledger ─────────────────────────────────────────────────

function PaymentFields({ li }: { li: AdminBillingLineItem }) {
  return (
    <DetailGroup title="Payment">
      <Field icon={Hash} label="Order no."><span className="font-mono text-xs">{li.orderNo}</span></Field>
      <Field label="Invoice">{li.invoiceNo}</Field>
      <Field label="Service">{li.service}</Field>
      <Field label="Method">{paymentMethodLabel(li.paymentMethod)}</Field>
      <Field label="Status">{li.status}</Field>
      <Field icon={CalendarDays} label="Date">{formatDateTime(li.date)}</Field>
      {li.promoCode && (
        <Field label="Promo code">
          {li.promoCode}
          {li.promoDiscountCents ? ` (−${formatCentsIn(li.promoDiscountCents, li.currency)})` : ''}
        </Field>
      )}
      {li.clubRedeemed && (
        <Field icon={Crown} label="VeloxClub">
          Redeemed{li.clubDiscountCents ? ` (${formatCentsIn(li.clubDiscountCents, li.currency)} covered)` : ''}
        </Field>
      )}
    </DetailGroup>
  )
}

export function PaymentRow({ li }: { li: AdminBillingLineItem }) {
  const isCredit = li.direction === 'credit'
  return (
    <ExpandableCard
      icon={Receipt}
      tint={isCredit ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}
      title={li.description}
      status={<span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{li.service}</span>}
      subtitle={<span>{formatDateTime(li.date)} · <span className="font-mono">{li.orderNo}</span></span>}
      amount={
        li.clubRedeemed && li.amountUsd === 0 ? (
          <span className="text-emerald-600">VeloxClub</span>
        ) : (
          <span className={isCredit ? 'text-red-600' : undefined}>
            {isCredit ? '−' : ''}
            {formatMoney(li.amountUsd, li.currency)}
          </span>
        )
      }
      amountSub={li.status}
    >
      <PaymentFields li={li} />
    </ExpandableCard>
  )
}

// ── Support & forms ────────────────────────────────────────────────

export function SupportTicketCard({ t }: { t: VVSupportTicket }) {
  const last = t.messages?.[t.messages.length - 1]
  return (
    <ExpandableCard
      icon={LifeBuoy}
      tint="bg-rose-50 text-rose-600"
      title={t.subject}
      status={<Badge variant={statusBadgeVariant(t.status)}>{t.status.replace(/_/g, ' ')}</Badge>}
      subtitle={`${t.caseId} · ${t.category} · ${t.priority} priority · updated ${formatDateTime(t.updatedAt)}`}
      fullViewHref={`/dashboard/veloxverse/support/${t.id}`}
      fullViewLabel="Open ticket"
    >
      <DetailGroup title="Ticket">
        <Field icon={CalendarDays} label="Opened">{formatDateTime(t.createdAt)}</Field>
        <Field label="Messages">{t.messages?.length ?? 0}</Field>
      </DetailGroup>
      {last && (
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">
            Latest from {last.senderRole === 'ADMIN' ? 'support' : 'customer'}
          </p>
          <p className="line-clamp-4 whitespace-pre-line text-sm text-gray-700">{last.message}</p>
        </div>
      )}
    </ExpandableCard>
  )
}

export function FormLeadCard({ lead }: { lead: Lead }) {
  return (
    <ExpandableCard
      icon={FileText}
      tint="bg-teal-50 text-teal-600"
      title={lead.form_name ?? 'Form request'}
      status={<Badge variant={statusBadgeVariant(lead.status)}>{lead.status}</Badge>}
      subtitle={`Submitted ${formatDateTime(lead.created_at)}`}
    >
      <LeadSubmission lead={lead} />
    </ExpandableCard>
  )
}

function LeadSubmission({ lead }: { lead: Lead }) {
  // Form definition is fetched only for its field labels — without it the answers would be
  // keyed by raw field ids.
  const { data: form, isLoading } = useForm(lead.form_id)
  if (isLoading) return <div className="flex justify-center py-4"><Spinner size="sm" /></div>
  return (
    <SubmissionDataView
      data={lead.submission_data ?? {}}
      formJson={form?.form_json}
      fileUrl={(fieldId) => formApi.leadFileUrl(lead.id, fieldId)}
    />
  )
}
