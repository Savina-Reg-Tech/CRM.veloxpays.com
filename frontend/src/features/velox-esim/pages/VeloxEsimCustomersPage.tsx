import { useEffect, useState } from 'react'
import { Search, Smartphone } from 'lucide-react'
import Input from '@/components/ui/Input'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/lib/utils'
import { useVeloxEsimCustomers, useVeloxEsimHealth } from '../hooks/useVeloxEsim'
import VeloxEsimCustomerDetailModal from '../components/VeloxEsimCustomerDetailModal'
import { useVeloxEsimCustomer } from '../hooks/useVeloxEsim'

const PAGE_SIZE = 20

export default function VeloxEsimCustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data: health } = useVeloxEsimHealth()
  const { data, isLoading, isError, error } = useVeloxEsimCustomers({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
  })
  const { data: detail, isLoading: detailLoading } = useVeloxEsimCustomer(selectedId)

  const customers = data?.customers ?? []
  const pagination = data?.pagination
  const total = pagination?.total ?? 0

  const errMsg =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    'Failed to load Velox eSIM customers.'

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone size={22} className="text-indigo-600" />
            eSIM Customers
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Live data from the Velox eSIM platform. Super Admin and Admin only.
          </p>
        </div>
        {health && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              health.reachable
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <p className="font-medium">
              {health.reachable ? 'Velox API connected' : 'Velox API unavailable'}
            </p>
            <p className="opacity-80 mt-0.5">{health.message}</p>
          </div>
        )}
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Search name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
        />
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          {errMsg}
          {!health?.configured && (
            <p className="mt-2 text-red-600">
              Set <code className="text-xs">VELOX_API_URL</code> and{' '}
              <code className="text-xs">VELOX_API_KEY</code> on the CRM backend, then restart.
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Spent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last purchase</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  No eSIM customers found.
                </td>
              </tr>
            ) : (
              customers.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-[140px]">
                      {row.id}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{row.email}</p>
                    <p className="text-xs text-gray-500">{row.phone ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.totalOrders}</td>
                  <td className="px-4 py-3 text-gray-700">${row.totalSpent.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.isActive ? 'success' : 'danger'} dot>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {row.lastPurchaseAt ? formatDate(row.lastPurchaseAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      )}

      <VeloxEsimCustomerDetailModal
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        customer={detail ?? (customers.find((c) => c.id === selectedId) ?? null)}
        isLoading={detailLoading && selectedId != null}
      />
    </div>
  )
}
