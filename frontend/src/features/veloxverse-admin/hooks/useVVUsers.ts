import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvUsersService } from '../vvAdminService'
import type { VVUserRole } from '../types'

export function useVVUsers(
  page = 1,
  search?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['vv-users', 'list', page, search ?? ''],
    queryFn: () => vvUsersService.list(page, search),
    enabled: options?.enabled ?? true,
  })
}

export function useVVUserDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-users', 'detail', id],
    queryFn: () => vvUsersService.get(id!),
    enabled: !!id,
  })
}

export function useVVSetUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      vvUsersService.setStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-users'] }),
  })
}

export function useVVSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: VVUserRole }) =>
      vvUsersService.setRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-users'] }),
  })
}
