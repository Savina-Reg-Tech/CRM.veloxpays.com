import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvTransferService } from '../vvAdminService'

export function useVVTransferBookings(status?: string) {
  return useQuery({
    queryKey: ['vv-transfers', 'bookings', status ?? 'all'],
    queryFn: () => vvTransferService.getBookings(status),
    placeholderData: (prev) => prev,
  })
}

// Cancel reasons rarely change — cache them for the session instead of refetching on every
// cancel-modal open.
export function useVVTransferCancelReasons(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['vv-transfers', 'cancel-reasons'],
    queryFn: () => vvTransferService.getCancelReasons(),
    staleTime: 30 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

export function useVVCancelTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderNo, cancellationId }: { orderNo: string; cancellationId: number }) =>
      vvTransferService.cancelBooking(orderNo, cancellationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-transfers', 'bookings'] }),
  })
}
