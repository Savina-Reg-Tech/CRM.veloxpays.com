import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('@/lib/axios', () => ({ default: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }))

import { vvTransferService } from './vvAdminService'
import { apiErrorMessage, TRANSFER_UNCONFIRMED_NOTICE } from './utils'

beforeEach(() => post.mockReset())

describe('Pick & Drop admin cancel', () => {
  it('the plain Cancel never claims the ViaTovia panel was checked', async () => {
    post.mockResolvedValue({ data: { data: { orderNo: 'TRF-1', refundedCents: 0 } } })
    await vvTransferService.cancelBooking('TRF-1', 3)
    expect(post).toHaveBeenCalledWith('/vv-admin/admin/assist/transfer/bookings/TRF-1/cancel', { cancellationId: 3 })
    await vvTransferService.cancelBooking('TRF-1', 3, { confirmNoRideAtSupplier: false })
    expect(post.mock.calls[1][1]).toEqual({ cancellationId: 3 })
  })

  it('"No ride at ViaTovia — cancel & refund" sends the confirmation', async () => {
    post.mockResolvedValue({ data: { data: { orderNo: 'TRF-1', refundedCents: 5744, refundState: 'refunded' } } })
    const result = await vvTransferService.cancelBooking('TRF-1', 3, { confirmNoRideAtSupplier: true })
    expect(post).toHaveBeenCalledWith('/vv-admin/admin/assist/transfer/bookings/TRF-1/cancel', {
      cancellationId: 3,
      confirmNoRideAtSupplier: true,
    })
    expect(result.refundState).toBe('refunded')
  })
})

describe('Pick & Drop link reservation', () => {
  it('posts the reservation number and returns the updated booking', async () => {
    post.mockResolvedValue({ data: { data: { orderNo: 'TRF 1', reservationNo: 'ViaToVia-2026-000999', confirmationUnknown: false } } })
    const booking = await vvTransferService.linkReservation('TRF 1', 'ViaToVia-2026-000999')
    expect(post).toHaveBeenCalledWith('/vv-admin/admin/assist/transfer/bookings/TRF%201/link-reservation', {
      reservationNo: 'ViaToVia-2026-000999',
    })
    expect(booking.reservationNo).toBe('ViaToVia-2026-000999')
  })
})

describe('apiErrorMessage', () => {
  it("shows VeloxVerse's own message as-is", () => {
    const err = { message: 'Request failed with status code 400', response: { status: 400, data: { message: 'The transport provider has no booking with that reservation number.' } } }
    expect(apiErrorMessage(err, 'fallback')).toBe('The transport provider has no booking with that reservation number.')
  })
  it('falls back when there is no server message', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'Could not link')).toBe('Could not link')
    expect(apiErrorMessage({ response: { data: { message: '  ' } } }, 'x')).toBe('x')
  })
  it('uses the banner wording from the prompt', () => {
    expect(TRANSFER_UNCONFIRMED_NOTICE).toBe('Paid — not confirmed by the transport provider. Check the ViaTovia panel.')
  })
})
