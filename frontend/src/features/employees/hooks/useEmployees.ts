import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { employeeService } from '../employeeService'

export interface UseEmployeesArgs {
  enabled?: boolean
  page?: number
  pageSize?: number
}

export function useEmployees({
  enabled = true,
  page = 1,
  pageSize = 20,
}: UseEmployeesArgs = {}) {
  return useQuery({
    queryKey: ['employees', { page, pageSize }],
    queryFn: () =>
      employeeService.getAll({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useEmployeeStats(enabled = true) {
  return useQuery({
    queryKey: ['employees', 'stats'],
    queryFn: employeeService.getStats,
    enabled,
    staleTime: 30_000,
  })
}
