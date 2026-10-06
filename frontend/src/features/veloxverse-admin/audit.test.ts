import { describe, expect, it } from 'vitest'
import { formatMoney } from '@/lib/utils'
import {
  auditError,
  auditErrorText,
  classifyAuditSearch,
  formatAuditCents,
  formatDurationMs,
  formatMinutes,
  humanize,
  isAuditAdmin,
  isAuditSupport,
  journeyPhase,
  outcomeMeta,
  relativeOffset,
  serviceLabel,
  severityVariant,
  splitHttpStatus,
  stuckDetailEntries,
  supplierLabel,
  utcTitle,
} from './audit'

describe('classifyAuditSearch (handoff §4.3)', () => {
  it('routes a 16-hex support reference to the trace view', () => {
    expect(classifyAuditSearch('c69b661dbe6e1615')).toEqual({ kind: 'trace', requestId: 'c69b661dbe6e1615' })
    expect(classifyAuditSearch('  Ref: C69B661DBE6E1615 ')).toEqual({ kind: 'trace', requestId: 'c69b661dbe6e1615' })
  })

  it('treats ui-xxxxxxxx as a browser crash error code', () => {
    expect(classifyAuditSearch('ui-3f9a1c2e')).toEqual({ kind: 'browserCrash', errorCode: 'ui-3f9a1c2e' })
    expect(classifyAuditSearch('Reference: ui-3F9A1C2E')).toEqual({ kind: 'browserCrash', errorCode: 'ui-3f9a1c2e' })
  })

  it('recognises UUIDs (journey / event / payment / customer, resolved by the page)', () => {
    expect(classifyAuditSearch('BEEF7E28-F6A8-48C5-ADE9-A8623E0D4EAA')).toEqual({ kind: 'uuid', id: 'beef7e28-f6a8-48c5-ade9-a8623e0d4eaa' })
  })

  it('searches by customer email when the text has an @', () => {
    expect(classifyAuditSearch('Jane.Doe@Example.com')).toEqual({ kind: 'email', email: 'jane.doe@example.com' })
  })

  it('falls back to a reference id for order numbers', () => {
    expect(classifyAuditSearch('TRF-12345')).toEqual({ kind: 'reference', referenceId: 'TRF-12345' })
    expect(classifyAuditSearch('N00131')).toEqual({ kind: 'reference', referenceId: 'N00131' })
    // 15 hex chars is not a request id
    expect(classifyAuditSearch('c69b661dbe6e161').kind).toBe('reference')
  })

  it('ignores empty input', () => {
    expect(classifyAuditSearch('   ')).toEqual({ kind: 'empty' })
  })
})

describe('roles', () => {
  it('gives full access to super_admin and admin only', () => {
    expect(isAuditAdmin('super_admin')).toBe(true)
    expect(isAuditAdmin('admin')).toBe(true)
    for (const r of ['employee', 'agent', 'affiliate', 'support', undefined, null]) expect(isAuditAdmin(r)).toBe(false)
  })
  it('identifies the masked support viewer', () => {
    expect(isAuditSupport('support')).toBe(true)
    expect(isAuditSupport('admin')).toBe(false)
  })
})

describe('labels', () => {
  it('humanises step names', () => {
    expect(humanize('payment_declined')).toBe('Payment declined')
    expect(humanize(null)).toBe('—')
  })
  it('uses the handoff service / supplier labels with a humanised fallback', () => {
    expect(serviceLabel('assist_transfer')).toBe('VeloxAssist — Pick & Drop')
    expect(serviceLabel('brand_new_service')).toBe('Brand new service')
    expect(supplierLabel('mint')).toBe('Mint Payments')
  })
  it('maps severities onto Badge variants', () => {
    expect(severityVariant('critical')).toBe('danger')
    expect(severityVariant('high')).toBe('warning')
    expect(severityVariant('low')).toBe('info')
    expect(severityVariant('info')).toBe('neutral')
  })
  it('labels every journey outcome, paid-not-booked as critical red', () => {
    expect(outcomeMeta('booked').label).toBe('Booked')
    expect(outcomeMeta('paid_not_booked').label).toBe('Paid but not booked')
    expect(outcomeMeta('paid_not_booked').className).toContain('bg-red-600')
    expect(outcomeMeta('something_new').label).toBe('Something new')
  })
  it('groups journey steps into phases', () => {
    expect(journeyPhase('step', 'prebook_selected')).toBe('Browse')
    expect(journeyPhase('step', 'checkout_started')).toBe('Checkout')
    expect(journeyPhase('payment', 'payment_3ds_required')).toBe('Payment')
    expect(journeyPhase('supplier_call', 'supplier_call_succeeded')).toBe('Supplier')
    expect(journeyPhase('step', 'confirmation_email_sent')).toBe('After booking')
  })
})

describe('time & duration', () => {
  it('shows the exact UTC value on hover', () => {
    expect(utcTitle('2026-10-06T08:52:12.541Z')).toBe('2026-10-06 08:52:12.541 UTC')
    expect(utcTitle(null)).toBeUndefined()
  })
  it('formats durations and stuck minutes for humans', () => {
    expect(formatDurationMs(120)).toBe('120 ms')
    expect(formatDurationMs(1400)).toBe('1.40 s')
    expect(formatDurationMs(43183)).toBe('43.2 s')
    expect(formatDurationMs(null)).toBe('—')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(185)).toBe('3 h 5 min')
    expect(formatMinutes(36148)).toBe('25 days')
  })
  it('shows offsets from the first event', () => {
    expect(relativeOffset('2026-10-06T08:49:55.000Z', '2026-10-06T08:49:55.120Z')).toBe('+120 ms')
  })
})

describe('values', () => {
  it('formats string or number cents in the real currency', () => {
    expect(formatAuditCents('5785', 'INR')).toBe(formatMoney(57.85, 'INR'))
    expect(formatAuditCents(1999, 'GBP')).toBe(formatMoney(19.99, 'GBP'))
  })
  it('turns stuck details into readable rows, folding amount + currency', () => {
    expect(stuckDetailEntries({ paymentStatus: 'CHARGED', amountCents: '5785', currency: 'INR' })).toEqual([
      ['Amount', formatMoney(57.85, 'INR')],
      ['Payment status', 'CHARGED'],
    ])
    expect(stuckDetailEntries({ dragonpassOrderId: 'IGC1', outcomeUnknown: true })).toEqual([
      ['Dragonpass order id', 'IGC1'],
      ['Outcome unknown', 'Yes'],
    ])
  })
  it('splits exact HTTP codes from classes', () => {
    expect(splitHttpStatus({ '401': 6, '4xx': 6, '500': 1, '5xx': 1 })).toEqual({
      codes: [['401', 6], ['500', 1]],
      classes: [['4xx', 6], ['5xx', 1]],
    })
  })
})

describe('auditError', () => {
  const axiosErr = (status: number, data: unknown) => ({ response: { status, data } })

  it('reads the VeloxVerse message, request id and field errors', () => {
    const e = auditError(axiosErr(400, { message: 'Validation failed', requestId: 'df79454e20692e49', errors: [{ field: 'retentionDays', message: 'Too low' }] }))
    expect(e.message).toBe('Validation failed')
    expect(e.requestId).toBe('df79454e20692e49')
    expect(e.fieldErrors).toEqual([{ field: 'retentionDays', message: 'Too low' }])
    expect(auditErrorText(axiosErr(500, { message: 'Boom', requestId: 'abc' }))).toBe('Boom (Ref: abc)')
  })

  it('treats a VeloxVerse 403 surfaced by the proxy as 502 as "no permission"', () => {
    const e = auditError(axiosErr(502, { message: 'You do not have permission to access this resource.' }))
    expect(e.forbidden).toBe(true)
    expect(auditErrorText(axiosErr(502, { message: 'You do not have permission to access this resource.' }))).toBe("You don't have permission to do this.")
    expect(auditError(axiosErr(502, { message: 'VeloxVerse service is not available.' })).forbidden).toBe(false)
  })

  it('flags 404 as not found (purged by retention)', () => {
    expect(auditError(axiosErr(404, { message: 'Audit event not found.' })).notFound).toBe(true)
  })
})
