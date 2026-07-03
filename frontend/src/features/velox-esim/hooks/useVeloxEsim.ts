import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { veloxEsimApi, type ListVeloxEsimParams } from '../veloxEsimService'

export function useVeloxEsimHealth(enabled = true) {
  return useQuery({
    queryKey: ['velox-esim', 'health'],
    queryFn: () => veloxEsimApi.health(),
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function useVeloxEsimCustomers(
  params: ListVeloxEsimParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['velox-esim', 'customers', params],
    queryFn: () => veloxEsimApi.list(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: options?.enabled !== false,
  })
}

export function useVeloxEsimCustomer(id: string | null) {
  return useQuery({
    queryKey: ['velox-esim', 'customers', id],
    queryFn: () => veloxEsimApi.getById(id as string),
    enabled: !!id,
  })
}
