import { useQuery } from '@tanstack/react-query'
import { vvTransferService } from '../vvAdminService'

export function useVVTransferBookings(status?: string) {
  return useQuery({
    queryKey: ['vv-transfers', 'bookings', status ?? 'all'],
    queryFn: () => vvTransferService.getBookings(status),
  })
}
