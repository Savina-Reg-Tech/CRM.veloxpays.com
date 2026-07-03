import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  iconBg: string
  trend?: string
  trendUp?: boolean
}

function StatCard({ label, value, icon, iconBg, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {trend && (
          <p className={cn('text-xs mt-1 flex items-center gap-1', trendUp ? 'text-emerald-600' : 'text-red-500')}>
            <TrendingUp size={11} className={trendUp ? '' : 'rotate-180'} />
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}

interface StatsCardsProps {
  total: number
  active: number
  inactive: number
  loading?: boolean
}

export default function StatsCards({ total, active, inactive, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-gray-100" />
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-7 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Users"
        value={total}
        icon={<Users size={20} className="text-indigo-600" />}
        iconBg="bg-indigo-50"
      />
      <StatCard
        label="Active Users"
        value={active}
        icon={<UserCheck size={20} className="text-emerald-600" />}
        iconBg="bg-emerald-50"
        trend={`${total > 0 ? Math.round((active / total) * 100) : 0}% of total`}
        trendUp={active > inactive}
      />
      <StatCard
        label="Inactive Users"
        value={inactive}
        icon={<UserX size={20} className="text-red-500" />}
        iconBg="bg-red-50"
      />
    </div>
  )
}
