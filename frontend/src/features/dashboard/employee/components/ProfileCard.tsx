import { Mail, Shield, Activity } from 'lucide-react'
import type { User } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'

interface Props {
  user: User
}

export default function ProfileCard({ user }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Banner */}
      <div className="h-20 bg-gradient-to-r from-indigo-500 to-violet-500" />

      {/* Avatar + info */}
      <div className="px-6 pb-6">
        <div className="-mt-8 mb-4">
          <Avatar name={user.name} size="xl" className="ring-4 ring-white" />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
          <p className="text-sm text-gray-500 capitalize">
            {user.role.replace(/_/g, ' ')}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Mail size={16} className="text-gray-400 shrink-0" />
            {user.email}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Shield size={16} className="text-gray-400 shrink-0" />
            <span className="capitalize">{user.role.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Activity size={16} className="text-gray-400 shrink-0" />
            <Badge variant={user.is_active ? 'success' : 'danger'} dot>
              {user.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
