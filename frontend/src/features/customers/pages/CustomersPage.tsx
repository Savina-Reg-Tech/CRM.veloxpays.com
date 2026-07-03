import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/authStore'
import { canViewVeloxVerse } from '@/config/roles'
import type { Customer, UnifiedCustomerRow } from '@/types'
import type { VVAdminUser, VVUserRole } from '@/features/veloxverse-admin/types'
import { formatCustomerLegalName } from '../utils'
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers'
import CustomersTable from '../components/CustomersTable'
import CustomerFormModal from '../components/CustomerFormModal'
import CustomerDetailsModal from '../components/CustomerDetailsModal'
import VeloxVerseCustomerDetailModal from '../components/VeloxVerseCustomerDetailModal'
import { useVVUsers } from '@/features/veloxverse-admin/hooks/useVVUsers'

const PAGE_SIZE = 20

/** VeloxVerse account types shown in the Customers hub (excludes staff roles). */
const VV_CUSTOMER_ROLES: VVUserRole[] = ['USER', 'GUEST']
type VvAccountFilter = 'all' | 'registered' | 'guest'

export default function CustomersPage() {
  const userRole = useAuthStore((s) => s.user?.role)
  const canSeeVeloxVerse = canViewVeloxVerse(userRole)

  const [vvAccountFilter, setVvAccountFilter] = useState<VvAccountFilter>('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => { setPage(1) }, [debouncedSearch, vvAccountFilter])

  const [showCreate, setShowCreate] = useState(false)
  const [viewCrmCustomer, setViewCrmCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [viewVvUser, setViewVvUser] = useState<VVAdminUser | null>(null)

  const {
    data: crmData,
    isLoading: crmLoading,
    isError: crmError,
    isFetching: crmFetching,
  } = useCustomers({ page, pageSize: PAGE_SIZE })

  const deleteCustomer = useDeleteCustomer(() => setDeleteTarget(null))

  const {
    data: vvData,
    isLoading: vvLoading,
    isError: vvError,
  } = useVVUsers(page, debouncedSearch || undefined, { enabled: canSeeVeloxVerse })

  const crmRows = useMemo((): UnifiedCustomerRow[] => {
    let customers = crmData?.items ?? []

    const keyword = debouncedSearch.toLowerCase()
    if (keyword) {
      customers = customers.filter((c) => {
        const legal = formatCustomerLegalName(c).toLowerCase()
        return (
          legal.includes(keyword) ||
          c.email.toLowerCase().includes(keyword) ||
          String(c.id).includes(keyword) ||
          (c.phone ?? '').toLowerCase().includes(keyword) ||
          (c.city ?? '').toLowerCase().includes(keyword) ||
          (c.country ?? '').toLowerCase().includes(keyword) ||
          c.status.toLowerCase().includes(keyword) ||
          (c.source ?? '').toLowerCase().includes(keyword) ||
          (c.source_ref ?? '').toLowerCase().includes(keyword) ||
          (c.added_by_name ?? '').toLowerCase().includes(keyword) ||
          (c.services ?? []).some((s) =>
            `${s.code} ${s.name} ${s.status}`.toLowerCase().includes(keyword)
          )
        )
      })
    }

    return customers.map((c) => ({ _source: 'crm', _key: `crm-${c.id}`, data: c }))
  }, [crmData, debouncedSearch])

  const vvRows = useMemo((): UnifiedCustomerRow[] => {
    if (!canSeeVeloxVerse) return []
    let users = (vvData?.users ?? []).filter((u) => VV_CUSTOMER_ROLES.includes(u.role))

    if (vvAccountFilter === 'guest') {
      users = users.filter((u) => u.role === 'GUEST')
    } else if (vvAccountFilter === 'registered') {
      users = users.filter((u) => u.role === 'USER')
    }

    return users.map((u) => ({
      _source: 'veloxverse',
      _key: `vv-${u.id}`,
      data: u,
    }))
  }, [vvData, canSeeVeloxVerse, vvAccountFilter])

  const activeRows = useMemo(() => [...crmRows, ...vvRows], [crmRows, vvRows])

  const crmTotal = crmData?.total ?? 0
  const vvTotal = canSeeVeloxVerse ? (vvData?.pagination?.total ?? 0) : 0
  const paginationTotal = Math.max(crmTotal, vvTotal)

  const isLoading = crmLoading || crmFetching || (canSeeVeloxVerse && vvLoading)
  const anyError = crmError || (canSeeVeloxVerse && vvError)

  const handleView = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setViewCrmCustomer(row.data)
    else if (row._source === 'veloxverse') setViewVvUser(row.data)
  }

  const handleEdit = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setEditCustomer(row.data)
  }

  const handleDelete = (row: UnifiedCustomerRow) => {
    if (row._source === 'crm') setDeleteTarget(row.data)
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            CRM contacts and VeloxVerse users & guests — with live orders, cancellations,
            and pending actions.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="shrink-0">
          <Plus size={15} />
          Add Customer
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {canSeeVeloxVerse && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="vv-account-filter"
              className="text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              VeloxVerse account
            </label>
            <select
              id="vv-account-filter"
              value={vvAccountFilter}
              onChange={(e) => setVvAccountFilter(e.target.value as VvAccountFilter)}
              className="rounded-lg border border-gray-300 bg-white pl-3 pr-8 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="all">All accounts</option>
              <option value="registered">Registered users</option>
              <option value="guest">Guests</option>
            </select>
          </div>
        )}

        <div className="flex-1 min-w-[240px] max-w-sm">
          <Input
            placeholder="Search by name, email, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
      </div>

      {debouncedSearch && (
        <p className="text-xs text-gray-400 -mt-3">
          CRM results are filtered on the current page.
          {canSeeVeloxVerse && ' VeloxVerse search applies across all records.'}
        </p>
      )}

      {anyError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 space-y-1">
          {crmError && (
            <p className="text-sm text-red-600">
              Failed to load CRM customers. Please refresh the page.
            </p>
          )}
          {canSeeVeloxVerse && vvError && (
            <p className="text-sm text-red-600">
              Failed to load VeloxVerse customers. Ensure the VeloxVerse bridge is configured.
            </p>
          )}
        </div>
      )}

      <CustomersTable
        rows={activeRows}
        loading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        deletingKey={
          deleteCustomer.isPending && deleteTarget ? `crm-${deleteTarget.id}` : null
        }
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={paginationTotal}
        onPageChange={setPage}
      />

      {!isLoading && !anyError && activeRows.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          {debouncedSearch
            ? `No customers match "${debouncedSearch}" on this page.`
            : 'No customers found.'}
        </p>
      )}

      <CustomerFormModal open={showCreate} onClose={() => setShowCreate(false)} />

      <CustomerDetailsModal
        open={!!viewCrmCustomer}
        customer={viewCrmCustomer}
        onClose={() => setViewCrmCustomer(null)}
        onEdit={() => {
          setEditCustomer(viewCrmCustomer)
          setViewCrmCustomer(null)
        }}
      />

      <CustomerFormModal
        open={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteCustomer.isPending) setDeleteTarget(null)
        }}
        title="Delete customer?"
        description="This soft-deletes the record. You can restore it from the database if needed, but it will no longer appear in the CRM."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteCustomer.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteCustomer.isPending}
              onClick={() => {
                if (deleteTarget) deleteCustomer.mutate(deleteTarget.id)
              }}
            >
              Yes, delete
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-gray-700">
            You're about to delete{' '}
            <strong>{formatCustomerLegalName(deleteTarget)}</strong> ({deleteTarget.email}).
          </p>
        )}
      </Modal>

      <VeloxVerseCustomerDetailModal
        open={!!viewVvUser}
        onClose={() => setViewVvUser(null)}
        user={viewVvUser}
      />
    </div>
  )
}
