import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { useVVEsimOrders } from '../hooks/useVVEsim'
import { formatUsd, formatDateTime, statusBadgeVariant } from '../utils'
import type { AdminOrderRow } from '../types'

const LIMIT = 20

export default function VVEsimListPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  // Reset to page 1 whenever a filter changes so results aren't stranded
  // on a page that no longer exists for the new query.
  useEffect(() => {
    setPage(1)
  }, [search, status])

  const { data, isLoading, isFetching } = useVVEsimOrders(page, LIMIT, { search, status })

  const orders = data?.orders ?? []
  const pagination = data?.pagination

  // Status options are derived from whatever the backend has actually
  // returned so far, rather than a hardcoded enum — the real set of
  // eSIM order statuses isn't documented for this endpoint, so this
  // avoids showing filter options that don't exist or hiding ones that do.
  const [knownStatuses, setKnownStatuses] = useState<string[]>([])
  useEffect(() => {
    if (!orders.length) return
    setKnownStatuses((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const o of orders) {
        if (o.status && !next.has(o.status)) {
          next.add(o.status)
          changed = true
        }
      }
      return changed ? Array.from(next).sort() : prev
    })
  }, [orders])

  // Client-side filtering on the currently-loaded page — a guaranteed
  // fallback regardless of whether the backend honors the search/status
  // query params above (unconfirmed for this endpoint).
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      const matchesSearch = !q || o.orderNo.toLowerCase().includes(q)
      const matchesStatus = !status || o.status === status
      return matchesSearch && matchesStatus
    })
  }, [orders, search, status])

  const columns = [
    {
      key: 'orderNo',
      header: 'Order No',
      render: (row: AdminOrderRow) => (
        <span className="font-mono text-xs text-gray-500">{row.orderNo}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'No. of eSIMs',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-900">{row.quantity}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Create Time',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-500">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'costUsd',
      header: 'Cost',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-500">{formatUsd(row.costUsd ?? 0)}</span>
      ),
    },
    {
      key: 'sellingPriceUsd',
      header: 'Selling Price',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-900">{formatUsd(row.sellingPriceUsd ?? 0)}</span>
      ),
    },
    {
      key: 'profit',
      header: 'Profit',
      render: (row: AdminOrderRow) => {
        const profit = row.profitUsd ?? (row.sellingPriceUsd ?? 0) - (row.costUsd ?? 0)
        return (
          <span className={profit > 0 ? 'text-emerald-600' : 'text-red-600'}>
            {formatUsd(profit)}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: AdminOrderRow) => (
        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row: AdminOrderRow) => (
        <Link to={`/dashboard/veloxverse/esim-orders/${encodeURIComponent(row.orderNo)}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">eSIM Orders</h1>
        <p className="text-sm text-gray-500">
          All customer eSIM orders with pricing and profit.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order no…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
        >
          <option value="">All statuses</option>
          {knownStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {(search || status) && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatus('')
            }}
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Clear filters
          </button>
        )}

        {isFetching && !isLoading && (
          <span className="text-xs text-gray-400">Refreshing…</span>
        )}
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={filteredOrders}
          keyField="orderNo"
          loading={isLoading}
          emptyMessage={search || status ? 'No eSIM orders match your filters.' : 'No eSIM orders yet.'}
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
