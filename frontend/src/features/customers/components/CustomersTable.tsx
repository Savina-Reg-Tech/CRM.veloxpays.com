import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Table } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { UnifiedCustomerRow } from '@/types'
import type { VVAdminUser } from '@/features/veloxverse-admin/types'
import { CUSTOMER_SOURCES_CONFIG } from '@/config/customerSources'
import { formatCustomerLegalName } from '../utils'

interface Props {
  rows: UnifiedCustomerRow[]
  loading?: boolean
  onView: (row: UnifiedCustomerRow) => void
  onEdit: (row: UnifiedCustomerRow) => void
  onDelete?: (row: UnifiedCustomerRow) => void
  deletingKey?: string | null
}

function statusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const s = status.toLowerCase()
  if (s === 'inactive' || s === 'archived' || s === 'suspended') return 'danger'
  if (s === 'pending') return 'warning'
  if (s === 'active' || s === 'verified') return 'success'
  return 'neutral'
}

function getSourceConfig(id: string) {
  return CUSTOMER_SOURCES_CONFIG.find((s) => s.id === id)
}

function getDisplayName(row: UnifiedCustomerRow): string {
  if (row._source === 'crm') return formatCustomerLegalName(row.data)
  if (row._source === 'veloxverse') return row.data.fullName || row.data.email
  return row.data.name
}

function getEmail(row: UnifiedCustomerRow): string {
  return row.data.email
}

function getPhone(row: UnifiedCustomerRow): string {
  if (row._source === 'veloxverse') return '—'
  return row.data.phone ?? '—'
}

export default function CustomersTable({
  rows,
  loading,
  onView,
  onEdit,
  onDelete,
  deletingKey,
}: Props) {
  return (
    <Table
      data={rows}
      keyField="_key"
      loading={loading}
      emptyMessage="No customers found."
      columns={[
        {
          key: 'service',
          header: 'Service',
          render: (row) => {
            const cfg = getSourceConfig(row._source)
            if (!cfg) return null
            return (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badgeClass}`}>
                {cfg.label}
              </span>
            )
          },
        },
        {
          key: 'name',
          header: 'Name',
          render: (row) => (
            <span className="font-medium text-gray-900">{getDisplayName(row)}</span>
          ),
        },
        {
          key: 'email',
          header: 'Email',
          render: (row) => <span className="text-gray-700">{getEmail(row)}</span>,
        },
        {
          key: 'phone',
          header: 'Phone',
          render: (row) => (
            <span className="text-gray-600">{getPhone(row)}</span>
          ),
        },
        {
          key: 'location',
          header: 'Location',
          render: (row) => {
            if (row._source === 'crm') {
              const parts = [row.data.city, row.data.country].filter(Boolean)
              return <span className="text-gray-600">{parts.length ? parts.join(', ') : '—'}</span>
            }
            if (row._source === 'veloxverse') {
              return (
                <Badge variant={row.data.role === 'GUEST' ? 'warning' : 'info'}>
                  {row.data.role === 'GUEST' ? 'Guest' : 'Registered'}
                </Badge>
              )
            }
            return <span className="text-gray-600">{row.data.country ?? '—'}</span>
          },
        },
        {
          key: 'status',
          header: 'Status',
          render: (row) => {
            if (row._source === 'crm') {
              return (
                <Badge variant={statusBadgeVariant(row.data.status)} dot>
                  {row.data.status}
                </Badge>
              )
            }
            if (row._source === 'veloxverse') {
              const u = row.data as VVAdminUser
              return (
                <div className="flex flex-wrap gap-1">
                  <Badge variant={u.isActive ? 'success' : 'danger'} dot>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {!u.isVerified && <Badge variant="warning">Unverified</Badge>}
                </div>
              )
            }
            return (
              <Badge variant={row.data.isActive ? 'success' : 'danger'} dot>
                {row.data.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )
          },
        },
        {
          key: 'details',
          header: 'Orders / Services',
          render: (row) => {
            if (row._source === 'crm') {
              const items = row.data.services ?? []
              if (items.length === 0) return <span className="text-gray-400">—</span>
              return (
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {items.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      title={`${s.name} · ${s.status}`}
                      className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
                    >
                      {s.code}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="text-[10px] text-gray-500">+{items.length - 3}</span>
                  )}
                </div>
              )
            }
            if (row._source === 'veloxverse') {
              const u = row.data as VVAdminUser
              return (
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {u.role} · {u.isVerified ? 'Verified' : 'Unverified'}
                </span>
              )
            }
            const { totalOrders, totalSpent } = row.data
            return (
              <span className="text-gray-700 text-xs whitespace-nowrap">
                {totalOrders} {totalOrders === 1 ? 'order' : 'orders'} · ${totalSpent.toFixed(2)}
              </span>
            )
          },
        },
        {
          key: 'actions',
          header: 'Actions',
          className: 'text-right',
          render: (row) => (
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(row)}>
                <Eye size={14} />
                View
              </Button>
              {row._source === 'crm' && (
                <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                  <Pencil size={14} />
                  Edit
                </Button>
              )}
              {row._source === 'crm' && onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => onDelete(row)}
                  loading={deletingKey === row._key}
                  aria-label={`Delete customer ${getDisplayName(row)}`}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
