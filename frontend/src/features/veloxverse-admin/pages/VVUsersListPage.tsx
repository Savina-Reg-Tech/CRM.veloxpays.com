import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useVVUsers } from '../hooks/useVVUsers'
import { formatDate } from '../utils'
import type { VVAdminUser, VVUserRole } from '../types'

const LIMIT = 20

// This page is for VeloxVerse customers only — registered users and guests. ADMIN/SUPER_ADMIN
// are staff accounts, not customers, and have no business showing up in a customer list (and
// this list gives no way to promote anyone into those roles either — see the detail page).
const VV_CUSTOMER_ROLES: VVUserRole[] = ['USER', 'GUEST']

export default function VVUsersListPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search, 300)
  const { data, isLoading } = useVVUsers(page, debounced || undefined)

  const users = (data?.users ?? []).filter((u) => VV_CUSTOMER_ROLES.includes(u.role))
  const pagination = data?.pagination

  const columns = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row: VVAdminUser) => (
        <Link
          to={`/dashboard/veloxverse/users/${row.id}`}
          className="font-medium text-gray-900 hover:text-indigo-600"
        >
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
        <Badge variant={row.role === 'GUEST' ? 'warning' : 'neutral'}>
          {row.role === 'GUEST' ? 'Guest' : 'Registered'}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: VVAdminUser) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (row: VVAdminUser) => (
        <span className="text-gray-500">{formatDate(row.createdAt)}</span>
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

      <div className="max-w-md">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          leftIcon={<Search size={16} />}
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
