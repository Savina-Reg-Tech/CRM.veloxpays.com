import { useState, type ElementType } from 'react'
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
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVEsimDetail,
  useVVCancelEsim,
  useVVSuspendEsim,
  useVVUnsuspendEsim,
} from '../hooks/useVVEsim'
import { useVVUserDetail } from '../hooks/useVVUsers'
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
  // The eSIM order endpoint only returns `userId`, not a `customer` object — fetch the
  // real name/email via the already-bridged admin users endpoint (same one VVUserDetailPage
  // uses) rather than assuming a field the backend never sends.
  const { data: customerDetail } = useVVUserDetail(order?.userId)
  const cancelMutation = useVVCancelEsim()
  const suspendMutation = useVVSuspendEsim()
  const unsuspendMutation = useVVUnsuspendEsim()

  const customerName = customerDetail?.user.fullName
    || [customerDetail?.user.firstName, customerDetail?.user.lastName].filter(Boolean).join(' ')
    || customerDetail?.user.email
    || (order?.userId ? `User ${order.userId}` : undefined)
  const customerEmail = customerDetail?.user.email

  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

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
    } finally {
      setShowSuspendModal(false)
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

  // Single entry point for both "staff cancels on a customer's behalf" and
  // "customer requests cancellation" — there's no separate customer login
  // in this CRM (see roles.ts: only staff roles exist), so this action,
  // scoped to the specific order/customer shown on this page, IS the
  // customer-facing cancellation flow. The backend's cancel endpoint
  // already applies its own state-aware cancel-vs-revoke + refund logic;
  // the CRM just calls the one documented action either way. Confirmation
  // happens via the Modal below (see showCancelModal), not a native confirm().
  const handleCancel = async () => {
    if (!order) return
    const who = customerName || 'this customer'
    try {
      await cancelMutation.mutateAsync(order.orderNo)
      showToast({ type: 'success', title: 'Cancellation processed', message: `${who}'s eSIM has been cancelled.` })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to cancel eSIM',
      })
    } finally {
      setShowCancelModal(false)
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
    order.status === 'FAILED' ||
    order.status === 'REVOKED'
  const profit = order.profitUsd ?? (order.sellingPriceUsd ?? 0) - (order.costUsd ?? 0)
  const title = order.packageName ?? order.packages?.[0]?.name ?? `Order ${order.orderNo}`

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
                value={order.remainingVolumeGB != null ? `${order.remainingVolumeGB.toFixed(2)} GB` : null}
              />
              <DetailRow
                icon={Clock}
                label="Duration"
                value={order.totalDuration != null ? `${order.totalDuration} ${order.durationUnit ?? 'days'}` : null}
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
                value={order.profileExpiresAt ? formatDateTime(order.profileExpiresAt) : null}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow icon={User} label="Name" value={customerName} />
              <DetailRow icon={User} label="Email" value={customerEmail} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Pricing" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DetailRow icon={CreditCard} label="Cost" value={formatUsd(order.costUsd ?? 0)} />
              <DetailRow
                icon={CreditCard}
                label="Selling Price"
                value={formatUsd(order.sellingPriceUsd ?? 0)}
              />
              <DetailRow icon={CreditCard} label="Profit" value={formatUsd(profit)} />
              <DetailRow icon={CreditCard} label="Payment" value={order.paymentMethod} />
            </div>
          </Card>

          {order.packages && order.packages.length > 0 && (
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
                    {order.packages.map((pkg, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">
                          {pkg.code || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{pkg.name || '—'}</td>
                        <td className="px-4 py-2 text-gray-700">{pkg.location || '—'}</td>
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
                    onClick={() => setShowSuspendModal(true)}
                    loading={suspendMutation.isPending}
                  >
                    <Pause className="h-4 w-4" />
                    Suspend
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => setShowCancelModal(true)}
                  loading={cancelMutation.isPending}
                >
                  <Ban className="h-4 w-4" />
                  Request cancellation
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend eSIM"
        description={`Order #${order.orderNo}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSuspendModal(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSuspend}
              loading={suspendMutation.isPending}
            >
              <Pause className="h-4 w-4" />
              Suspend eSIM
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This pauses data service immediately for{' '}
          <span className="font-medium text-gray-900">{customerName ?? 'this customer'}</span>.
          They'll lose connectivity until it's unsuspended. This does not cancel the order or
          affect billing, and can be reversed at any time from this page.
        </p>
      </Modal>

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Request Cancellation"
        description={`Order #${order.orderNo}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep eSIM
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              loading={cancelMutation.isPending}
            >
              <Ban className="h-4 w-4" />
              Confirm cancellation
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This will cancel the eSIM for{' '}
          <span className="font-medium text-gray-900">{customerName ?? 'this customer'}</span>.
          If it hasn't been activated yet, it's processed as a full refund; if it's already in
          use, it will be revoked instead and the customer refunded from their wallet. This
          action can't be undone.
        </p>
      </Modal>
    </div>
  )
}
