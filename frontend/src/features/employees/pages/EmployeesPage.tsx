import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeTable from '../components/EmployeeTable'
import CreateEmployeeModal from '../components/CreateEmployeeModal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/authStore'

const PAGE_SIZE = 20

export default function EmployeesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 250)
  const role = useAuthStore((s) => s.user?.role)
  const canViewUsers = role === 'super_admin' || role === 'admin'

  const { data, isLoading, isError, isFetching } = useEmployees({
    enabled: canViewUsers,
    page,
    pageSize: PAGE_SIZE,
  })

  const employees = data?.items ?? []
  const total = data?.total ?? 0

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      e.email.toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your team — {total} member
            {total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
          <Plus size={15} />
          Add User
        </Button>
      </div>

      {canViewUsers && (
        <div className="max-w-sm">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
          {debouncedSearch && (
            <p className="text-xs text-gray-400 mt-1.5">
              Search applies to the current page only.
            </p>
          )}
        </div>
      )}

      {canViewUsers && isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-600">
            Failed to load users. Please refresh the page.
          </p>
        </div>
      )}

      {canViewUsers ? (
        <>
          <EmployeeTable employees={filtered} loading={isLoading || isFetching} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
          <p className="text-sm text-indigo-700">
            You can create <strong>agent</strong> and <strong>affiliate</strong> users from this page.
            User list visibility is available for admin and super admin roles only.
          </p>
        </div>
      )}

      {canViewUsers && !isLoading && !isError && filtered.length === 0 && debouncedSearch && (
        <p className="text-sm text-gray-500 text-center py-4">
          No users on this page match "<strong>{debouncedSearch}</strong>"
        </p>
      )}

      <CreateEmployeeModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
