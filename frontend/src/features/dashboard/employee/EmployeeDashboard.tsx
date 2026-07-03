import { useQuery } from '@tanstack/react-query'
import { authService } from '@/features/auth/authService'
import { useAuthStore } from '@/store/authStore'
import ProfileCard from './components/ProfileCard'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { CheckSquare, Inbox, Clock } from 'lucide-react'

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        <span className="inline-block mt-2 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          Coming soon
        </span>
      </div>
    </div>
  )
}

export default function EmployeeDashboard() {
  const storeUser = useAuthStore((s) => s.user)

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authService.getMe,
    initialData: storeUser ?? undefined,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Loading your profile…" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your profile and track your activity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card — takes 1 col */}
        <div className="lg:col-span-1">
          <ProfileCard user={user} />
        </div>

        {/* Future modules — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Quick Overview
            </p>
            <div className="space-y-3">
              <ComingSoonCard
                icon={<CheckSquare size={18} className="text-gray-400" />}
                title="My Tasks"
                description="View and manage your assigned tasks."
              />
              <ComingSoonCard
                icon={<Inbox size={18} className="text-gray-400" />}
                title="My Leads"
                description="Track leads assigned to you."
              />
              <ComingSoonCard
                icon={<Clock size={18} className="text-gray-400" />}
                title="Activity Log"
                description="Your recent activity in the CRM."
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
