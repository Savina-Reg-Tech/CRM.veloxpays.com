import { useState } from 'react'
import { MoreVertical, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Employee } from '@/types'
import { Table } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { formatDate, cn } from '@/lib/utils'
import { useToggleEmployeeStatus } from '../hooks/useToggleEmployeeStatus'

interface Props {
  employees: Employee[]
  loading?: boolean
}

function ActionsMenu({ employee }: { employee: Employee }) {
  const [open, setOpen] = useState(false)
  const toggle = useToggleEmployeeStatus()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
            <button
              onClick={() => {
                setOpen(false)
                toggle.mutate(employee.id)
              }}
              disabled={toggle.isPending}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                employee.is_active
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-emerald-600 hover:bg-emerald-50'
              )}
            >
              {employee.is_active ? (
                <>
                  <ToggleLeft size={15} /> Deactivate
                </>
              ) : (
                <>
                  <ToggleRight size={15} /> Activate
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function EmployeeTable({ employees, loading }: Props) {
  return (
    <Table
      data={employees}
      keyField="id"
      loading={loading}
      emptyMessage="No users found. Create your first user above."
      columns={[
        {
          key: 'name',
          header: 'User',
          render: (row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.name} size="sm" />
              <div>
                <p className="font-medium text-gray-900">{row.name}</p>
                <p className="text-xs text-gray-400">{row.email}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'role',
          header: 'Role',
          render: (row) => (
            <span className="capitalize text-gray-600">
              {row.role.replace(/_/g, ' ')}
            </span>
          ),
        },
        {
          key: 'is_active',
          header: 'Status',
          render: (row) => (
            <Badge variant={row.is_active ? 'success' : 'danger'} dot>
              {row.is_active ? 'Active' : 'Inactive'}
            </Badge>
          ),
        },
        {
          key: 'created_at',
          header: 'Joined',
          render: (row) => (
            <span className="text-gray-500">{formatDate(row.created_at)}</span>
          ),
        },
        {
          key: 'actions',
          header: '',
          headerClassName: 'w-12',
          className: 'text-right',
          render: (row) => <ActionsMenu employee={row} />,
        },
      ]}
    />
  )
}
