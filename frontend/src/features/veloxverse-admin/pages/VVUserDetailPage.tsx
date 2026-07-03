import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Wallet, Smartphone, ShoppingBag } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVUserDetail,
  useVVSetUserRole,
  useVVSetUserStatus,
} from '../hooks/useVVUsers'
import { formatUsd, formatDate, statusBadgeVariant } from '../utils'
import type { VVUserRole } from '../types'

const ROLES: VVUserRole[] = ['GUEST', 'USER', 'ADMIN', 'SUPER_ADMIN']

export default function VVUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useVVUserDetail(id)
  const setStatus = useVVSetUserStatus()
  const setRole = useVVSetUserRole()
  const { showToast } = useToast()

  const handleStatus = async (isActive: boolean) => {
    if (!data) return
    try {
      await setStatus.mutateAsync({ id: data.user.id, isActive })
      showToast({
        type: 'success',
        title: 'Status updated',
        message: `Account ${isActive ? 'activated' : 'deactivated'}.`,
      })
    } catch (e) {
      showToast({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'Failed to update status.',
      })
    }
  }

  const handleRole = async (role: VVUserRole) => {
    if (!data) return
    try {
      await setRole.mutateAsync({ id: data.user.id, role })
      showToast({
        type: 'success',
        title: 'Role updated',
        message: `Role set to ${role}.`,
      })
    } catch (e) {
      showToast({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'Failed to update role.',
      })
    }
  }

  return (
    <div className="max-w-full space-y-6">
      <Link
        to="/dashboard/veloxverse/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Loading user…" />
        </div>
      ) : !data ? (
        <Card>
          <p className="py-12 text-center text-sm text-gray-500">
            User not found.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {data.user.fullName || 'Guest User'}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Mail className="h-3.5 w-3.5" /> {data.user.email}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Joined {formatDate(data.user.createdAt)} ·{' '}
                  {data.user.isVerified ? 'Verified' : 'Unverified'}
                </p>
                {data.user.role === 'GUEST' && data.user.guestExpiresAt && (
                  <p className="mt-1 text-xs text-amber-600">
                    Guest expires {formatDate(data.user.guestExpiresAt)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {data.user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    checked={data.user.isActive}
                    disabled={setStatus.isPending}
                    onChange={handleStatus}
                  />
                </div>
                <select
                  value={data.user.role}
                  disabled={setRole.isPending}
                  onChange={(e) => handleRole(e.target.value as VVUserRole)}
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Wallet + counts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatUsd(data.wallet.balance)}
                  </p>
                  <p className="text-xs text-gray-500">Wallet balance</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {data.orders.length}
                  </p>
                  <p className="text-xs text-gray-500">Orders</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-fuchsia-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {data.devices.length}
                  </p>
                  <p className="text-xs text-gray-500">Devices</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Orders */}
          <Card padding="sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Orders</h2>
            {data.orders.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No orders.</p>
            ) : (
              <ul className="space-y-2">
                {data.orders.map((o) => (
                  <li
                    key={o.orderNo}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-gray-900">{o.packageName}</p>
                      <p className="font-mono text-xs text-gray-500">
                        {o.orderNo}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={statusBadgeVariant(o.status)}>
                        {o.status}
                      </Badge>
                      <span className="text-gray-500">
                        {formatUsd(o.sellingPrice)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Devices */}
          {data.devices.length > 0 && (
            <Card padding="sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Devices
              </h2>
              <ul className="space-y-2">
                {data.devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-gray-900">{d.name}</span>
                    <span className="text-xs text-gray-500">
                      {[d.brand, d.model].filter(Boolean).join(' ') ||
                        d.deviceType}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
