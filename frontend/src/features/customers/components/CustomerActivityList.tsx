import type { ComponentType } from 'react'
import { Smartphone, Car, Headphones, HandHelping, Crown } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { formatUsd, statusBadgeVariant } from '@/features/veloxverse-admin/utils'
import type { CustomerActivityItem } from '../utils/veloxverseActivity'

const KIND_ICON: Record<CustomerActivityItem['kind'], ComponentType<{ className?: string }>> = {
  ESIM: Smartphone,
  TRANSFER: Car,
  SUPPORT: Headphones,
  FORM: HandHelping,
  CLUB: Crown,
}

function ActivityRow({ item }: { item: CustomerActivityItem }) {
  const Icon = KIND_ICON[item.kind]
  return (
    <li className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
          {item.isPending && !item.isCancelled && (
            <Badge variant="warning">Action needed</Badge>
          )}
        </div>
        {item.subtitle && <p className="text-xs text-gray-500">{item.subtitle}</p>}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">{item.kind}</p>
      </div>
      {item.amountUsd != null && (
        <span className="shrink-0 text-sm font-medium text-gray-900">
          {formatUsd(item.amountUsd)}
        </span>
      )}
    </li>
  )
}

/** Unified, time-sorted "everything this customer has done" feed — every VeloxVerse eSIM
 * order, transfer booking, lounge membership, support ticket, and CRM form request (e.g.
 * Meet & Greet) tied to the customer, in one list with one consistent look.
 *
 * Used on the VeloxVerse customer "360" page (VVUserDetailPage) — the destination the
 * Customers page now navigates to for VeloxVerse rows — so this stays the single source of
 * truth for "everything this customer has done" instead of a separately-maintained list. */
export function CustomerActivityList({
  items,
  emptyMessage = 'No orders, bookings, or tickets yet.',
}: {
  items: CustomerActivityItem[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-gray-500">{emptyMessage}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  )
}
