import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describeRefundOutcome } from './refundOutcome'
import RefundOutcomeNotice from './components/RefundOutcomeNotice'
import { REFUND_ATTENTION_STEPS, stepLabel } from './audit'

const plain = (s: string) => s.replace(/ /g, ' ')

describe('describeRefundOutcome', () => {
  it('says refunded, with the amount, only when Mint confirmed it', () => {
    const o = describeRefundOutcome({ refundState: 'refunded', amount: 57.44, currency: 'INR' })!
    expect(o.tone).toBe('success')
    expect(plain(o.message)).toBe('Cancelled — INR 57.44 refunded to the customer.')
  })

  it('says not confirmed yet while pending', () => {
    const o = describeRefundOutcome({ refundState: 'pending', amount: 57.44, currency: 'INR' })!
    expect(o.tone).toBe('warning')
    expect(plain(o.message)).toContain('refund of INR 57.44 sent to the bank, not confirmed yet')
    expect(`${o.title} ${o.message}`).not.toMatch(/refunded to the customer/i)
  })

  it('a failed refund is a "refund manually" action item and never reads as refunded', () => {
    const o = describeRefundOutcome({ refundState: 'failed', amount: 0, currency: 'INR' })!
    expect(o.tone).toBe('danger')
    expect(o.message).toContain('Refund this customer manually in the Mint portal')
    expect(o.message).toContain('could NOT be made automatically')
    expect(`${o.title} ${o.message}`).not.toMatch(/\brefunded\b/i)
    expect(`${o.title} ${o.message}`).not.toMatch(/INR|0\.00/)
  })

  it('null means nothing was owed — neutral, not a failure', () => {
    const o = describeRefundOutcome({ refundState: null, amount: 0, currency: 'INR' })!
    expect(o.tone).toBe('neutral')
    expect(o.message).toBe('Cancelled — no refund was due.')
  })

  it('returns nothing for an older VeloxVerse response without refundState', () => {
    expect(describeRefundOutcome({ refundState: undefined, amount: 10, currency: 'USD' })).toBeUndefined()
  })
})

describe('RefundOutcomeNotice', () => {
  it('shows a failed refund as an alert that stays until dismissed', async () => {
    const onDismiss = vi.fn()
    render(
      <RefundOutcomeNotice
        outcome={describeRefundOutcome({ refundState: 'failed', amount: 0, currency: 'INR' })!}
        subject="Jane · TRF-1"
        onDismiss={onDismiss}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Refund this customer manually in the Mint portal')
    expect(screen.getByText('Jane · TRF-1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe('audit step labels', () => {
  it.each([
    ['late_approval_refunded', 'Charged after checkout closed — refunded'],
    ['card_brand_not_accepted', 'Card type not accepted — refunded'],
    ['promo_no_longer_valid', 'Promo already used — not charged'],
    ['charge_amount_changed', 'Exchange rate updated — not charged'],
    ['charge_fx_unavailable', 'No exchange rate — checkout not offered'],
    ['esim_supplier_outcome_unknown', 'eSIM Access did not answer — checking'],
    ['esim_supplier_outcome_recovered', 'eSIM order found at eSIM Access — completed'],
  ])('%s → %s', (step, label) => {
    expect(stepLabel(step)).toBe(label)
  })

  it('still humanises any other step', () => {
    expect(stepLabel('refund_failed')).toBe('Refund failed')
    expect(stepLabel(null)).toBe('—')
  })

  it('the attention filter covers the steps a person must check', () => {
    expect([...REFUND_ATTENTION_STEPS]).toEqual(['refund_failed', 'late_approval_refunded', 'payment_amount_mismatch'])
  })
})

describe('payment status RECONCILING', () => {
  it('reads as "Needs review — refund manually" in red, never as processing', async () => {
    const { paymentStatusLabel, paymentStatusVariant, paymentNeedsReview } = await import('./loungeUtils')
    const { statusBadgeVariant } = await import('./utils')
    for (const s of ['RECONCILING', 'reconciling']) {
      expect(paymentStatusLabel(s)).toBe('Needs review — refund manually')
      expect(paymentStatusVariant(s)).toBe('danger')
      expect(statusBadgeVariant(s)).toBe('danger')
      expect(paymentNeedsReview(s)).toBe(true)
    }
  })

  it('leaves every other status as it was', async () => {
    const { paymentStatusLabel, paymentStatusVariant, paymentNeedsReview } = await import('./loungeUtils')
    expect(paymentStatusLabel('FULFILLED')).toBe('FULFILLED')
    expect(paymentStatusVariant('FULFILLED')).toBe('success')
    expect(paymentStatusVariant('PROCESSING')).toBe('warning')
    expect(paymentNeedsReview('PROCESSING')).toBe(false)
    expect(paymentStatusLabel(null)).toBe('—')
  })
})

describe('unpaid eSIM orders', () => {
  it('only an explicit paid:false counts as unpaid', async () => {
    const { isUnpaidOrder } = await import('./utils')
    expect(isUnpaidOrder({ paid: false })).toBe(true)
    expect(isUnpaidOrder({ paid: true })).toBe(false)
    expect(isUnpaidOrder({})).toBe(false) // older VeloxVerse: keep today's behaviour
    expect(isUnpaidOrder(undefined)).toBe(false)
  })

  it('puts the quoted price in the note', async () => {
    const { unpaidOrderNote } = await import('./utils')
    expect(plain(unpaidOrderNote({ quotedPriceUsd: 57.44, currency: 'INR' }))).toBe('Quoted INR 57.44 — checkout was not completed.')
    expect(unpaidOrderNote({ quotedPriceUsd: null })).toMatch(/nothing was paid/)
  })
})

describe('AU-16 DragonPass audit steps', () => {
  it('have labels and, where a person must act, the action', async () => {
    const { stepStaffAction } = await import('./audit')
    expect(stepLabel('dragonpass_order_outcome_unknown')).toBe('DragonPass did not answer — customer refunded, check DragonPass')
    expect(stepLabel('dragonpass_orphan_order_cancelled')).toBe('Stray DragonPass booking cancelled automatically')
    expect(stepLabel('dragonpass_orphan_order')).toBe('Unknown DragonPass booking — check')
    expect(stepStaffAction('dragonpass_order_outcome_unknown')).toMatch(/DragonPass portal and cancel it/)
    expect(stepStaffAction('dragonpass_orphan_order')).toMatch(/DragonPass portal/)
    expect(stepStaffAction('dragonpass_orphan_order_cancelled')).toBeUndefined() // nothing to do
  })
})

describe('describeRefundOutcome — already processed', () => {
  it('says "Already refunded" with the amount instead of an error', () => {
    const o = describeRefundOutcome({ refundState: 'refunded', amount: 57.44, currency: 'INR', alreadyProcessed: true })!
    expect(o.tone).toBe('success')
    expect(o.title).toBe('Already refunded')
    expect(plain(o.message)).toContain('Already refunded — INR 57.44')
  })

  it('says "Nothing to refund" when no refund is owed', () => {
    const o = describeRefundOutcome({ refundState: null, amount: 0, currency: 'INR', alreadyProcessed: true })!
    expect(o.tone).toBe('neutral')
    expect(o.title).toBe('Nothing to refund')
  })

  it('still warns in red when the earlier refund failed', () => {
    const o = describeRefundOutcome({ refundState: 'failed', amount: 0, currency: 'INR', alreadyProcessed: true })!
    expect(o.tone).toBe('danger')
    expect(o.message).toContain('Refund this customer manually')
  })

  it('a fresh refund is worded as before', () => {
    const o = describeRefundOutcome({ refundState: 'refunded', amount: 57.44, currency: 'INR', alreadyProcessed: false })!
    expect(o.title).toBe('Cancelled — refunded')
  })
})
