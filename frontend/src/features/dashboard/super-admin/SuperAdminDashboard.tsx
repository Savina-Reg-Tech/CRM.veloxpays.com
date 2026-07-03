import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  DollarSign,
  BarChart3,
  PlaneTakeoff,
  Plus,
  Users,
  UserCheck,
  UserX,
  Utensils,
  Wifi,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  useEmployees,
  useEmployeeStats,
} from '@/features/employees/hooks/useEmployees'
import {
  useVVOverview,
  useVVRecentOrders,
  useVVCustomerSpending,
} from '@/features/veloxverse-admin/hooks/useVVAnalytics'
import {
  ACTIVITY_TYPE_BADGE_CLASS,
  activityDirection,
  formatActivityAmount,
  formatUsd,
  timeAgo,
  getInitials as vvGetInitials,
} from '@/features/veloxverse-admin/utils'
import type { RecentActivity, CustomerSpending } from '@/features/veloxverse-admin/types'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import CreateEmployeeModal from '@/features/employees/components/CreateEmployeeModal'
import { formatDate } from '@/lib/utils'
import type { Employee } from '@/types'

/* ───────── Stat Card ───────── */
function StatCard({
  icon,
  label,
  value,
  tint,
  sub,
  to,
}: {
  icon: ReactNode
  label: string
  value: string | number
  tint: string
  sub?: string
  to?: string
}) {
  const inner = (
    <div className="group relative flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

/* ───────── Avatar color helper ───────── */
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

/* ═══════════════ Dashboard ═══════════════ */

export default function SuperAdminDashboard() {
  const user = useAuthStore((s) => s.user)
  const { data: stats, isLoading: statsLoading } = useEmployeeStats()
  const { data: recent, isLoading: recentLoading } = useEmployees({ page: 1, pageSize: 5 })
  const [showCreate, setShowCreate] = useState(false)

  // VeloxVerse data
  const vvOverview = useVVOverview()
  const vvRecent = useVVRecentOrders(8)
  const vvSpending = useVVCustomerSpending(5)

  const total = stats?.total ?? 0
  const active = stats?.active ?? 0
  const inactive = stats?.inactive ?? 0
  const recentItems = recent?.items ?? []

  const maxSpend = Math.max(...(vvSpending.data ?? []).map((c) => c.totalSpendUsd), 1)

  return (
    <div className="space-y-8 max-w-full">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what's happening across your platform today.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
          <Plus size={15} />
          Add User
        </Button>
      </div>

      {/* ══════════ CRM Team Stats ══════════ */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">CRM Team</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : (
            <>
              <StatCard
                icon={<Users size={20} className="text-indigo-600" />}
                tint="bg-indigo-50"
                label="Total Users"
                value={total}
                to="/dashboard/employees"
              />
              <StatCard
                icon={<UserCheck size={20} className="text-emerald-600" />}
                tint="bg-emerald-50"
                label="Active Users"
                value={active}
                sub={`${total > 0 ? Math.round((active / total) * 100) : 0}% of total`}
              />
              <StatCard
                icon={<UserX size={20} className="text-red-500" />}
                tint="bg-red-50"
                label="Inactive Users"
                value={inactive}
              />
            </>
          )}
        </div>
      </section>

      {/* ══════════ VeloxVerse Overview ══════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">VeloxVerse</h3>
          <Link
            to="/dashboard/veloxverse/analytics"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Full analytics <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {vvOverview.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : (
            <>
              <StatCard
                icon={<DollarSign size={20} className="text-emerald-500" />}
                tint="bg-emerald-50"
                label="Total Revenue"
                value={formatUsd(vvOverview.data?.totalRevenueUsd ?? 0)}
                sub={`${vvOverview.data?.totalOrders ?? 0} orders`}
                to="/dashboard/veloxverse/analytics"
              />
              <StatCard
                icon={<Wifi size={20} className="text-blue-500" />}
                tint="bg-blue-50"
                label="eSIM Revenue"
                value={formatUsd(vvOverview.data?.esimRevenueUsd ?? 0)}
                sub={`${vvOverview.data?.esimOrders ?? 0} orders`}
                to="/dashboard/veloxverse/esim-orders"
              />
              <StatCard
                icon={<PlaneTakeoff size={20} className="text-violet-500" />}
                tint="bg-violet-50"
                label="Lounge Revenue"
                value={formatUsd(vvOverview.data?.loungeRevenueUsd ?? 0)}
                sub={`${vvOverview.data?.loungeBookings ?? 0} bookings`}
                to="/dashboard/veloxverse/lounge"
              />
              <StatCard
                icon={<Utensils size={20} className="text-teal-500" />}
                tint="bg-teal-50"
                label="Benefit Revenue"
                value={formatUsd(vvOverview.data?.benefitRevenueUsd ?? 0)}
                sub={`${vvOverview.data?.benefitBookings ?? 0} bookings`}
                to="/dashboard/veloxverse/analytics"
              />
            </>
          )}
        </div>
      </section>

      {/* ══════════ Two-column: Recent CRM Users + VV Activity ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent CRM users */}
        <Card>
          <CardHeader
            title="Recent CRM Users"
            description="Latest users added to the system"
            action={
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New
              </Button>
            }
          />
          {recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded w-1/3 mb-1.5" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No users yet. Create your first one above.</p>
          ) : (
            <div>
              <div className="space-y-1">
                {recentItems.slice(0, 5).map((emp: Employee) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Avatar name={emp.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-xs text-gray-500 truncate">{emp.email}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <Badge variant={emp.is_active ? 'success' : 'danger'} dot>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {formatDate(emp.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {total > 5 && (
                <Link
                  to="/dashboard/employees"
                  className="mt-4 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View all {total} users <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}
        </Card>

        {/* VV Recent Activity */}
        <Card>
          <CardHeader
            title="VeloxVerse Activity"
            description="Latest transactions and bookings"
            action={
              <Link
                to="/dashboard/veloxverse/analytics"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all <ArrowRight size={12} />
              </Link>
            }
          />
          {vvRecent.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded w-2/3 mb-1.5" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-4 w-12 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : (vvRecent.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No VeloxVerse activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {vvRecent.data!.map((o: RecentActivity) => {
                const direction = activityDirection(o)
                const isCredit = direction === 'credit'
                const initials = vvGetInitials(o.customer?.name ?? o.customer?.email)
                const colorClass = avatarColor(o.customer?.name ?? o.customer?.email ?? o.orderNo)
                return (
                  <li
                    key={o.orderNo}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${colorClass}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge className={ACTIVITY_TYPE_BADGE_CLASS[o.type]}>{o.type}</Badge>
                        <p className="truncate text-sm text-gray-900">{o.description}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="truncate text-xs text-gray-500">{o.customer?.email ?? '—'}</p>
                        <span className="text-gray-300">·</span>
                        <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(o.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatActivityAmount(o.amountUsd, direction)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ══════════ Top VV Spenders ══════════ */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Top VeloxVerse Spenders</h3>
            <p className="text-xs text-gray-400 mt-0.5">Highest spending customers across all services</p>
          </div>
          <Link
            to="/dashboard/veloxverse/analytics"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            See all 20 <ArrowRight size={12} />
          </Link>
        </div>
        {vvSpending.isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (vvSpending.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No spending data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-400">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ minWidth: 120 }}>Spend</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(vvSpending.data ?? []).slice(0, 5).map((c: CustomerSpending, idx: number) => {
                  const barPct = maxSpend > 0 ? (c.totalSpendUsd / maxSpend) * 100 : 0
                  return (
                    <tr key={c.userId} className="transition-colors hover:bg-indigo-50/40">
                      <td className="px-4 py-3 text-xs font-medium text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(c.name || c.email)}`}>
                            {vvGetInitials(c.name || c.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{c.name || 'Guest User'}</p>
                            <p className="truncate text-xs text-gray-500">{c.email}</p>
                          </div>
                        </div>
                      </td>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ══════════ Quick Links ══════════ */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'eSIM Orders', icon: Wifi, to: '/dashboard/veloxverse/esim-orders', color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Lounge', icon: PlaneTakeoff, to: '/dashboard/veloxverse/lounge', color: 'text-violet-500', bg: 'bg-violet-50' },
            { label: 'VV Users', icon: Users, to: '/dashboard/veloxverse/users', color: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
            { label: 'Analytics', icon: BarChart3, to: '/dashboard/veloxverse/analytics', color: 'text-indigo-500', bg: 'bg-indigo-50' },
          ].map(({ label, icon: Icon, to, color, bg }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg} transition-transform group-hover:scale-110`}>
                <Icon size={18} className={color} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
              <ArrowUpRight size={14} className="ml-auto text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Create employee modal */}
      <CreateEmployeeModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
