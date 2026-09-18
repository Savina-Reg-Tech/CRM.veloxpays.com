import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils'
import type { VeloxEsimCustomer, VeloxEsimPurchase } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  customer: VeloxEsimCustomer | null
  isLoading?: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  ESIM_ORDER: 'eSIM',
  ESIM_TOPUP: 'eSIM Top-up',
  LOUNGE_VISIT: 'Lounge / Benefit',
  TRANSFER: 'Pick & Drop',
  CLUB_MEMBERSHIP: 'VeloxClub',
  FLIGHT_BOOKING: 'Flight',
}

/** Title-cases an unmapped resourceType (e.g. a future module) rather than showing it raw. */
function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Purchase'
  if (CATEGORY_LABEL[category]) return CATEGORY_LABEL[category]
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function planLabel(p: VeloxEsimPurchase) {
  return p.planName ?? p.planCode ?? 'Purchase'
}

export default function VeloxEsimCustomerDetailModal({
  open,
  onClose,
  customer,
  isLoading,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? customer.name : 'eSIM customer'}
      description={customer ? customer.email : undefined}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading || !customer ? (
        <p className="text-sm text-gray-500 py-6">Loading customer…</p>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{customer.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Country</p>
              <p className="font-medium text-gray-900">
                {customer.country ?? '—'}
                {customer.countryCode && (
                  <span className="text-gray-500 font-normal"> ({customer.countryCode})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Account status</p>
              <Badge variant={customer.isActive ? 'success' : 'danger'} dot>
                {customer.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Registered</p>
              <p className="font-medium text-gray-900">{formatDate(customer.registeredAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total orders</p>
              <p className="font-medium text-gray-900">{customer.totalOrders}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total spent</p>
              <p className="font-medium text-gray-900">
                {formatMoney(customer.totalSpent, customer.totalSpentCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Preferred currency</p>
              <p className="font-medium text-gray-900">{customer.preferredCurrency ?? 'USD'}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Purchases ({customer.purchases.length})
            </p>
            {customer.purchases.length === 0 ? (
              <p className="text-gray-500 text-sm">No purchases yet.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {customer.purchases.map((p) => (
                  <li
                    key={p.orderId ?? p.orderNo ?? Math.random()}
                    className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="neutral">{categoryLabel(p.category)}</Badge>
                          <p className="font-medium text-gray-900">{planLabel(p)}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.orderNo ?? p.orderId} · {formatDateTime(p.purchasedAt)}
                        </p>
                        {p.planType && (
                          <p className="text-xs text-gray-500 capitalize">
                            {p.planType.toLowerCase().replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatMoney(p.amountPaid, p.currency)}
                        </p>
                        <Badge variant="neutral" className="mt-1">
                          {p.status ?? '—'}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
