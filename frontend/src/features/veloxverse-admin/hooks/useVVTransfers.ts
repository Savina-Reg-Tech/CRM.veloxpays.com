import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type TransferBookingFilters, vvTransferService } from '../vvAdminService'

export function useVVTransferBookings(filters: TransferBookingFilters = {}) {
  return useQuery({
    queryKey: ['vv-transfers', 'bookings', filters.status ?? '', filters.search ?? '', filters.from ?? '', filters.to ?? ''],
    queryFn: () => vvTransferService.getBookings(filters),
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
    mutationFn: ({
      orderNo,
      cancellationId,
      confirmNoRideAtSupplier,
    }: {
      orderNo: string
      cancellationId: number
      confirmNoRideAtSupplier?: boolean
    }) => vvTransferService.cancelBooking(orderNo, cancellationId, { confirmNoRideAtSupplier }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-transfers', 'bookings'] }),
  })
}

export function useVVLinkTransferReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderNo, reservationNo }: { orderNo: string; reservationNo: string }) =>
      vvTransferService.linkReservation(orderNo, reservationNo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-transfers', 'bookings'] }),
  })
}
