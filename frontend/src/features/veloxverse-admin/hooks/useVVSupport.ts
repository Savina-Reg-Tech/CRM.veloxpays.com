import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvSupportService } from '../vvAdminService'
import type { VVAdminTicketFilters } from '../types'

export function useVVSupportTickets(filters: VVAdminTicketFilters = {}) {
  return useQuery({
    queryKey: ['vv-support', 'tickets', filters],
    queryFn: () => vvSupportService.list(filters),
  })
}

export function useVVSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['vv-support', 'ticket', id],
    queryFn: () => vvSupportService.get(id!),
    enabled: !!id,
  })
}

export function useVVSupportStats() {
  return useQuery({
    queryKey: ['vv-support', 'statistics'],
    queryFn: () => vvSupportService.getStatistics(),
  })
}

export function useVVSupportSearch(query: string) {
  return useQuery({
    queryKey: ['vv-support', 'search', query],
    queryFn: () => vvSupportService.search(query),
    enabled: query.trim().length > 0,
  })
}

export function useVVReplyTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      vvSupportService.reply(id, message),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-support'] }),
  })
}

export function useVVUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      vvSupportService.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-support'] }),
  })
}
