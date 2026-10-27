import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useVVUsers } from '../hooks/useVVUsers'
import { vvUsersService } from '../vvAdminService'
import DateRangeFilter from '../components/reports/DateRangeFilter'
import ExportCsvButton from '../components/reports/ExportCsvButton'
import { ALL_TIME, isReversedRange, rangeParams, type ReportRange } from '../reportRange'
import VVUserAvatar from '../components/VVUserAvatar'
import { formatDate } from '../utils'
import { useAuthStore } from '@/store/authStore'
import { vvAccountStatus, vvRoleBadgeVariant, vvRoleLabel, type VVAccountStatus } from '../userAccess'
import type { VVAdminUser, VVUserRole } from '../types'

const LIMIT = 20

// This page is for VeloxVerse customers only — registered users and guests. ADMIN/SUPER_ADMIN
// are staff accounts, not customers, and have no business showing up in a customer list (and
// this list gives no way to promote anyone into those roles either — see the detail page).
const VV_CUSTOMER_ROLES: VVUserRole[] = ['USER', 'GUEST']

/** Active / Blocked / Inactive — Blocked carries "Blocked on {date}. Only an admin can unblock." */
function AccountStatusBadge({ user }: { user: VVAdminUser }) {
  const s = vvAccountStatus(user)
  return (
    <span title={s.tooltip}>
      <Badge variant={s.variant}>{s.label}</Badge>
    </span>
  )
}

const STATUS_FILTERS: { value: '' | VVAccountStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'inactive', label: 'Inactive' },
]

export default function VVUsersListPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search.trim(), 300)

  // Staff accounts (admin / super admin / support) are managed by super admins only, so only
  // they are offered the option to list them. Everyone else sees customers, as before.
  const isSuperAdmin = useAuthStore((s) => s.user?.role) === 'super_admin'
  const [includeStaff, setIncludeStaff] = useState(false)
  const showStaff = isSuperAdmin && includeStaff
  const [statusFilter, setStatusFilter] = useState<'' | VVAccountStatus>('')
  const [range, setRange] = useState<ReportRange>(ALL_TIME)

  // VeloxVerse applies every filter across all accounts (so totals and pages are right); a
  // reversed custom range is not sent (the filter shows why).
  const filters = useMemo(
    () => ({
      search: debounced || undefined,
      status: statusFilter || undefined,
      roles: showStaff ? undefined : VV_CUSTOMER_ROLES,
      ...(isReversedRange(range) ? {} : rangeParams(range)),
    }),
    [debounced, statusFilter, showStaff, range]
  )
  useEffect(() => {
    setPage(1)
  }, [filters])

  const { data, isLoading } = useVVUsers(page, filters)
  const users = data?.users ?? []
  const pagination = data?.pagination

  const columns = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row: VVAdminUser) => (
        <Link
          to={`/dashboard/veloxverse/users/${row.id}`}
          className="flex items-center gap-2.5 font-medium text-gray-900 hover:text-indigo-600"
        >
          <VVUserAvatar user={row} size="sm" />
          {row.fullName || row.email}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: VVAdminUser) => (
        <span className="text-gray-500">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Account type',
      render: (row: VVAdminUser) => (
        <Badge variant={vvRoleBadgeVariant(row.role)}>{vvRoleLabel(row.role)}</Badge>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: VVAdminUser) => (
        <AccountStatusBadge user={row} />
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (row: VVAdminUser) => (
        <span className="whitespace-nowrap text-gray-500">{formatDate(row.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">
          Search and manage customer accounts.
        </p>
      </div>

      {isSuperAdmin && (
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeStaff}
            onChange={(e) => setIncludeStaff(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          Include staff accounts (admin, super admin, support)
        </label>
      )}

      <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        Status
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | VVAccountStatus)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-md sm:flex-1">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
        {pagination && (
          <span className="text-xs text-gray-500">
            {pagination.total.toLocaleString()} account{pagination.total === 1 ? '' : 's'}
          </span>
        )}
        <ExportCsvButton
          className="w-full sm:ml-auto sm:w-auto"
          disabled={isReversedRange(range)}
          onExport={() => vvUsersService.exportCsv(filters)}
        />
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={users}
          keyField="id"
          loading={isLoading}
          emptyMessage="No users found."
        />
      </Card>

      {pagination && pagination.total > 0 && (
        <Pagination
          page={page}
          pageSize={LIMIT}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
