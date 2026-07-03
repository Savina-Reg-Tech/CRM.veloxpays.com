import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  Sofa,
  DollarSign,
  BadgeCheck,
  CalendarClock,
  XCircle,
  X,
  Dumbbell,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  useVVLoungeVisits,
  useVVLoungeMemberships,
  useVVLoungeStats,
  useVVLoungeVisitDetail,
} from '../hooks/useVVLounge'
import { formatCents, formatDate, formatDateTime, statusBadgeVariant } from '../utils'
import type { LoungeVisit, LoungeVisitStatus, AdminLoungeMembership } from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: ('' | LoungeVisitStatus)[] = [
  '',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
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

function VisitDetailModal({ visitId, onClose }: { visitId: string; onClose: () => void }) {
  const { data: visit, isLoading } = useVVLoungeVisitDetail(visitId)

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!visit) return null

  const b = visit.breakdown
  const profitCents = b.marginCents + b.surgeCents

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{visit.loungeName ?? 'Unknown'}</h3>
            <p className="text-xs text-gray-500">{visit.orderId ?? visit.id} · {visit.airportCode}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Status + Customer */}
          <div className="flex items-center justify-between">
            <Badge variant={statusBadgeVariant(visit.status)}>{visit.status}</Badge>
            {visit.customer && (
              <div className="text-right text-sm">
                <p className="font-medium text-gray-900">{visit.customer.name}</p>
                <p className="text-xs text-gray-500">{visit.customer.email}</p>
              </div>
            )}
          </div>

          {/* Key info */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Visit date</p>
              <p className="font-medium text-gray-900">{formatDate(visit.visitDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Guests</p>
              <p className="font-medium text-gray-900">{visit.guestCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Booked</p>
              <p className="font-medium text-gray-900">{visit.bookedAt ? formatDateTime(visit.bookedAt) : formatDate(visit.createdAt)}</p>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Price breakdown</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base cost</span>
                <span className="text-gray-900">{formatCents(b.baseCents)}</span>
              </div>
              {profitCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Margin + surge</span>
                  <span className="text-emerald-600">+{formatCents(profitCents)}</span>
                </div>
              )}
              {b.promoDiscountCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Promo discount</span>
                  <span className="text-red-500">-{formatCents(b.promoDiscountCents)}</span>
                </div>
              )}
              {visit.isRefundable && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Refund protection fee</span>
                  <span className="text-gray-900">{formatCents(b.refundFeeCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-1.5">
                <span className="font-semibold text-gray-900">Total charged</span>
                <span className="font-bold text-gray-900">{formatCents(b.totalCents)}</span>
              </div>
            </div>
          </div>

          {/* Profit + Refund info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600">Profit (margin + surge)</p>
              <p className="text-lg font-bold text-emerald-700">{formatCents(profitCents)}</p>
            </div>
            <div className={`rounded-lg border p-3 ${visit.isRefundable ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-xs ${visit.isRefundable ? 'text-amber-600' : 'text-gray-500'}`}>
                {visit.isRefundable ? 'Refundable amount' : 'Non-refundable'}
              </p>
              <p className={`text-lg font-bold ${visit.isRefundable ? 'text-amber-700' : 'text-gray-400'}`}>
                {visit.isRefundable ? formatCents(visit.refundableCents) : '—'}
              </p>
            </div>
          </div>

          {/* Cancellation info */}
          {visit.cancelledAt && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-medium text-red-700">Cancelled</p>
              <p className="text-xs text-red-600">
                {formatDateTime(visit.cancelledAt)}
                {visit.isRefundable && ` · ${formatCents(visit.refundableCents)} refunded`}
              </p>
            </div>
          )}

          {visit.surgeApplied && (
            <p className="text-xs text-amber-600">Surge pricing was applied to this booking.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────── Visits table (shared between tabs) ─────────── */

function VisitsTable({ bookingType, resourceType }: { bookingType: 'lounge' | 'benefit' | 'all'; resourceType?: string }) {
  const [page, setPage] = useState(1)
  const [airport, setAirport] = useState('')
  const [status, setStatus] = useState<'' | LoungeVisitStatus>('')
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null)

  const { data, isLoading } = useVVLoungeVisits({
    page,
    limit: PAGE_SIZE,
    airport: airport || undefined,
    status: status || undefined,
    bookingType,
    resourceType,
  })

  const nameHeader = bookingType === 'lounge' ? 'Lounge' : 'Venue'

  const columns = [
    {
      key: 'lounge',
      header: nameHeader,
      render: (v: LoungeVisit) => <span className="font-medium text-gray-900">{v.loungeName}</span>,
    },
    { key: 'airport', header: 'Airport', render: (v: LoungeVisit) => v.airportCode },
    { key: 'date', header: 'Date', render: (v: LoungeVisit) => formatDate(v.visitDate) },
    { key: 'guests', header: 'Guests', render: (v: LoungeVisit) => v.guestCount },
    {
      key: 'status',
      header: 'Status',
      render: (v: LoungeVisit) => <Badge variant={statusBadgeVariant(v.status)}>{v.status}</Badge>,
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (v: LoungeVisit) => {
        const s = v.status?.toUpperCase()
        const color =
          s === 'CANCELLED' || s === 'NO_SHOW'
            ? 'text-red-500'
            : s === 'CONFIRMED'
            ? 'text-amber-600'
            : s === 'COMPLETED'
            ? 'text-emerald-600'
            : 'text-gray-700'
        return <span className={`font-medium ${color}`}>{formatCents(v.totalCost)}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      render: (v: LoungeVisit) => (
        <button
          onClick={() => setSelectedVisitId(v.id)}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-[220px]">
          <Input
            placeholder="Airport code (e.g. LHR)"
            value={airport}
            onChange={(e) => {
              setPage(1)
              setAirport(e.target.value.toUpperCase())
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value as '' | LoungeVisitStatus)
          }}
          className={selectClass}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? s : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyField="id"
          loading={isLoading}
          emptyMessage="No bookings found."
        />
      </Card>

      {selectedVisitId && (
        <VisitDetailModal visitId={selectedVisitId} onClose={() => setSelectedVisitId(null)} />
      )}

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function MembershipsTab() {
  const { data: memberships, isLoading } = useVVLoungeMemberships()

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (m: AdminLoungeMembership) => (
        <span className="font-medium text-gray-900">{m.user?.name ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (m: AdminLoungeMembership) => <span className="text-gray-500">{m.user?.email ?? '—'}</span>,
    },
    { key: 'tier', header: 'Tier', render: (m: AdminLoungeMembership) => m.tier },
    {
      key: 'visitsRemaining',
      header: 'Visits left',
      render: (m: AdminLoungeMembership) => (m.visitsRemaining === -1 ? '∞' : m.visitsRemaining),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m: AdminLoungeMembership) => <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>,
    },
    {
      key: 'validTo',
      header: 'Valid until',
      render: (m: AdminLoungeMembership) => formatDate(m.validTo),
    },
    {
      key: 'created',
      header: 'Created',
      render: (m: AdminLoungeMembership) => <span className="text-gray-500">{formatDate(m.createdAt)}</span>,
    },
  ]

  return (
    <Card padding="none">
      <Table
        columns={columns}
        data={memberships ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="No memberships yet."
      />
    </Card>
  )
}

export default function VVLoungePage() {
  const { data: stats, isLoading } = useVVLoungeStats()

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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <Sofa className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lounge & Benefits Management</h1>
            <p className="text-sm text-gray-500">Visits, memberships and revenue across VeloxLounge services.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Total revenue"
              value={formatCents(stats?.totalRevenueCents ?? 0)}
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              tint="bg-emerald-50"
            />
            <StatCard
              label="Active memberships"
              value={stats?.activeMemberships ?? 0}
              icon={<BadgeCheck className="h-5 w-5 text-indigo-500" />}
              tint="bg-indigo-50"
            />
            <StatCard
              label="Upcoming visits"
              value={stats?.upcomingVisits ?? 0}
              icon={<CalendarClock className="h-5 w-5 text-amber-500" />}
              tint="bg-amber-50"
            />
            <StatCard
              label="Cancelled visits"
              value={stats?.cancelledVisits ?? 0}
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              tint="bg-red-50"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="lounge">
        <TabsList>
          <TabsTrigger value="lounge" className="gap-1.5">
            <Sofa className="h-3.5 w-3.5" />
            Lounge
          </TabsTrigger>
          <TabsTrigger value="fitness" className="gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" />
            Fitness
          </TabsTrigger>
          <TabsTrigger value="dining" className="gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Dining
          </TabsTrigger>
          <TabsTrigger value="fasttrack" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Fast Track
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
        </TabsList>
        <TabsContent value="lounge">
          <VisitsTable bookingType="lounge" />
        </TabsContent>
        <TabsContent value="fitness">
          <VisitsTable bookingType="benefit" resourceType="FITNESS" />
        </TabsContent>
        <TabsContent value="dining">
          <VisitsTable bookingType="benefit" resourceType="DINING" />
        </TabsContent>
        <TabsContent value="fasttrack">
          <VisitsTable bookingType="benefit" resourceType="FAST_TRACK" />
        </TabsContent>
        <TabsContent value="all">
          <VisitsTable bookingType="all" />
        </TabsContent>
        <TabsContent value="memberships">
          <MembershipsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
