import { formatMoney } from '@/lib/utils'

/** How a refund really ended, as VeloxVerse reports it after an admin cancel:
 *  refunded = Mint confirmed · pending = sent, not confirmed yet · failed = could NOT be made
 *  automatically (staff must refund by hand) · null = nothing was owed. */
export type RefundState = 'refunded' | 'pending' | 'failed' | null

export type RefundTone = 'success' | 'warning' | 'danger' | 'neutral'

export interface RefundOutcome {
  tone: RefundTone
  title: string
  message: string
}

/**
 * The message staff see after cancelling an eSIM order or a Pick & Drop booking. Driven by
 * `refundState` only — never by the HTTP 200 or a `refunded` flag — so "refunded" is shown only
 * when the money really went back. Returns `undefined` when VeloxVerse didn't send `refundState`
 * (older build): the caller then keeps its previous behaviour.
 *
 * @param amount  what was refunded, major units, in `currency` (the payment's currency)
 */
export function describeRefundOutcome(input: {
  refundState: RefundState | undefined
  amount: number | null | undefined
  currency: string | null | undefined
  /** The request changed nothing — it reports a refund made earlier (or that none is owed). */
  alreadyProcessed?: boolean
}): RefundOutcome | undefined {
  const { refundState } = input
  if (refundState === undefined) return undefined
  const money = formatMoney(input.amount ?? 0, input.currency)

  // Asked again for an order that was already dealt with: say what is true, not "error".
  // (A failed earlier refund still falls through to the red "refund manually" message below.)
  if (input.alreadyProcessed) {
    if (refundState === 'refunded') {
      return { tone: 'success', title: 'Already refunded', message: `Already refunded — ${money}. Nothing more was sent.` }
    }
    if (refundState === 'pending') {
      return {
        tone: 'warning',
        title: 'Refund already sent — not confirmed yet',
        message: `A refund of ${money} was already sent to the bank and is not confirmed yet. Nothing more was sent; look again later.`,
      }
    }
    if (refundState === null) {
      return { tone: 'neutral', title: 'Nothing to refund', message: 'Nothing to refund — no payment is owed back for this order.' }
    }
  }

  switch (refundState) {
    case 'refunded':
      return { tone: 'success', title: 'Cancelled — refunded', message: `Cancelled — ${money} refunded to the customer.` }
    case 'pending':
      return {
        tone: 'warning',
        title: 'Cancelled — refund not confirmed yet',
        message: `Cancelled — refund of ${money} sent to the bank, not confirmed yet. VeloxVerse keeps checking automatically; look again later.`,
      }
    case 'failed':
      return {
        tone: 'danger',
        title: 'Refund NOT made — refund manually',
        message:
          'Cancelled with the provider, but the refund could NOT be made automatically. Refund this customer manually in the Mint portal. Pressing Cancel again will not refund.',
      }
    default:
      return { tone: 'neutral', title: 'Cancelled', message: 'Cancelled — no refund was due.' }
  }
}
