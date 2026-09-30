import { useCallback, useEffect, useState, type ElementType, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sofa,
  BadgeCheck,
  CalendarClock,
  XCircle,
  Dumbbell,
  UtensilsCrossed,
  Zap,
  Search,
  Ticket,
  CalendarDays,
  Users,
  Hash,
  QrCode,
  ChevronRight,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useVVLoungeVisits,
  useVVLoungeMemberships,
  useVVLoungeStats,
} from '../hooks/useVVLounge'
import { formatDate, getInitials, statusBadgeVariant } from '../utils'
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
  LoungeVisit,
  LoungeVisitStatus,
  AdminLoungeMembership,
  LoungeBookingTypeFilter,
  LoungeResourceType,
} from '../types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: ('' | LoungeVisitStatus)[] = [
  '',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
  'pending_confirmation',
]

const STATUS_OPTION_LABEL: Record<LoungeVisitStatus, string> = {
  confirmed: 'Confirmed / Valid',
  completed: 'Completed / Used',
  cancelled: 'Cancelled',
  no_show: 'No show / Expired',
  pending_confirmation: 'Pending confirmation',
}

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

/* ─────────── Booking cards ─────────── */

function serviceIcon(v: LoungeVisit) {
  switch (v.resourceType) {
    case 'DINING':
      return { Icon: UtensilsCrossed, tint: 'bg-orange-50 text-orange-600' }
    case 'FAST_TRACK':
      return { Icon: Zap, tint: 'bg-sky-50 text-sky-600' }
    case 'FITNESS':
      return { Icon: Dumbbell, tint: 'bg-emerald-50 text-emerald-600' }
    default:
      return isWalkIn(v)
        ? { Icon: Ticket, tint: 'bg-violet-50 text-violet-600' }
        : { Icon: Sofa, tint: 'bg-indigo-50 text-indigo-600' }
  }
}

function CardField({ icon: Icon, label, children }: { icon: ElementType; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <div className="truncate text-sm text-gray-900">{children}</div>
      </div>
    </div>
  )
}

function BookingCard({ v }: { v: LoungeVisit }) {
  const { Icon, tint } = serviceIcon(v)
  const name = v.customer?.name || v.contactName
  const email = v.customer?.email || v.contactEmail
  const epass = v.walkinPass?.ePassId ?? v.epassCode
  const dp = v.dragonpassOrderIds ?? []
  const pay = v.paymentStatus
  const chargedDiffers = pay && (pay.amountCents !== v.totalCost || pay.currency !== v.currency)

  return (
    <Link
      to={`/dashboard/veloxverse/lounge-bookings/${v.id}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      {/* Header: service + status */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900" title={v.loungeName ?? undefined}>
              {v.loungeName ?? 'Unknown venue'}
            </p>
            <p className="truncate text-xs text-gray-500">
              {serviceLabel(v)}
              {v.airportCode && <> · <span className="font-medium text-gray-700">{v.airportCode}</span></>}
            </p>
          </div>
        </div>
        <Badge variant={visitStatusVariant(v)}>{visitStatusLabel(v)}</Badge>
      </div>

      {/* Customer */}
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
          {getInitials(name || email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{name || 'Unknown customer'}</p>
          {email && <p className="truncate text-xs text-gray-500" title={email}>{email}</p>}
        </div>
        {v.customer?.isGuest && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 ring-1 ring-amber-200">
            Guest
          </span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
        <CardField icon={CalendarDays} label="Visit">
          {formatVisitDate(v.visitDate)}
          <span className="block truncate text-xs text-gray-500">
            {isWalkIn(v) ? 'Walk-in pass' : v.visitTime ? `${v.visitTime} local time` : '—'}
          </span>
        </CardField>
        <CardField icon={Users} label="Party">
          <span className="whitespace-normal text-sm leading-snug">{partyLabel(v)}</span>
        </CardField>
        <CardField icon={Hash} label="Order no.">
          <span className="font-mono text-xs" title={v.orderId ?? v.id}>{v.orderId ?? v.id.slice(0, 8)}</span>
        </CardField>
        <CardField icon={QrCode} label={epass ? 'ePass ID' : 'DragonPass order'}>
          {epass || dp.length ? (
            <span className="font-mono text-xs" title={[epass, ...dp].filter(Boolean).join(', ')}>
              {epass ?? dp[0]}
              {!epass && dp.length > 1 ? ` +${dp.length - 1}` : ''}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </CardField>
      </div>

      {/* Footer: amount + payment */}
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-gray-900">{formatCentsIn(v.totalCost, v.currency)}</p>
          <p className="truncate text-xs text-gray-500">
            {chargedDiffers ? `${formatCentsIn(pay!.amountCents, pay!.currency)} charged to card` : `Booked ${formatVisitDate(v.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pay ? (
            <Badge variant={paymentStatusVariant(pay.status)}>{pay.status}</Badge>
          ) : (
            <span className="text-xs text-gray-400">Wallet</span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
        </div>
      </div>
    </Link>
  )
}

function BookingCardGrid({
  visits,
  loading,
  emptyMessage,
}: {
  visits: LoungeVisit[]
  loading: boolean
  emptyMessage: string
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (!visits.length) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Search className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {visits.map((v) => (
        <BookingCard key={v.id} v={v} />
      ))}
    </div>
  )
}

/* ─────────── Bookings list (shared between tabs) ─────────── */

type VisitsTab = 'lounge' | 'fitness' | 'dining' | 'fasttrack' | 'all'

const TAB_QUERY: Record<VisitsTab, { bookingType: LoungeBookingTypeFilter; resourceType?: LoungeResourceType }> = {
  lounge: { bookingType: 'lounge' },
  fitness: { bookingType: 'benefit', resourceType: 'FITNESS' },
  dining: { bookingType: 'benefit', resourceType: 'DINING' },
  fasttrack: { bookingType: 'benefit', resourceType: 'FAST_TRACK' },
  all: { bookingType: 'all' },
}

function VisitsList({ tab }: { tab: VisitsTab }) {
  // Filters live in the URL so "Back" from a booking detail page restores the same search.
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const airport = params.get('airport') ?? ''
  const status = (params.get('status') ?? '') as '' | LoungeVisitStatus
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debouncedSearch = useDebounce(search.trim(), 350)

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  useEffect(() => {
    if (debouncedSearch !== (params.get('q') ?? '')) setParam('q', debouncedSearch)
  }, [debouncedSearch, params, setParam])

  const { data, isLoading, isFetching, isError, error } = useVVLoungeVisits({
    page,
    limit: PAGE_SIZE,
    airport: airport || undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    ...TAB_QUERY[tab],
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Email, name, order no., ePass ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${selectClass} w-full pl-9`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <div className="sm:w-[180px]">
            <Input
              placeholder="Airport (e.g. LGW)"
              value={airport}
              maxLength={3}
              onChange={(e) => setParam('airport', e.target.value.toUpperCase().trim())}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
            className={`${selectClass} w-full sm:w-auto`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? STATUS_OPTION_LABEL[s] : 'All statuses'}
              </option>
            ))}
          </select>
        </div>
        {data && (
          <span className="text-xs text-gray-500">
            {data.total.toLocaleString()} booking{data.total === 1 ? '' : 's'}
          </span>
        )}
        {isFetching && !isLoading && <span className="text-xs text-gray-400">Updating…</span>}
      </div>

      {isError ? (
        <Card>
          <p className="text-sm text-red-600">
            Failed to load bookings{error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </Card>
      ) : (
        <BookingCardGrid
          visits={data?.items ?? []}
          loading={isLoading}
          emptyMessage={debouncedSearch ? `No bookings match “${debouncedSearch}”.` : 'No bookings found.'}
        />
      )}

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={(p) => setParam('page', p > 1 ? String(p) : '')}
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

const TABS = ['lounge', 'dining', 'fasttrack', 'fitness', 'all', 'memberships'] as const
type PageTab = (typeof TABS)[number]

export default function VVLoungePage() {
  const { data: stats, isLoading } = useVVLoungeStats()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as PageTab | null
  const activeTab: PageTab = tabParam && TABS.includes(tabParam) ? tabParam : 'lounge'
  // Switching service drops the previous tab's filters.
  const changeTab = (tab: string) => setParams(tab === 'lounge' ? {} : { tab }, { replace: true })

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
            <p className="text-sm text-gray-500">Bookings, customers and ePasses across Lounge, Dining, Fast Track and Fitness.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {/* No revenue card: bookings are charged in many currencies, so a single total would be misleading. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          <>
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

      <Tabs defaultValue="lounge" value={activeTab} onChange={changeTab}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="lounge" className="gap-1.5">
            <Sofa className="h-3.5 w-3.5" />
            Lounge
          </TabsTrigger>
          <TabsTrigger value="dining" className="gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Dining
          </TabsTrigger>
          <TabsTrigger value="fasttrack" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Fast Track
          </TabsTrigger>
          <TabsTrigger value="fitness" className="gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" />
            Fitness
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
        </TabsList>
        <TabsContent value="memberships">
          <MembershipsTab />
        </TabsContent>
        {activeTab !== 'memberships' && (
          <div className="pt-4">
            {/* Keyed so switching tabs resets the local search input along with the URL filters. */}
            <VisitsList key={activeTab} tab={activeTab} />
          </div>
        )}
      </Tabs>
    </div>
  )
}
