import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  const { data, isLoading } = useVVEsimOrders(page, LIMIT)

  const orders = data?.orders ?? []
  const pagination = data?.pagination

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
      key: 'createTime',
      header: 'Create Time',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-500">{formatDateTime(row.createTime)}</span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-500">{formatUsd(row.cost)}</span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      render: (row: AdminOrderRow) => (
        <span className="text-gray-900">{formatUsd(row.sellingPrice)}</span>
      ),
    },
    {
      key: 'profit',
      header: 'Profit',
      render: (row: AdminOrderRow) => {
        const profit = row.sellingPrice - row.cost
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

      <Card padding="none">
        <Table
          columns={columns}
          data={orders}
          keyField="orderNo"
          loading={isLoading}
          emptyMessage="No eSIM orders yet."
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
