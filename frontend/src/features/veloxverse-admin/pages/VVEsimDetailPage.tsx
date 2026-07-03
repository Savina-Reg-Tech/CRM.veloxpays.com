import type { ElementType } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  QrCode,
  Ban,
  Pause,
  Play,
  Signal,
  Clock,
  Database,
  CreditCard,
  User,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVEsimDetail,
  useVVCancelEsim,
  useVVSuspendEsim,
  useVVUnsuspendEsim,
} from '../hooks/useVVEsim'
import { formatUsd, formatDateTime, statusBadgeVariant } from '../utils'

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: (label: string, value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate font-mono text-sm text-gray-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(label, value)}
        className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType
  label: string
  value: string | number | null | undefined
}) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900">{String(value)}</p>
      </div>
    </div>
  )
}

export default function VVEsimDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: order, isLoading } = useVVEsimDetail(orderNo)
  const cancelMutation = useVVCancelEsim()
  const suspendMutation = useVVSuspendEsim()
  const unsuspendMutation = useVVUnsuspendEsim()

  const copyToClipboard = (label: string, value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => showToast({ type: 'success', title: `${label} copied` }))
  }

  const handleSuspend = async () => {
    if (!order) return
    try {
      await suspendMutation.mutateAsync(order.orderNo)
      showToast({ type: 'success', title: 'eSIM suspended' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to suspend eSIM',
      })
    }
  }

  const handleUnsuspend = async () => {
    if (!order) return
    try {
      await unsuspendMutation.mutateAsync(order.orderNo)
      showToast({ type: 'success', title: 'eSIM unsuspended' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to unsuspend eSIM',
      })
    }
  }

  const handleCancel = async () => {
    if (!order) return
    if (!confirm('Cancel this eSIM? The user will be auto-refunded.')) return
    try {
      await cancelMutation.mutateAsync(order.orderNo)
      showToast({ type: 'success', title: 'eSIM cancelled & refunded' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to cancel eSIM',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-full space-y-6">
        <button
          type="button"
          onClick={() => navigate('/dashboard/veloxverse/esim-orders')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </button>
        <p className="text-sm text-gray-500">eSIM order not found.</p>
      </div>
    )
  }

  const qrIsImage = !!order.qrCodeUrl && /^https?:\/\//i.test(order.qrCodeUrl)
  const isSuspended =
    order.esimStatus?.toUpperCase() === 'SUSPEND' ||
    order.smdpStatus?.toUpperCase() === 'SUSPENDED'
  const isTerminal =
    order.status === 'CANCELLED' ||
    order.status === 'EXPIRED' ||
    order.status === 'FAILED'
  const profit = order.sellingPrice - order.cost
  const title = order.coverages[0]?.packageName ?? `Order ${order.orderNo}`

  return (
    <div className="max-w-full space-y-6">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/dashboard/veloxverse/esim-orders')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
          {order.esimStatus && (
            <Badge variant="neutral">{order.esimStatus}</Badge>
          )}
        </div>
        <p className="font-mono text-sm text-gray-500">Order #{order.orderNo}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: QR + IDs */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="QR Code" />
            <div className="flex flex-col items-center gap-3">
              {qrIsImage ? (
                <img
                  src={order.qrCodeUrl}
                  alt="eSIM QR code"
                  className="h-48 w-48 rounded-lg border border-gray-200 bg-white p-2"
                />
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 text-gray-400">
                  <QrCode className="h-10 w-10" />
                  <span className="px-2 text-center text-xs">
                    {order.status === 'PENDING' ? 'Provisioning...' : 'QR unavailable'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Identifiers" />
            <div className="space-y-2">
              {order.iccid && (
                <CopyRow label="ICCID" value={order.iccid} onCopy={copyToClipboard} />
              )}
              {order.imsi && (
                <CopyRow label="IMSI" value={order.imsi} onCopy={copyToClipboard} />
              )}
              {order.eid && (
                <CopyRow label="EID" value={order.eid} onCopy={copyToClipboard} />
              )}
              {order.msisdn && (
                <CopyRow label="MSISDN" value={order.msisdn} onCopy={copyToClipboard} />
              )}
              {order.activationCode && (
                <CopyRow
                  label="Activation Code"
                  value={order.activationCode}
                  onCopy={copyToClipboard}
                />
              )}
              {order.esimTranNo && (
                <CopyRow
                  label="eSIM Trans No"
                  value={order.esimTranNo}
                  onCopy={copyToClipboard}
                />
              )}
              {order.providerOrderNo && (
                <CopyRow
                  label="Provider Order"
                  value={order.providerOrderNo}
                  onCopy={copyToClipboard}
                />
              )}
              {order.invoiceNo && (
                <CopyRow
                  label="Invoice No"
                  value={order.invoiceNo}
                  onCopy={copyToClipboard}
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="eSIM Install Information" />
            <div className="space-y-2">
              {order.shortUrl && (
                <CopyRow label="Install Link" value={order.shortUrl} onCopy={copyToClipboard} />
              )}
              {order.apn && (
                <CopyRow label="APN" value={order.apn} onCopy={copyToClipboard} />
              )}
              {order.pin && (
                <CopyRow label="PIN" value={order.pin} onCopy={copyToClipboard} />
              )}
              {!order.shortUrl && !order.apn && !order.pin && (
                <p className="text-sm text-gray-500">
                  Install information not yet available.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: details + actions */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Data Plan" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailRow
                icon={Database}
                label="Total Volume"
                value={order.totalVolume != null ? formatBytes(order.totalVolume) : null}
              />
              <DetailRow
                icon={Database}
                label="Remaining"
                value={order.remainingVolume != null ? formatBytes(order.remainingVolume) : null}
              />
              <DetailRow
                icon={Clock}
                label="Duration"
                value={order.duration != null ? `${order.duration} days` : null}
              />
              <DetailRow icon={Signal} label="SMDP Status" value={order.smdpStatus} />
              <DetailRow icon={Signal} label="eSIM Status" value={order.esimStatus} />
              <DetailRow icon={Signal} label="SMS" value={order.smsStatus} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <DetailRow
                icon={Clock}
                label="Activated"
                value={order.activatedAt ? formatDateTime(order.activatedAt) : null}
              />
              <DetailRow
                icon={Clock}
                label="Expires"
                value={order.expiredAt ? formatDateTime(order.expiredAt) : null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow icon={User} label="Name" value={order.customer.name} />
              <DetailRow icon={User} label="Email" value={order.customer.email} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DetailRow icon={CreditCard} label="Cost" value={formatUsd(order.cost)} />
              <DetailRow
                icon={CreditCard}
                label="Selling Price"
                value={formatUsd(order.sellingPrice)}
              />
              <DetailRow icon={CreditCard} label="Profit" value={formatUsd(profit)} />
              <DetailRow icon={CreditCard} label="Payment" value={order.paymentMethod} />
            </div>
          </Card>

          {order.coverages && order.coverages.length > 0 && (
            <Card padding="none">
              <div className="p-6 pb-0">
                <CardHeader title="Coverage" className="mb-4" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Package Code</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Location</th>
                      <th className="px-4 py-2 font-medium">Volume</th>
                      <th className="px-4 py-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.coverages.map((pkg, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">
                          {pkg.packageCode || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{pkg.packageName || '—'}</td>
                        <td className="px-4 py-2 text-gray-700">{pkg.locationCode || '—'}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {pkg.volume != null ? formatBytes(pkg.volume) : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {pkg.duration != null ? `${pkg.duration} days` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!isTerminal && (
            <Card>
              <CardHeader title="Actions" />
              <div className="flex flex-wrap gap-3">
                {isSuspended ? (
                  <Button
                    variant="outline"
                    onClick={handleUnsuspend}
                    loading={unsuspendMutation.isPending}
                  >
                    <Play className="h-4 w-4" />
                    Unsuspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleSuspend}
                    loading={suspendMutation.isPending}
                  >
                    <Pause className="h-4 w-4" />
                    Suspend
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  loading={cancelMutation.isPending}
                >
                  <Ban className="h-4 w-4" />
                  Cancel & Refund
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
