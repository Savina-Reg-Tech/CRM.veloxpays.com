import { useState } from 'react'
import { KeyRound, MoreVertical, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Employee } from '@/types'
import { Table } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { formatDate, cn } from '@/lib/utils'
import { isProtectedAccount } from '@/config/roles'
import { useToggleEmployeeStatus } from '../hooks/useToggleEmployeeStatus'
import ResetPasswordModal from './ResetPasswordModal'

interface Props {
  employees: Employee[]
  loading?: boolean
}

function ActionsMenu({
  employee,
  onResetPassword,
}: {
  employee: Employee
  onResetPassword: (employee: Employee) => void
}) {
  const [open, setOpen] = useState(false)
  const toggle = useToggleEmployeeStatus()
  // The primary super-admin account can never be deactivated (backend also
  // enforces this) — disable the action here instead of letting it 403.
  const isProtected = isProtectedAccount(employee.email)
  const blockDeactivate = isProtected && employee.is_active

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
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
            <button
              onClick={() => {
                setOpen(false)
                onResetPassword(employee)
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <KeyRound size={15} /> Reset password
            </button>
            {blockDeactivate ? (
              <div
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                title="This is the protected primary super admin account and cannot be deactivated."
              >
                <ShieldCheck size={15} /> Protected account
              </div>
            ) : (
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
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function EmployeeTable({ employees, loading }: Props) {
  const [resetTarget, setResetTarget] = useState<Employee | null>(null)

  return (
    <>
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
            render: (row) => (
              <ActionsMenu employee={row} onResetPassword={setResetTarget} />
            ),
          },
        ]}
      />
      <ResetPasswordModal
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        employee={resetTarget}
      />
    </>
  )
}
