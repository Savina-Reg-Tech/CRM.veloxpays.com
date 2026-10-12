import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { cardChargeLabel, centsToMajorOrNull } from '@/lib/utils'
import DualAmount from './DualAmount'

// Intl separates the currency code from the amount with a non-breaking space.
const plain = (s: string | null) => s?.replace(/\u00a0/g, ' ')

describe('cardChargeLabel', () => {
  it('prints the AUD card charge under a foreign-currency amount', () => {
    expect(plain(cardChargeLabel('INR', 0.86, 'AUD'))).toBe('AUD 0.86 charged')
  })

  it('says "refunded" on refund rows', () => {
    expect(plain(cardChargeLabel('INR', 0.86, 'AUD', 'refunded'))).toBe('AUD 0.86 refunded')
  })

  it('is null when there is no card charge — null is not zero', () => {
    expect(cardChargeLabel('INR', null, null)).toBeNull()
    expect(cardChargeLabel('INR', undefined, undefined)).toBeNull()
    expect(cardChargeLabel('INR', null, 'AUD')).toBeNull()
    expect(cardChargeLabel('INR', 0.86, null)).toBeNull()
    expect(cardChargeLabel('INR', Number.NaN, 'AUD')).toBeNull()
  })

  it('is null when the customer already pays in the card currency', () => {
    expect(cardChargeLabel('AUD', 70.12, 'AUD')).toBeNull()
    expect(cardChargeLabel('aud', 70.12, 'AUD')).toBeNull()
  })
})

describe('centsToMajorOrNull', () => {
  it('converts cents and keeps null as null', () => {
    expect(centsToMajorOrNull(86)).toBe(0.86)
    expect(centsToMajorOrNull(0)).toBe(0)
    expect(centsToMajorOrNull(null)).toBeNull()
    expect(centsToMajorOrNull(undefined)).toBeNull()
  })
})

describe('DualAmount', () => {
  it('shows the customer amount and the AUD charge on two lines', () => {
    render(<DualAmount amount={57.44} currency="INR" cardChargeAmount={0.86} cardChargeCurrency="AUD" />)
    expect(screen.getByText('INR 57.44')).toBeInTheDocument()
    expect(screen.getByText('AUD 0.86 charged')).toBeInTheDocument()
  })

  it('shows only the customer amount when the card charge is null', () => {
    const { container } = render(
      <DualAmount amount={57.85} currency="INR" cardChargeAmount={null} cardChargeCurrency={null} />
    )
    expect(screen.getByText('INR 57.85')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/AUD|NaN|\$/)
  })

  it('shows one line for an AUD customer', () => {
    const { container } = render(
      <DualAmount amount={70.12} currency="AUD" cardChargeAmount={70.12} cardChargeCurrency="AUD" />
    )
    expect(plain(container.textContent)).toBe('AUD 70.12')
  })

  it('labels refund rows as refunded and keeps the sign on the customer amount', () => {
    render(
      <DualAmount amount={57.44} currency="INR" cardChargeAmount={0.86} cardChargeCurrency="AUD" kind="refunded" prefix="−" />
    )
    expect(screen.getByText('−INR 57.44')).toBeInTheDocument()
    expect(screen.getByText('AUD 0.86 refunded')).toBeInTheDocument()
  })
})
