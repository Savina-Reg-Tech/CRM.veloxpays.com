import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvUsersService } from '../vvAdminService'
import type { VVAdminUserDetail, VVUserRole } from '../types'

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
    onSuccess: (updated, { id }) => {
      // Refresh the open profile straight from the response (new status, isBlocked, blockedAt)
      // so the badge and button are right immediately; lists are refetched.
      qc.setQueryData<VVAdminUserDetail>(['vv-users', 'detail', id], (prev) =>
        prev ? { ...prev, user: { ...prev.user, ...updated } } : prev
      )
      qc.invalidateQueries({ queryKey: ['vv-users'] })
      // Blocking a referred user claws back the referrer's reward — refresh any open points
      // ledger (the referrer isn't known here, so refresh all points views).
      qc.invalidateQueries({ queryKey: ['vv-points'] })
    },
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
