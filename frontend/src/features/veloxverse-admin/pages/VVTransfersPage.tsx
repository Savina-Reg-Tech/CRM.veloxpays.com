import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Car, DollarSign, BadgeCheck, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { useVVTransferBookings } from '../hooks/useVVTransfers'
import { formatCents, formatDateTime, statusBadgeVariant } from '../utils'
import type { AdminTransferBooking, TransferBookingStatus } from '../types'

const STATUS_OPTIONS: ('' | TransferBookingStatus)[] = [
  '',
  'PENDING',
  'CONFIRMED',
  'APPROVED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]

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

export default function VVTransfersPage() {
  const [status, setStatus] = useState<'' | TransferBookingStatus>('')
  const { data: bookings, isLoading, isError, refetch } = useVVTransferBookings(status || undefined)

  const stats = useMemo(() => {
    const all = bookings ?? []
    const charged = all.filter((b) => b.status !== 'CANCELLED' && b.status !== 'FAILED')
    const revenueCents = charged.reduce((s, b) => s + (b.amountCents ?? 0), 0)
    const cancelled = all.filter((b) => b.status === 'CANCELLED').length
    return { total: all.length, revenue: revenueCents, cancelled }
  }, [bookings])

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (b: AdminTransferBooking) => (
        <div>
          <div className="font-medium text-gray-900">{b.orderNo}</div>
          {b.reservationNo && <div className="text-xs text-gray-500">{b.reservationNo}</div>}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (b: AdminTransferBooking) =>
        b.customerName ? (
          <div>
            <div className="text-gray-900">{b.customerName}</div>
            <div className="text-xs text-gray-500">{b.customerEmail}</div>
          </div>
        ) : (
          <span className="text-gray-500">—</span>
        ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (b: AdminTransferBooking) => (
        <span className="text-gray-900">
          {b.pickupLocation} → {b.dropoffLocation}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (b: AdminTransferBooking) => <span className="text-gray-500">{formatDateTime(b.flightArrival)}</span>,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (b: AdminTransferBooking) => (
        <span className="text-gray-900">
          {[b.vehicleMake, b.vehicleModel].filter(Boolean).join(' ') || b.vehicleSegment || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (b: AdminTransferBooking) => (
        <span className="font-semibold text-gray-900">{formatCents(b.amountCents)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b: AdminTransferBooking) => <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>,
    },
  ]

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
            <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
            <p className="text-sm text-gray-500">VeloxAssist Pick &amp; Drop bookings (ViaTovia).</p>
          </div>
        </div>
      </div>

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
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card padding="none">
          <Table
            columns={columns}
            data={bookings ?? []}
            keyField="orderNo"
            emptyMessage="No transfer bookings found."
          />
        </Card>
      )}
    </div>
  )
}
