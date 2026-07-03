import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerPayload,
  type CustomerServiceAssignmentInput,
  type CustomerSource,
  type ServiceCode,
} from '@/types'
import { useCreateCustomer, useServiceCatalog, useUpdateCustomer } from '../hooks/useCustomers'
import { useAuthStore } from '@/store/authStore'

const sourceEnum = z.enum(CUSTOMER_SOURCES)
const statusEnum = z.enum(CUSTOMER_STATUSES)

const schema = z
  .object({
    first_name: z.string().min(1, 'First name is required').max(100),
    middle_name: z.string().max(100).optional(),
    last_name: z.string().min(1, 'Last name is required').max(100),
    dob: z.string().optional(),
    email: z.string().email('Enter a valid email'),
    phone: z.string().max(40).optional(),
    address_line1: z.string().max(255).optional(),
    city: z.string().max(120).optional(),
    country: z.string().max(100).optional(),
    status: statusEnum,
    source: sourceEnum,
    source_ref: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'veloxpays-sync' && !String(data.source_ref ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_ref'],
        message: 'Source reference is required when source is VeloxPays sync',
      })
    }
  })

type FormValues = z.infer<typeof schema>

const STATUS_OPTIONS = ['active', 'inactive', 'pending', 'suspended'] as const

type ServiceRowState = {
  enabled: boolean
  status: string
  notes: string
}

function emptyToNull(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  return t === '' ? null : t
}

function toPayload(values: FormValues, services: CustomerServiceAssignmentInput[]): CustomerPayload {
  return {
    first_name: values.first_name.trim(),
    middle_name: emptyToNull(values.middle_name),
    last_name: values.last_name.trim(),
    dob: emptyToNull(values.dob) ?? null,
    email: values.email.trim(),
    phone: emptyToNull(values.phone),
    address_line1: emptyToNull(values.address_line1),
    city: emptyToNull(values.city),
    country: emptyToNull(values.country),
    status: values.status,
    source: values.source as CustomerSource,
    source_ref: emptyToNull(values.source_ref),
    services,
  }
}

interface Props {
  open: boolean
  onClose: () => void
  customer?: Customer | null
}

const defaultForm: FormValues = {
  first_name: '',
  middle_name: '',
  last_name: '',
  dob: '',
  email: '',
  phone: '',
  address_line1: '',
  city: '',
  country: '',
  status: 'active',
  source: 'manual',
  source_ref: '',
}

export default function CustomerFormModal({ open, onClose, customer }: Props) {
  const createMutation = useCreateCustomer(onClose)
  const updateMutation = useUpdateCustomer(onClose)
  const isEditing = !!customer
  const role = useAuthStore((s) => s.user?.role)
  const canSetSyncSource = useMemo(
    () => ['super_admin', 'admin', 'employee'].includes(role ?? ''),
    [role]
  )

  const { data: catalog = [], isLoading: catalogLoading } = useServiceCatalog()

  const [services, setServices] = useState<Record<string, ServiceRowState>>({})

  const {
    register,
    watch,
    reset,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultForm,
  })

  const source = watch('source')

  useEffect(() => {
    if (!open) return
    if (!customer) {
      reset({ ...defaultForm, status: 'active', source: 'manual' })
      setServices({})
      return
    }

    const persistedStatus = (CUSTOMER_STATUSES as readonly string[]).includes(
      customer.status
    )
      ? (customer.status as (typeof CUSTOMER_STATUSES)[number])
      : 'active'

    reset({
      first_name: customer.first_name,
      middle_name: customer.middle_name ?? '',
      last_name: customer.last_name,
      dob: customer.dob ? customer.dob.slice(0, 10) : '',
      email: customer.email,
      phone: customer.phone ?? '',
      address_line1: customer.address_line1 ?? '',
      city: customer.city ?? '',
      country: customer.country ?? '',
      status: persistedStatus,
      source: customer.source,
      source_ref: customer.source_ref ?? '',
    })

    const initial: Record<string, ServiceRowState> = {}
    for (const item of customer.services ?? []) {
      initial[item.code] = {
        enabled: true,
        status: item.status,
        notes: item.notes ?? '',
      }
    }
    setServices(initial)
  }, [customer, open, reset])

  useEffect(() => {
    if (!open || canSetSyncSource) return
    setValue('source', 'manual', { shouldValidate: true })
  }, [open, canSetSyncSource, setValue])

  const updateService = (code: ServiceCode, patch: Partial<ServiceRowState>) => {
    setServices((prev) => {
      const current = prev[code] ?? { enabled: false, status: 'active', notes: '' }
      return { ...prev, [code]: { ...current, ...patch } }
    })
  }

  const onSubmit = handleSubmit(async (data) => {
    const assignments: CustomerServiceAssignmentInput[] = catalog
      .filter((service) => services[service.code]?.enabled)
      .map((service) => {
        const row = services[service.code]
        return {
          code: service.code,
          status: row?.status?.trim() || 'active',
          notes: row?.notes?.trim() ? row.notes.trim() : null,
        }
      })

    const payload = toPayload(data, assignments)
    if (customer) {
      await updateMutation.mutateAsync({ id: customer.id, payload })
      return
    }
    await createMutation.mutateAsync({ ...payload, source: 'manual' })
  })

  const mutationLoading = createMutation.isPending || updateMutation.isPending || isSubmitting

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Customer' : 'Add Customer'}
      description="End-customer personal details with normalized service assignments."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutationLoading}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={mutationLoading}>
            {isEditing ? 'Save Changes' : 'Create Customer'}
          </Button>
        </>
      }
    >
      <form
        id="customer-form"
        onSubmit={onSubmit}
        className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="First name"
            placeholder="Jane"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Input
            label="Middle name"
            placeholder="Optional"
            error={errors.middle_name?.message}
            {...register('middle_name')}
          />
          <Input
            label="Last name"
            placeholder="Doe"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1.5">
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              {...register('dob')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
            />
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="jane@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <Input label="Phone" placeholder="+1 …" error={errors.phone?.message} {...register('phone')} />

        <Input
          label="Address line 1"
          placeholder="Street, building, unit"
          error={errors.address_line1?.message}
          {...register('address_line1')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="City" placeholder="City" error={errors.city?.message} {...register('city')} />
          <Input label="Country" placeholder="Country" error={errors.country?.message} {...register('country')} />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">
            Status
          </label>
          <select
            id="status"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 capitalize focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
            {...register('status')}
          >
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.status?.message && (
            <p className="mt-1.5 text-xs text-red-500">{errors.status.message}</p>
          )}
        </div>

        {isEditing && canSetSyncSource && (
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1.5">
              Record source
            </label>
            <select
              id="source"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              {...register('source')}
            >
              <option value="manual">Manual (CRM)</option>
              <option value="veloxpays-sync">VeloxPays sync</option>
            </select>
            {errors.source?.message && (
              <p className="mt-1.5 text-xs text-red-500">{errors.source.message}</p>
            )}
          </div>
        )}

        {isEditing && canSetSyncSource && source === 'veloxpays-sync' && (
          <Input
            label="Source reference"
            placeholder="External ID from VeloxPays"
            error={errors.source_ref?.message}
            {...register('source_ref')}
          />
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Services</p>
            <p className="text-xs text-gray-500">Toggle, set status and add notes per service.</p>
          </div>

          {catalogLoading ? (
            <p className="text-sm text-gray-500">Loading catalog…</p>
          ) : catalog.length === 0 ? (
            <p className="text-sm text-gray-500">No services available in the catalog.</p>
          ) : (
            <div className="space-y-2">
              {catalog.map((service) => {
                const row = services[service.code] ?? {
                  enabled: false,
                  status: 'active',
                  notes: '',
                }
                return (
                  <div
                    key={service.code}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700 min-w-[180px]">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) =>
                            updateService(service.code, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-gray-900">{service.name}</span>
                        <span className="text-xs text-gray-400">({service.code})</span>
                      </label>

                      <div className="flex-1 min-w-[160px]">
                        <select
                          disabled={!row.enabled}
                          value={row.status}
                          onChange={(e) =>
                            updateService(service.code, { status: e.target.value })
                          }
                          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1 min-w-[200px]">
                        <input
                          disabled={!row.enabled}
                          value={row.notes}
                          onChange={(e) =>
                            updateService(service.code, { notes: e.target.value })
                          }
                          placeholder="Notes (optional)"
                          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
