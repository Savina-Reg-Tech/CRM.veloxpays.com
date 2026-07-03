import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { customerService, serviceCatalogClient } from '../customerService'
import { useToast } from '@/app/providers/ToastProvider'
import type { CustomerPayload } from '@/types'
import { formatCustomerLegalName } from '../utils'

export interface UseCustomersArgs {
  page?: number
  pageSize?: number
}

export function useCustomers({ page = 1, pageSize = 20 }: UseCustomersArgs = {}) {
  return useQuery({
    queryKey: ['customers', { page, pageSize }],
    queryFn: () =>
      customerService.getAll({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useCustomerDetails(customerId: number | null) {
  return useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => customerService.getById(customerId as number),
    enabled: !!customerId,
  })
}

export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service-catalog'],
    queryFn: serviceCatalogClient.list,
    staleTime: 5 * 60_000,
  })
}

export function useCreateCustomer(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: (payload: CustomerPayload) => customerService.create(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      showToast({
        type: 'success',
        title: 'Customer created',
        message: `${formatCustomerLegalName(created)} was added successfully.`,
      })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create customer.'
      showToast({ type: 'error', title: 'Create failed', message })
    },
  })
}

export function useDeleteCustomer(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: (id: number) => customerService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      showToast({
        type: 'success',
        title: 'Customer deleted',
        message: 'The customer record was removed.',
      })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete customer.'
      showToast({ type: 'error', title: 'Delete failed', message })
    },
  })
}

export function useUpdateCustomer(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerPayload }) =>
      customerService.update(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers', updated.id] })
      showToast({
        type: 'success',
        title: 'Customer updated',
        message: `${formatCustomerLegalName(updated)} details were saved.`,
      })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update customer.'
      showToast({ type: 'error', title: 'Update failed', message })
    },
  })
}
