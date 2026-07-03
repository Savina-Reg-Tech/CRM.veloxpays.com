import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Customer, CustomerServiceAssignment } from '@/types'
import { formatCustomerLegalName } from '../utils'

interface Props {
  open: boolean
  onClose: () => void
  customer: Customer | null
  onEdit: () => void
}

function assignmentVariant(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const s = status.toLowerCase()
  if (s === 'inactive' || s === 'cancelled' || s === 'suspended') return 'danger'
  if (s === 'pending') return 'warning'
  if (s === 'active' || s === 'verified') return 'success'
  return 'neutral'
}

function ServiceRow({ item }: { item: CustomerServiceAssignment }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {item.name}{' '}
            <span className="text-xs text-gray-400 font-normal">({item.code})</span>
          </p>
          <p className="text-xs text-gray-500">
            Enabled {formatDate(item.enabled_at)} · Source{' '}
            <span className="capitalize">{item.source.replace(/-/g, ' ')}</span>
          </p>
          {item.notes && (
            <p className="text-xs text-gray-600 mt-1 italic">“{item.notes}”</p>
          )}
        </div>
        <Badge variant={assignmentVariant(item.status)} dot>
          {item.status}
        </Badge>
      </div>
    </div>
  )
}

export default function CustomerDetailsModal({ open, onClose, customer, onEdit }: Props) {
  if (!customer) return null

  const legal = formatCustomerLegalName(customer)
  const services = customer.services ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customer details"
      description={`#${customer.id} · ${legal}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>Edit customer</Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500">Legal name</p>
            <p className="font-medium text-gray-900">{legal}</p>
          </div>
          <div>
            <p className="text-gray-500">Date of birth</p>
            <p className="font-medium text-gray-900">{formatDate(customer.dob)}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{customer.email}</p>
          </div>
          <div>
            <p className="text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{customer.phone ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-gray-500">Address</p>
            <p className="font-medium text-gray-900">
              {[customer.address_line1, customer.city, customer.country].filter(Boolean).join(', ') ||
                '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <Badge
              variant={
                ['inactive', 'archived'].includes(customer.status.toLowerCase())
                  ? 'danger'
                  : customer.status.toLowerCase() === 'pending'
                    ? 'warning'
                    : 'success'
              }
              dot
            >
              {customer.status}
            </Badge>
          </div>
          <div>
            <p className="text-gray-500">Record source</p>
            <p className="font-medium text-gray-900 capitalize">
              {customer.source.replace(/-/g, ' ')}
            </p>
            {customer.source_ref && (
              <p className="text-xs text-gray-500 mt-0.5">Ref: {customer.source_ref}</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Services</p>
            <p className="text-xs text-gray-500">{services.length} assigned</p>
          </div>
          {services.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              No services attached to this customer yet.
            </p>
          ) : (
            <div className="space-y-2">
              {services.map((item) => (
                <ServiceRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-gray-500">Added in CRM by</p>
          {customer.added_by_name ? (
            <>
              <p className="font-medium text-gray-900">
                {customer.added_by_name}{' '}
                <span className="text-gray-500 font-normal">
                  ({customer.added_by_role?.replace(/_/g, ' ')})
                </span>
              </p>
              <p className="text-gray-600 text-xs">{customer.added_by_email}</p>
            </>
          ) : (
            <p className="text-gray-600">System / sync (no CRM user)</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Created {formatDateTime(customer.created_at)} · Modified{' '}
            {formatDateTime(customer.modified_at)}
          </p>
        </div>
      </div>
    </Modal>
  )
}
