import { useState, useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  DollarSign,
  PlaneTakeoff,
  Search,
  TrendingUp,
  Users,
  Utensils,
  Wifi,
} from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LineChart, BarChart } from '../components/Charts'
import {
  ACTIVITY_TYPE_BADGE_CLASS,
  activityDirection,
  formatActivityAmount,
  formatUsd,
  timeAgo,
  getInitials,
  statusBadgeVariant,
} from '../utils'
import {
  useVVOverview,
  useVVRevenue,
  useVVGrowth,
  useVVPopularPackages,
  useVVRecentOrders,
  useVVOrderStats,
  useVVCustomerSpending,
} from '../hooks/useVVAnalytics'
import type { CustomerSpending, RecentActivity } from '../types'

const PERIODS = ['7d', '30d', '90d']

/* ───────────────────── Stat Card ───────────────────── */
function StatCard({
  icon,
  label,
  value,
  tint,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  tint: string
  sub?: string
}) {
  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

/* ───────────────────── Order Status Bars ───────────────────── */
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  CONFIRMED: 'bg-blue-500',
  ACTIVE: 'bg-indigo-500',
  PENDING: 'bg-amber-400',
  CANCELLED: 'bg-red-400',
  FAILED: 'bg-red-500',
  NO_SHOW: 'bg-gray-400',
}

function OrderStatusBars({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const total = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
        const color = STATUS_COLORS[status] ?? 'bg-gray-300'
        return (
          <div key={status} className="group">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">{status.replace(/_/g, ' ')}</span>
              <span className="text-gray-500 tabular-nums">
                {count} <span className="text-gray-400 text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────── Customer Initials Avatar ───────────────────── */
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-violet-100 text-violet-700',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/* ─────────────────── Main Page ─────────────────── */

export default function VVAnalyticsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('30d')
  const [spendingSearch, setSpendingSearch] = useState('')

  const overview = useVVOverview()
  const revenue = useVVRevenue(period)
  const growth = useVVGrowth(period)
  const popular = useVVPopularPackages(10)
  const recent = useVVRecentOrders(15)
  const orderStats = useVVOrderStats()
  const spending = useVVCustomerSpending(20)

  // filtered + ranked spending
  const filteredSpending = useMemo(() => {
    const list = spending.data ?? []
    if (!spendingSearch.trim()) return list
    const q = spendingSearch.toLowerCase()
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [spending.data, spendingSearch])

  const maxSpend = useMemo(
    () => Math.max(...(spending.data ?? []).map((c) => c.totalSpendUsd), 1),
    [spending.data]
  )

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
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
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500">Revenue, growth, and customer spending across all services.</p>
          </div>
        </div>
      </div>

      {/* Overview — top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              tint="bg-emerald-50"
              label="Total revenue"
              value={formatUsd(overview.data?.totalRevenueUsd ?? 0)}
              sub={`${overview.data?.totalOrders ?? 0} orders`}
            />
            <StatCard
              icon={<Users className="h-5 w-5 text-fuchsia-500" />}
              tint="bg-fuchsia-50"
              label="Active users"
              value={String(overview.data?.activeUsers ?? 0)}
            />
            <StatCard
              icon={<Wifi className="h-5 w-5 text-amber-500" />}
              tint="bg-amber-50"
              label="Active eSIMs"
              value={String(overview.data?.activeEsims ?? 0)}
            />
            <StatCard
              icon={<CreditCard className="h-5 w-5 text-sky-500" />}
              tint="bg-sky-50"
              label="Wallet top-ups"
              value={formatUsd(overview.data?.totalWalletTopUpsUsd ?? 0)}
            />
          </>
        )}
      </div>

      {/* Revenue breakdown by service */}
      {!overview.isLoading && overview.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Wifi className="h-5 w-5 text-blue-500" />}
            tint="bg-blue-50"
            label="eSIM revenue"
            value={formatUsd(overview.data.esimRevenueUsd)}
            sub={`${overview.data.esimOrders} orders`}
          />
          <StatCard
            icon={<PlaneTakeoff className="h-5 w-5 text-violet-500" />}
            tint="bg-violet-50"
            label="Lounge revenue"
            value={formatUsd(overview.data.loungeRevenueUsd)}
            sub={`${overview.data.loungeBookings} bookings`}
          />
          <StatCard
            icon={<Utensils className="h-5 w-5 text-teal-500" />}
            tint="bg-teal-50"
            label="Benefit revenue"
            value={formatUsd(overview.data.benefitRevenueUsd)}
            sub={`${overview.data.benefitBookings} bookings`}
          />
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
              period === p
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Revenue — All Services (USD)</h2>
          {revenue.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <LineChart
              valuePrefix="$"
              points={(revenue.data?.points ?? []).map((p) => ({ label: p.date, value: p.amount }))}
            />
          )}
        </Card>
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">New signups</h2>
          {growth.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <BarChart points={(growth.data?.points ?? []).map((p) => ({ label: p.date, value: p.count }))} />
          )}
        </Card>
      </div>

      {/* Order status breakdown — visual bars */}
      {orderStats.data && (
        <Card padding="sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Order & booking status</h2>
            <span className="text-xs text-gray-400">{orderStats.data.total} total</span>
          </div>
          <OrderStatusBars byStatus={orderStats.data.byStatus} />
        </Card>
      )}

      {/* ═══════════ Customer Spending Table ═══════════ */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Customer spending (top 20)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click a row to view customer details</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={spendingSearch}
              onChange={(e) => setSpendingSearch(e.target.value)}
              placeholder="Search customers…"
              className="h-8 w-52 rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
            />
          </div>
        </div>

        {spending.isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : filteredSpending.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {spendingSearch ? 'No matching customers.' : 'No customer spending data yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-400">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">eSIM</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Lounge</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Benefits</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ minWidth: 140 }}>Spend</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSpending.map((c: CustomerSpending) => {
                  const rank = (spending.data ?? []).indexOf(c) + 1
                  const barPct = maxSpend > 0 ? (c.totalSpendUsd / maxSpend) * 100 : 0
                  return (
                    <tr
                      key={c.userId}
                      onClick={() => navigate(`/dashboard/veloxverse/users/${c.userId}`)}
                      className="cursor-pointer transition-colors hover:bg-indigo-50/40 group"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-gray-400">{rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(c.name || c.email)}`}>
                            {getInitials(c.name || c.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">{c.name || 'Guest User'}</p>
                            <p className="truncate text-xs text-gray-500">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{formatUsd(c.esimSpendUsd)}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{formatUsd(c.loungeSpendUsd)}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{formatUsd(c.benefitSpendUsd)}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-semibold text-gray-900">{formatUsd(c.totalSpendUsd)}</td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-gray-500">{c.orderCount}</td>
                      <td className="px-4 py-3 text-right">
                        <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ═══════════ Top packages + Recent activity ═══════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top eSIM packages */}
        <Card padding="sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Top eSIM packages</h2>
          {popular.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (popular.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No sales yet.</p>
          ) : (
            <ul className="space-y-2">
              {popular.data!.map((p, i) => {
                const topRevenue = Math.max(...popular.data!.map((x) => x.revenueUsd), 1)
                const pct = (p.revenueUsd / topRevenue) * 100
                return (
                  <li key={p.packageCode} className="group">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-gray-400 bg-gray-100">
                          {i + 1}
                        </span>
                        <span className="truncate text-gray-900">{p.packageName ?? p.packageCode}</span>
                      </div>
                      <span className="shrink-0 text-gray-500 tabular-nums">
                        {p.count} sold · {formatUsd(p.revenueUsd)}
                      </span>
                    </div>
                    <div className="mt-1 ml-7 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-400/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Recent activity */}
        <Card padding="sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
            <TrendingUp className="h-4 w-4 text-gray-300" />
          </div>
          {recent.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (recent.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.data!.map((o: RecentActivity) => {
                const direction = activityDirection(o)
                const isCredit = direction === 'credit'
                const initials = getInitials(o.customer?.name ?? o.customer?.email)
                const colorClass = avatarColor(o.customer?.name ?? o.customer?.email ?? o.orderNo)
                return (
                  <li
                    key={o.orderNo}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                  >
                    {/* Avatar */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${colorClass}`}>
                      {initials}
                    </div>
                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge className={ACTIVITY_TYPE_BADGE_CLASS[o.type]}>{o.type}</Badge>
                        <p className="truncate text-sm text-gray-900">{o.description}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-xs text-gray-500">{o.customer?.email ?? '—'}</p>
                        <span className="text-gray-300">·</span>
                        <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(o.createdAt)}</span>
                        {o.status && (
                          <>
                            <span className="text-gray-300">·</span>
                            <Badge variant={statusBadgeVariant(o.status)} className="text-[10px] px-1.5 py-0">
                              {o.status}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Amount */}
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        isCredit ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {formatActivityAmount(o.amountUsd, direction)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
