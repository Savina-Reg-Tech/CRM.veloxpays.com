import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Employee } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

interface Props {
  employees: Employee[]
  total?: number
}

export default function RecentEmployees({ employees, total }: Props) {
  const recent = employees.slice(0, 5)
  const totalCount = total ?? employees.length

  return (
    <div>
      <div className="space-y-3">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No users yet. Create your first one above.
          </p>
        ) : (
          recent.map((emp) => (
            <div
              key={emp.id}
              className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 transition-colors"
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
          ))
        )}
      </div>

      {totalCount > recent.length && (
        <Link
          to="/dashboard/employees"
          className="mt-4 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View all {totalCount} users
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}
