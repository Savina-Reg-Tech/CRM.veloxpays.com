import { afterEach, describe, expect, it } from 'vitest'
import { formatCentsIn, formatStampWithZone, refundStatusChip } from './loungeUtils'

const originalTz = process.env.TZ
afterEach(() => {
  process.env.TZ = originalTz
})

describe('refund card amount', () => {
  it('shows amountCents as AUD 51.19, not 0.51', () => {
    expect(formatCentsIn(5119, 'AUD').replace(/\s/g, ' ')).toBe('AUD 51.19')
  })
})

describe('formatStampWithZone', () => {
  it('shows a UTC refund time in the viewer zone with its name', () => {
    process.env.TZ = 'Asia/Kolkata'
    expect(formatStampWithZone('2026-10-18T06:14:00.000Z')).toBe('18 Oct 2026, 11:44 IST')
  })

  it('reads a zone-less stamp from older builds as UTC', () => {
    process.env.TZ = 'Asia/Kolkata'
    expect(formatStampWithZone('2026-10-18 06:14:00')).toBe('18 Oct 2026, 11:44 IST')
  })

  it('handles empty and junk values', () => {
    expect(formatStampWithZone(null)).toBe('—')
    expect(formatStampWithZone('not a date')).toBe('not a date')
  })
})

describe('refundStatusChip', () => {
  it('maps Mint statuses', () => {
    expect(refundStatusChip('APPROVED')).toEqual({ label: 'Refunded', variant: 'success' })
    expect(refundStatusChip('DECLINED')?.variant).toBe('danger')
    expect(refundStatusChip('FAILED')?.label).toBe('Refund failed — refund manually in Mint')
    expect(refundStatusChip(null)).toBeNull()
  })
})
