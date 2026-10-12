import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Car,
  DollarSign,
  BadgeCheck,
  XCircle,
  Eye,
  MapPin,
  User,
  Phone,
  Users,
  Plane,
  Luggage,
  Ban,
  Clock,
  HandHelping,
  CreditCard,
  Mail,
  Copy,
  Navigation,
  AlertTriangle,
  Link2,
} from 'lucide-react'
import { History as HistoryIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVTransferBookings,
  useVVTransferCancelReasons,
  useVVCancelTransfer,
  useVVLinkTransferReservation,
} from '../hooks/useVVTransfers'
import { apiErrorMessage, formatDateTime, ownCardCharge, statusBadgeVariant, TRANSFER_UNCONFIRMED_NOTICE } from '../utils'
import { useCardChargeByOrderNo } from '../hooks/useVVAnalytics'
import { CARD_CHARGE_TOOLTIP, cardChargeLabel, formatMoney } from '@/lib/utils'
import DualAmount from '@/components/ui/DualAmount'
import type { AdminTransferBooking, TransferBookingStatus } from '../types'
import MeetGreetSection from '../components/MeetGreetSection'
import RefundOutcomeNotice from '../components/RefundOutcomeNotice'
import { describeRefundOutcome, type RefundOutcome } from '../refundOutcome'
import { BookingAuditTrail } from '../components/audit/BookingAuditTrail'
import { EventDrawer } from '../components/audit/EventDrawer'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE: 'Card (Stripe)',
  MINT: 'Mint',
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Wallet / credit (no direct charge on file)'
  return PAYMENT_METHOD_LABELS[method] ?? method
}

const STATUS_OPTIONS: ('' | TransferBookingStatus)[] = [
  '',
  'PENDING',
  'CONFIRMED',
  'APPROVED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]

// Statuses where the booking is already closed out — no further action (cancel) makes sense.
const TERMINAL_STATUSES: TransferBookingStatus[] = ['CANCELLED', 'COMPLETED', 'FAILED']

const selectClass =
  'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string
  value: string | number
  icon: ReactNode
  tint: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function DriverBadge({ booking }: { booking: AdminTransferBooking }) {
  if (!booking.driverName) {
    return <span className="text-xs text-gray-400">Driver not yet assigned</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
      <span className="inline-flex items-center gap-1 font-medium text-gray-900">
        <User className="h-3.5 w-3.5 text-gray-400" />
        {booking.driverName}
      </span>
      {booking.driverPhone && (
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          {booking.driverPhone}
        </span>
      )}
      {booking.driverVehiclePlate && (
        <span className="inline-flex items-center gap-1 font-mono">
          <Car className="h-3.5 w-3.5 text-gray-400" />
          {booking.driverVehiclePlate}
        </span>
      )}
    </div>
  )
}

// A single booking rendered as a self-contained responsive card. Used for every screen size (1
// column on mobile, up to 3 on wide screens via the parent grid) instead of a horizontally
// scrolling table, so there's no separate table/card breakpoint to keep in sync.
function BookingCard({
  booking,
  onViewMore,
  onCancel,
}: {
  booking: AdminTransferBooking
  onViewMore: (b: AdminTransferBooking) => void
  onCancel: (b: AdminTransferBooking) => void
}) {
  const travelers = booking.adults + booking.children + booking.infants
  // Paid but never confirmed by ViaTovia: the plain Cancel is refused for these (it would refund
  // without cancelling a ride that may exist) — they are resolved from the detail view instead.
  const unconfirmed = booking.confirmationUnknown === true && !TERMINAL_STATUSES.includes(booking.status)
  const canCancel = !TERMINAL_STATUSES.includes(booking.status) && !unconfirmed
  const cardCharge = useCardChargeByOrderNo()(booking.orderNo, ownCardCharge(booking))

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-gray-500">{booking.orderNo}</p>
          {booking.customer ? (
            <p className="truncate text-sm font-semibold text-gray-900">{booking.customer.name}</p>
          ) : (
            <p className="text-sm text-gray-400">Unknown customer</p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(booking.status)}>{booking.status}</Badge>
      </div>

      {unconfirmed && (
        <button
          type="button"
          onClick={() => onViewMore(booking)}
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs font-medium text-amber-900 transition hover:bg-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            {TRANSFER_UNCONFIRMED_NOTICE} <span className="underline">Resolve</span>
          </span>
        </button>
      )}

      <div className="flex items-start gap-2 text-sm text-gray-700">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <span className="min-w-0 break-words">
          {booking.pickupName || '—'} <span className="text-gray-400">→</span> {booking.dropoffName || '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {booking.flightArrival ? formatDateTime(booking.flightArrival) : '—'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {travelers} traveler{travelers === 1 ? '' : 's'}
        </span>
        {booking.flightNumber && (
          <span className="inline-flex items-center gap-1">
            <Plane className="h-3.5 w-3.5" />
            {booking.flightNumber}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {booking.vehicleImage ? (
          <img
            src={booking.vehicleImage}
            alt={booking.vehicleSegment ?? 'Vehicle'}
            className="h-10 w-14 shrink-0 rounded-md border border-gray-100 bg-gray-50 object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        ) : (
          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50">
            <Car className="h-4 w-4 text-gray-300" />
          </div>
        )}
        <span className="text-sm text-gray-700">
          {[booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ') || booking.vehicleSegment || 'Vehicle TBD'}
        </span>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <DriverBadge booking={booking} />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <DualAmount
          align="left"
          className="text-base font-semibold text-gray-900"
          amount={(booking.salePriceCents ?? 0) / 100}
          currency={booking.currency}
          cardChargeAmount={cardCharge?.amount}
          cardChargeCurrency={cardCharge?.currency}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewMore(booking)}>
            <Eye className="h-3.5 w-3.5" />
            View more
          </Button>
          {canCancel && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(booking)} aria-label="Cancel booking">
              <Ban className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// Stacks label above value on narrow phone widths (where a long value squeezed into a half
// grid column reads as clutter) and sits inline label/value on wider screens.
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 sm:text-right">{value}</span>
    </div>
  )
}

// A titled, bordered block used to group related fields in the booking detail popup — gives
// the modal clear visual sections (Customer / Route / Trip / Vehicle / Payment / Driver)
// instead of one long dense list, and keeps every section's content full-width on mobile.
function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {icon}
        {title}
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">{children}</div>
    </div>
  )
}

export default function VVTransfersPage() {
  const [activeTab, setActiveTab] = useState<'pickdrop' | 'meetgreet'>('pickdrop')
  const [status, setStatus] = useState<'' | TransferBookingStatus>('')
  const { data: bookings, isLoading, isError, refetch } = useVVTransferBookings(status || undefined)

  const [detailBooking, setDetailBooking] = useState<AdminTransferBooking | null>(null)
  // How the last admin cancel's refund really ended — kept on the page until dismissed.
  const [refundOutcome, setRefundOutcome] = useState<{ outcome: RefundOutcome; subject: string } | null>(null)
  const cardChargeByOrderNo = useCardChargeByOrderNo()
  const detailCardCharge = detailBooking ? cardChargeByOrderNo(detailBooking.orderNo, ownCardCharge(detailBooking)) : undefined
  const detailChargeLabel = cardChargeLabel(detailBooking?.currency, detailCardCharge?.amount, detailCardCharge?.currency)
  const [cancelBooking, setCancelBooking] = useState<AdminTransferBooking | null>(null)
  const [cancelReasonId, setCancelReasonId] = useState<number | ''>('')
  const [cancelMode, setCancelMode] = useState<'normal' | 'noRide'>('normal')
  const [noRideChecked, setNoRideChecked] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelRefused, setCancelRefused] = useState(false)
  // "Link reservation" — for a ride that was paid but never confirmed by ViaTovia.
  const [linkBooking, setLinkBooking] = useState<AdminTransferBooking | null>(null)
  const [linkReservationNo, setLinkReservationNo] = useState('')
  const [linkError, setLinkError] = useState('')
  const linkMutation = useVVLinkTransferReservation()

  const { showToast } = useToast()
  const { data: cancelReasons, isLoading: reasonsLoading } = useVVTransferCancelReasons({
    enabled: !!cancelBooking,
  })
  const cancelMutation = useVVCancelTransfer()

  const stats = useMemo(() => {
    const all = bookings ?? []
    const charged = all.filter((b) => b.status !== 'CANCELLED' && b.status !== 'FAILED')
    // Bookings can be charged in different currencies (INR, AUD, USD…) per customer's preferred
    // currency — summing raw cents across them would silently mix units, so revenue is kept as
    // one subtotal per currency rather than a single (wrong) number.
    const revenueByCurrency = new Map<string, number>()
    for (const b of charged) {
      const cur = b.currency || 'USD'
      revenueByCurrency.set(cur, (revenueByCurrency.get(cur) ?? 0) + (b.salePriceCents ?? 0))
    }
    const cancelled = all.filter((b) => b.status === 'CANCELLED').length
    return { total: all.length, revenueByCurrency, cancelled }
  }, [bookings])

  const handleCopyReservation = (reservationNo: string) => {
    navigator.clipboard
      .writeText(reservationNo)
      .then(() => showToast({ type: 'success', title: 'Copied', message: 'Reservation number copied to clipboard.' }))
      .catch(() => showToast({ type: 'error', title: 'Error', message: 'Could not copy to clipboard.' }))
  }

  // `noRide` = the "No ride at ViaTovia — cancel & refund" action: staff state that they checked
  // the ViaTovia panel. Only that path sends confirmNoRideAtSupplier; the plain Cancel never does.
  const openCancelModal = (b: AdminTransferBooking, mode: 'normal' | 'noRide' = 'normal') => {
    setCancelBooking(b)
    setCancelMode(mode)
    setCancelReasonId('')
    setNoRideChecked(false)
    setCancelError('')
    setCancelRefused(false)
  }

  const closeCancelModal = () => {
    setCancelBooking(null)
    setCancelReasonId('')
    setNoRideChecked(false)
    setCancelError('')
    setCancelRefused(false)
  }

  const openLinkModal = (b: AdminTransferBooking) => {
    setLinkBooking(b)
    setLinkReservationNo('')
    setLinkError('')
  }

  const closeLinkModal = () => {
    setLinkBooking(null)
    setLinkReservationNo('')
    setLinkError('')
  }

  const handleConfirmLink = async () => {
    const reservationNo = linkReservationNo.trim()
    if (!linkBooking || !reservationNo) return
    const who = linkBooking.customer?.name || linkBooking.orderNo
    setLinkError('')
    try {
      const result = await linkMutation.mutateAsync({ orderNo: linkBooking.orderNo, reservationNo })
      // Linking runs a status sync: if ViaTovia had already declined the ride it is cancelled
      // and refunded right away, and the response says how that refund ended.
      const outcome = describeRefundOutcome({
        refundState: result.refundState,
        amount: (result.refundedCents ?? 0) / 100,
        currency: result.currency ?? linkBooking.currency,
      })
      if (outcome && TERMINAL_STATUSES.includes(result.status)) {
        setRefundOutcome({ outcome, subject: `${who} · ${linkBooking.orderNo}` })
      } else {
        showToast({
          type: 'success',
          title: 'Reservation linked',
          message: `${who}'s ride is now confirmed with reservation ${reservationNo}. The customer has been notified.`,
        })
      }
      setDetailBooking(null)
      closeLinkModal()
    } catch (err) {
      // VeloxVerse's own wording, as-is ("The transport provider has no booking with that
      // reservation number.", "That reservation belongs to a different passenger…").
      setLinkError(apiErrorMessage(err, 'Could not link the reservation. Please try again.'))
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelBooking || cancelReasonId === '') return
    if (cancelMode === 'noRide' && !noRideChecked) return
    const who = cancelBooking.customer?.name || cancelBooking.orderNo
    setCancelError('')
    try {
      const result = await cancelMutation.mutateAsync({
        orderNo: cancelBooking.orderNo,
        cancellationId: Number(cancelReasonId),
        confirmNoRideAtSupplier: cancelMode === 'noRide' ? true : undefined,
      })
      // The refund result comes from `refundState` — never from the 200 or the amount alone.
      const outcome = describeRefundOutcome({
        refundState: result.refundState,
        amount: (result.refundedCents ?? 0) / 100,
        currency: result.currency ?? cancelBooking.currency,
      })
      if (outcome) setRefundOutcome({ outcome, subject: `${who} · ${cancelBooking.orderNo}` })
      // Older VeloxVerse (no refundState): previous wording.
      else showToast({
        type: 'success',
        title: 'Booking cancelled',
        message:
          result.refundedCents > 0
            ? `${who}'s Pick & Drop booking was cancelled and ${formatMoney(result.refundedCents / 100, result.currency)} refunded.`
            : `${who}'s Pick & Drop booking was cancelled. No refund was issued (non-refundable).`,
      })
      setDetailBooking(null)
      closeCancelModal()
    } catch (err) {
      // Kept in the dialog (not a 4-second toast): a refusal for a never-confirmed ride explains
      // what to check, and staff need to read it.
      setCancelError(apiErrorMessage(err, 'Failed to cancel booking'))
      setCancelRefused((err as { response?: { status?: number } })?.response?.status === 409)
    }
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="space-y-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">VeloxAssist</h1>
            <p className="text-sm text-gray-500">
              {activeTab === 'pickdrop'
                ? 'Pick & Drop bookings (ViaTovia).'
                : 'Meet & Greet airport greeter requests.'}
            </p>
          </div>
        </div>
      </div>

      {refundOutcome && (
        <RefundOutcomeNotice
          outcome={refundOutcome.outcome}
          subject={refundOutcome.subject}
          onDismiss={() => setRefundOutcome(null)}
        />
      )}

      {/* ── Service filter: Pick & Drop vs Meet & Greet ── */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('pickdrop')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'pickdrop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Car className="h-4 w-4" />
          Pick &amp; Drop
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('meetgreet')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'meetgreet' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HandHelping className="h-4 w-4" />
          Meet &amp; Greet
        </button>
      </div>

      {activeTab === 'meetgreet' ? (
        <MeetGreetSection />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total bookings"
              value={stats.total}
              icon={<BadgeCheck className="h-5 w-5 text-indigo-500" />}
              tint="bg-indigo-50"
            />
            <StatCard
              label="Revenue (charged)"
              value={
                stats.revenueByCurrency.size === 0
                  ? formatMoney(0, 'USD')
                  : [...stats.revenueByCurrency.entries()]
                      .map(([currency, cents]) => formatMoney(cents / 100, currency))
                      .join(' + ')
              }
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              tint="bg-emerald-50"
            />
            <StatCard
              label="Cancelled"
              value={stats.cancelled}
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              tint="bg-red-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | TransferBookingStatus)}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s || 'ALL'} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </div>

          {isError ? (
            <Card className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-500">Could not load Pick & Drop bookings.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : !bookings || bookings.length === 0 ? (
            <Card className="py-10 text-center text-sm text-gray-500">
              {status ? 'No Pick & Drop bookings match this status.' : 'No Pick & Drop bookings yet.'}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bookings.map((b) => (
                <BookingCard key={b.orderNo} booking={b} onViewMore={setDetailBooking} onCancel={openCancelModal} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Detail modal ── */}
      <Modal
        open={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        title="Booking details"
        description={detailBooking?.orderNo}
        size="xl"
        footer={
          detailBooking && !TERMINAL_STATUSES.includes(detailBooking.status) ? (
            <>
              <Button variant="secondary" onClick={() => setDetailBooking(null)}>
                Close
              </Button>
              {detailBooking.confirmationUnknown ? (
                <>
                  <Button variant="danger" onClick={() => openCancelModal(detailBooking, 'noRide')}>
                    <Ban className="h-4 w-4" />
                    No ride at ViaTovia — cancel &amp; refund
                  </Button>
                  <Button onClick={() => openLinkModal(detailBooking)}>
                    <Link2 className="h-4 w-4" />
                    Link reservation
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => openCancelModal(detailBooking)}>
                  <Ban className="h-4 w-4" />
                  Cancel booking
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={() => setDetailBooking(null)}>
              Close
            </Button>
          )
        }
      >
        {detailBooking && (
          <div className="space-y-5">
            {detailBooking.confirmationUnknown && !TERMINAL_STATUSES.includes(detailBooking.status) && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-semibold">{TRANSFER_UNCONFIRMED_NOTICE}</p>
                  <p className="text-sm">
                    The customer has paid, but ViaTovia did not answer when the ride was booked, so there is no
                    reservation number and a ride may or may not exist. Look this booking up in the ViaTovia panel,
                    then either link the reservation you find or confirm there is none.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openLinkModal(detailBooking)}>
                      <Link2 className="h-3.5 w-3.5" />
                      Link reservation
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openCancelModal(detailBooking, 'noRide')}>
                      <Ban className="h-3.5 w-3.5 text-red-500" />
                      No ride at ViaTovia — cancel &amp; refund
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Status, price, and quick reference info up top */}
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-gray-50 p-4">
              <div className="space-y-1.5">
                <Badge variant={statusBadgeVariant(detailBooking.status)}>{detailBooking.status}</Badge>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  {detailBooking.reservationNo && (
                    <button
                      type="button"
                      onClick={() => handleCopyReservation(detailBooking.reservationNo!)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                      title="Copy reservation number"
                    >
                      <Copy className="h-3 w-3" />
                      Res. {detailBooking.reservationNo}
                    </button>
                  )}
                  <span>Created {formatDateTime(detailBooking.createdAt)}</span>
                </div>
              </div>
              <DualAmount
                className="text-xl font-bold text-gray-900"
                amount={(detailBooking.salePriceCents ?? 0) / 100}
                currency={detailBooking.currency}
                cardChargeAmount={detailCardCharge?.amount}
                cardChargeCurrency={detailCardCharge?.currency}
              />
            </div>

            {detailBooking.cancellationReason && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                <span className="font-medium">Cancellation reason:</span> {detailBooking.cancellationReason}
              </div>
            )}

            {/* Customer */}
            <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Customer">
              {detailBooking.customer ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{detailBooking.customer.name}</p>
                  {detailBooking.customer.email && (
                    <a
                      href={`mailto:${detailBooking.customer.email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {detailBooking.customer.email}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Unknown customer</p>
              )}
            </SectionCard>

            {/* Route — pickup and drop-off as two clearly separated stops, not one crowded line */}
            <SectionCard icon={<Navigation className="h-3.5 w-3.5" />} title="Route">
              <div className="space-y-0">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <div className="min-w-0 pb-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Pickup</p>
                    <p className="break-words text-sm font-medium text-gray-900">
                      {detailBooking.pickupName || '—'}
                    </p>
                  </div>
                </div>
                <div className="ml-[9px] h-3 w-px bg-gray-200" />
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <MapPin className="h-3 w-3 text-red-500" />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Drop-off</p>
                    <p className="break-words text-sm font-medium text-gray-900">
                      {detailBooking.dropoffName || '—'}
                    </p>
                  </div>
                </div>
              </div>
              {detailBooking.distanceKm != null && (
                <p className="mt-2 pl-8 text-xs text-gray-500">{detailBooking.distanceKm} km</p>
              )}
            </SectionCard>

            {/* Trip details */}
            <SectionCard icon={<Clock className="h-3.5 w-3.5" />} title="Trip details">
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <DetailRow
                  label="Flight arrival"
                  value={detailBooking.flightArrival ? formatDateTime(detailBooking.flightArrival) : null}
                />
                <DetailRow
                  label="Flight number"
                  value={
                    detailBooking.flightNumber ? (
                      <span className="inline-flex items-center gap-1">
                        <Plane className="h-3.5 w-3.5 text-gray-400" />
                        {detailBooking.flightNumber}
                      </span>
                    ) : null
                  }
                />
                <DetailRow
                  label="Travelers"
                  value={`${detailBooking.adults} adult${detailBooking.adults === 1 ? '' : 's'}${
                    detailBooking.children ? `, ${detailBooking.children} child${detailBooking.children === 1 ? '' : 'ren'}` : ''
                  }${detailBooking.infants ? `, ${detailBooking.infants} infant${detailBooking.infants === 1 ? '' : 's'}` : ''}`}
                />
                <DetailRow
                  label="Luggage"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Luggage className="h-3.5 w-3.5 text-gray-400" />
                      {detailBooking.suitcases} suitcase{detailBooking.suitcases === 1 ? '' : 's'}, {detailBooking.smallBags}{' '}
                      bag{detailBooking.smallBags === 1 ? '' : 's'}
                    </span>
                  }
                />
              </div>
            </SectionCard>

            {/* Vehicle */}
            <SectionCard icon={<Car className="h-3.5 w-3.5" />} title="Vehicle">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {detailBooking.vehicleImage ? (
                  <img
                    src={detailBooking.vehicleImage}
                    alt={detailBooking.vehicleSegment ?? 'Vehicle'}
                    className="h-20 w-32 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : (
                  <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
                    <Car className="h-6 w-6 text-gray-300" />
                  </div>
                )}
                <div className="w-full min-w-0">
                  <p className="text-center text-sm font-medium text-gray-900 sm:text-left">
                    {[detailBooking.vehicleMake, detailBooking.vehicleModel].filter(Boolean).join(' ') ||
                      detailBooking.vehicleSegment ||
                      'Vehicle TBD'}
                  </p>
                  <DetailRow label="Max passengers" value={detailBooking.maxPassengers} />
                </div>
              </div>
            </SectionCard>

            {/* Payment & pricing */}
            <SectionCard icon={<CreditCard className="h-3.5 w-3.5" />} title="Payment">
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <DetailRow label="Method" value={paymentMethodLabel(detailBooking.paymentMethod)} />
                <DetailRow
                  label="Base price"
                  value={
                    detailBooking.basePriceCents != null
                      ? formatMoney(detailBooking.basePriceCents / 100, detailBooking.nativeCurrency)
                      : null
                  }
                />
                <DetailRow
                  label="Sale price"
                  value={
                    detailBooking.salePriceCents != null
                      ? formatMoney(detailBooking.salePriceCents / 100, detailBooking.currency)
                      : null
                  }
                />
                <DetailRow
                  label={`Charged to card (${detailCardCharge?.currency ?? 'AUD'})`}
                  value={
                    detailChargeLabel ? <span title={CARD_CHARGE_TOOLTIP}>{detailChargeLabel}</span> : null
                  }
                />
              </div>
            </SectionCard>

            {/* Driver */}
            <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Driver">
              {detailBooking.driverName ? (
                <div className="space-y-1">
                  <DetailRow label="Name" value={detailBooking.driverName} />
                  <DetailRow
                    label="Phone"
                    value={
                      detailBooking.driverPhone ? (
                        <a
                          href={`tel:${detailBooking.driverPhone}`}
                          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {detailBooking.driverPhone}
                        </a>
                      ) : null
                    }
                  />
                  <DetailRow label="Vehicle plate" value={detailBooking.driverVehiclePlate} />
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Not yet assigned — ViaTovia typically assigns a driver once the booking is approved.
                </p>
              )}
            </SectionCard>

            <SectionCard icon={<HistoryIcon className="h-3.5 w-3.5" />} title="Audit trail">
              <BookingAuditTrail referenceType="transfer_booking" referenceId={detailBooking.orderNo} />
            </SectionCard>
          </div>
        )}
      </Modal>
      <EventDrawer />

      {/* ── Cancel modal ── */}
      <Modal
        open={!!cancelBooking}
        onClose={closeCancelModal}
        title={cancelMode === 'noRide' ? 'No ride at ViaTovia — cancel & refund' : 'Cancel booking'}
        description={cancelBooking?.orderNo}
        footer={
          <>
            <Button variant="secondary" onClick={closeCancelModal}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              loading={cancelMutation.isPending}
              disabled={cancelReasonId === '' || (cancelMode === 'noRide' && !noRideChecked)}
            >
              <Ban className="h-4 w-4" />
              {cancelMode === 'noRide' ? 'Cancel & refund' : 'Confirm cancellation'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cancelMode === 'noRide' ? (
            <>
              <p className="text-sm text-gray-600">
                This ride for{' '}
                <span className="font-medium text-gray-900">{cancelBooking?.customer?.name ?? 'this customer'}</span> was
                paid but never confirmed by ViaTovia. Cancelling here refunds the customer in full — it does{' '}
                <span className="font-semibold">not</span> cancel anything at ViaTovia. If a ride does exist there,
                use &ldquo;Link reservation&rdquo; instead. This can&apos;t be undone.
              </p>
              <label className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={noRideChecked}
                  onChange={(e) => setNoRideChecked(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-amber-600"
                />
                <span className="font-medium">I have checked the ViaTovia panel and there is no ride for this booking</span>
              </label>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              This cancels the Pick & Drop booking for{' '}
              <span className="font-medium text-gray-900">{cancelBooking?.customer?.name ?? 'this customer'}</span> with
              ViaTovia. Refundable bookings are refunded automatically (minus any refund-protection fee); non-refundable
              bookings are not refunded. This can&apos;t be undone.
            </p>
          )}
          {cancelError && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <p>{cancelError}</p>
              {cancelRefused && cancelMode === 'normal' && cancelBooking && (
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <span>Check the ViaTovia panel, then:</span>
                  <Button size="sm" onClick={() => { const b = cancelBooking; closeCancelModal(); openLinkModal(b) }}>
                    <Link2 className="h-3.5 w-3.5" />
                    Link reservation
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openCancelModal(cancelBooking, 'noRide')}>
                    No ride at ViaTovia — cancel &amp; refund
                  </Button>
                </p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Cancellation reason</label>
            <select
              value={cancelReasonId}
              onChange={(e) => setCancelReasonId(e.target.value ? Number(e.target.value) : '')}
              className={`${selectClass} w-full`}
              disabled={reasonsLoading}
            >
              <option value="">{reasonsLoading ? 'Loading reasons…' : 'Select a reason…'}</option>
              {cancelReasons?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Link reservation modal ── */}
      <Modal
        open={!!linkBooking}
        onClose={closeLinkModal}
        title="Link reservation"
        description={linkBooking?.orderNo}
        footer={
          <>
            <Button variant="secondary" onClick={closeLinkModal}>
              Close
            </Button>
            <Button onClick={handleConfirmLink} loading={linkMutation.isPending} disabled={linkReservationNo.trim().length < 3}>
              <Link2 className="h-4 w-4" />
              Link reservation
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleConfirmLink()
          }}
        >
          <p className="text-sm text-gray-600">
            Find the ride for{' '}
            <span className="font-medium text-gray-900">{linkBooking?.customer?.name ?? 'this customer'}</span> in the
            ViaTovia panel and enter its reservation number. The booking then becomes a normal confirmed ride and the
            customer gets the usual &ldquo;Ride booked&rdquo; notification and email.
          </p>
          <div>
            <label htmlFor="link-reservation-no" className="mb-1 block text-xs font-medium text-gray-500">
              ViaTovia reservation number
            </label>
            <input
              id="link-reservation-no"
              value={linkReservationNo}
              onChange={(e) => setLinkReservationNo(e.target.value)}
              placeholder="e.g. ViaToVia-2026-000999"
              maxLength={100}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {linkError && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              {linkError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
