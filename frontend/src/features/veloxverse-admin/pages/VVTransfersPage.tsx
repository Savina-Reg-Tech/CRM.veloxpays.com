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
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVTransferBookings, useVVTransferCancelReasons, useVVCancelTransfer } from '../hooks/useVVTransfers'
import { formatCents, formatDateTime, statusBadgeVariant } from '../utils'
import type { AdminTransferBooking, TransferBookingStatus } from '../types'
import MeetGreetSection from '../components/MeetGreetSection'

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
  const canCancel = !TERMINAL_STATUSES.includes(booking.status)

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
        <span className="text-base font-semibold text-gray-900">{formatCents(booking.salePriceCents ?? 0)}</span>
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
  const [cancelBooking, setCancelBooking] = useState<AdminTransferBooking | null>(null)
  const [cancelReasonId, setCancelReasonId] = useState<number | ''>('')

  const { showToast } = useToast()
  const { data: cancelReasons, isLoading: reasonsLoading } = useVVTransferCancelReasons({
    enabled: !!cancelBooking,
  })
  const cancelMutation = useVVCancelTransfer()

  const stats = useMemo(() => {
    const all = bookings ?? []
    const charged = all.filter((b) => b.status !== 'CANCELLED' && b.status !== 'FAILED')
    const revenueCents = charged.reduce((s, b) => s + (b.salePriceCents ?? 0), 0)
    const cancelled = all.filter((b) => b.status === 'CANCELLED').length
    return { total: all.length, revenue: revenueCents, cancelled }
  }, [bookings])

  const handleCopyReservation = (reservationNo: string) => {
    navigator.clipboard
      .writeText(reservationNo)
      .then(() => showToast({ type: 'success', title: 'Copied', message: 'Reservation number copied to clipboard.' }))
      .catch(() => showToast({ type: 'error', title: 'Error', message: 'Could not copy to clipboard.' }))
  }

  const openCancelModal = (b: AdminTransferBooking) => {
    setCancelBooking(b)
    setCancelReasonId('')
  }

  const closeCancelModal = () => {
    setCancelBooking(null)
    setCancelReasonId('')
  }

  const handleConfirmCancel = async () => {
    if (!cancelBooking || cancelReasonId === '') return
    const who = cancelBooking.customer?.name || cancelBooking.orderNo
    try {
      const result = await cancelMutation.mutateAsync({
        orderNo: cancelBooking.orderNo,
        cancellationId: Number(cancelReasonId),
      })
      showToast({
        type: 'success',
        title: 'Booking cancelled',
        message:
          result.refundedCents > 0
            ? `${who}'s transfer was cancelled and ${formatCents(result.refundedCents)} refunded.`
            : `${who}'s transfer was cancelled. No refund was issued (non-refundable).`,
      })
      setDetailBooking(null)
      closeCancelModal()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to cancel booking',
      })
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
                ? 'Pick & Drop transfer bookings (ViaTovia).'
                : 'Meet & Greet airport greeter requests.'}
            </p>
          </div>
        </div>
      </div>

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
              value={formatCents(stats.revenue)}
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
              <p className="text-sm text-gray-500">Could not load transfer bookings.</p>
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
              {status ? 'No transfer bookings match this status.' : 'No transfer bookings yet.'}
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
              <Button variant="danger" onClick={() => openCancelModal(detailBooking)}>
                <Ban className="h-4 w-4" />
                Cancel booking
              </Button>
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
              <span className="text-xl font-bold text-gray-900">
                {formatCents(detailBooking.salePriceCents ?? 0)}
              </span>
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
                  value={detailBooking.basePriceCents != null ? formatCents(detailBooking.basePriceCents) : null}
                />
                <DetailRow
                  label="Sale price"
                  value={detailBooking.salePriceCents != null ? formatCents(detailBooking.salePriceCents) : null}
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
          </div>
        )}
      </Modal>

      {/* ── Cancel modal ── */}
      <Modal
        open={!!cancelBooking}
        onClose={closeCancelModal}
        title="Cancel booking"
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
              disabled={cancelReasonId === ''}
            >
              <Ban className="h-4 w-4" />
              Confirm cancellation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This cancels the transfer for{' '}
            <span className="font-medium text-gray-900">{cancelBooking?.customer?.name ?? 'this customer'}</span> with
            ViaTovia. Refundable bookings are refunded automatically (minus any refund-protection fee); non-refundable
            bookings are not refunded. This can&apos;t be undone.
          </p>
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
    </div>
  )
}
