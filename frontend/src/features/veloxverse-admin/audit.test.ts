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

// ── API logs ────────────────────────────────────────────────────────
import {
  apiCallText,
  apiOutcomeMeta,
  apiSupplierLabel,
  durationTone,
  formatApiDuration,
  groupTimeline,
  missingBodyReason,
  routeSearch,
  statusClassOf,
  statusCodeText,
  textBody,
  isTruncatedBody,
} from './audit'
import type { ApiLogSummary, ApiTimelineItem } from './auditTypes'

function apiLog(over: Partial<ApiLogSummary>): ApiLogSummary {
  return {
    id: 'l1', createdAt: '2026-10-18T04:51:00.000Z', direction: 'inbound', service: 'lounge', supplier: null,
    operation: null, method: 'POST', url: null, route: '/api/v1/lounge/visits/:id/cancel', statusCode: 200,
    outcome: 'success', needsAttention: false, isMoneyCall: false, durationMs: 120, attempt: null,
    idempotencyKey: null, errorCode: null, errorMessage: null, actor: 'customer', jobName: null,
    requestId: 'ab12cd34ef56ab12', journeyId: null, userId: null, refs: [], hasBodies: true,
    bodyTruncated: false, isSensitiveMasked: false, ip: null, userAgent: null, customer: null,
    ...over,
  }
}
const logItem = (over: Partial<ApiLogSummary>): ApiTimelineItem => {
  const log = apiLog(over)
  return { kind: 'api_log', at: log.createdAt, log }
}

describe('API log labels', () => {
  it('labels outcomes and keeps unknown purple', () => {
    expect(apiOutcomeMeta('unknown').label).toBe('Outcome unknown')
    expect(apiOutcomeMeta('unknown').colour).toBe('#7c3aed')
    expect(apiOutcomeMeta('failure').label).toBe('Failed')
    expect(apiOutcomeMeta('weird').label).toBe('Weird')
  })

  it('labels suppliers for API logs', () => {
    expect(apiSupplierLabel('mint')).toBe('Mint')
    expect(apiSupplierLabel('email')).toBe('Email (SMTP)')
    expect(apiSupplierLabel('s3')).toBe('S3 storage')
  })

  it('describes the call', () => {
    expect(apiCallText(apiLog({}))).toBe('POST /api/v1/lounge/visits/:id/cancel')
    expect(apiCallText(apiLog({ direction: 'outbound', supplier: 'dragonpass', operation: 'POST /v2/orders/:id/cancel' }))).toBe(
      'DragonPass · POST /v2/orders/:id/cancel'
    )
  })
})

describe('formatApiDuration', () => {
  it('uses ms below a second and one decimal above', () => {
    expect(formatApiDuration(812)).toBe('812 ms')
    expect(formatApiDuration(15003)).toBe('15.0 s')
    expect(formatApiDuration(null)).toBe('—')
  })
  it('flags slow calls', () => {
    expect(durationTone(800)).toBe('normal')
    expect(durationTone(5001)).toBe('slow')
    expect(durationTone(15003)).toBe('very-slow')
  })
})

describe('statusClassOf', () => {
  it('classifies codes and treats null as no answer', () => {
    expect(statusClassOf(200)).toBe('2xx')
    expect(statusClassOf(301)).toBe('3xx')
    expect(statusClassOf(404)).toBe('4xx')
    expect(statusClassOf(502)).toBe('5xx')
    expect(statusClassOf(null)).toBe('none')
    expect(statusCodeText(null)).toBe('No answer')
    expect(statusCodeText(0)).toBe('No answer')
    expect(statusCodeText(502)).toBe('502')
  })
})

describe('routeSearch', () => {
  it('sends request ids and job runs to the API timeline', () => {
    expect(routeSearch('AB12CD34EF56AB12')).toEqual({ kind: 'apiRequest', requestId: 'ab12cd34ef56ab12' })
    expect(routeSearch('job-dragonpassReconciliation-1')).toEqual({ kind: 'apiRequest', requestId: 'job-dragonpassReconciliation-1' })
  })
  it('offers both views for a UUID', () => {
    expect(routeSearch('CC2FCDD9-7E20-4FF7-A189-AC2C7AEE6877')).toEqual({ kind: 'uuid', id: 'cc2fcdd9-7e20-4ff7-a189-ac2c7aee6877' })
  })
  it('sends order numbers and long Mint numbers to the API timeline by ref', () => {
    expect(routeSearch('trf-1234')).toEqual({ kind: 'apiRef', ref: 'TRF-1234' })
    expect(routeSearch('LNG-ABC123')).toEqual({ kind: 'apiRef', ref: 'LNG-ABC123' })
    expect(routeSearch('882736451209')).toEqual({ kind: 'apiRef', ref: '882736451209' })
  })
  it('falls back to the journey search', () => {
    expect(routeSearch('jane@example.com')).toEqual({ kind: 'audit', target: { kind: 'email', email: 'jane@example.com' } })
    expect(routeSearch('  ')).toEqual({ kind: 'empty' })
  })
})

describe('groupTimeline', () => {
  // The 18 Oct case: cancel times out at DragonPass, the push arrives 80 minutes later.
  const items: ApiTimelineItem[] = [
    logItem({ id: 'a', createdAt: '2026-10-18T04:51:00.000Z', statusCode: 502, outcome: 'error', requestId: 'r1' }),
    logItem({
      id: 'b', createdAt: '2026-10-18T04:51:15.000Z', direction: 'outbound', supplier: 'dragonpass',
      operation: 'POST /v2/orders/:id/cancel', statusCode: null, outcome: 'unknown', needsAttention: true, requestId: 'r1',
    }),
    {
      kind: 'audit_event', at: '2026-10-18T04:51:16.000Z',
      event: { id: 'e1', createdAt: '2026-10-18T04:51:16.000Z', service: 'lounge', eventType: 'step', step: 'cancel_failed', status: 'failure', severity: 'high', requestId: 'r1', journeyId: null, referenceType: null, referenceId: null, errorCode: null, errorMessage: null, supplier: null },
    },
    logItem({ id: 'c', createdAt: '2026-10-18T06:11:16.000Z', direction: 'webhook', supplier: 'dragonpass', route: '/webhooks/dragonpass', requestId: 'r2' }),
    logItem({ id: 'd', createdAt: '2026-10-18T06:11:17.000Z', direction: 'outbound', supplier: 'mint', operation: 'POST /v5/purchase/:id/refund', isMoneyCall: true, requestId: 'r2' }),
  ]

  it('groups by request, adds one day separator and an 80-minute gap marker', () => {
    const rows = groupTimeline(items)
    expect(rows.map((r) => r.type)).toEqual(['day', 'group', 'gap', 'group'])
    const gap = rows[2]
    expect(gap.type === 'gap' && gap.label).toBe('80 min later')
    const [g1, g2] = rows.filter((r) => r.type === 'group').map((r) => (r.type === 'group' ? r.group : null))
    expect(g1?.items).toHaveLength(3)
    expect(g1?.needsAttention).toBe(true)
    expect(g1?.title).toBe('Customer · POST /api/v1/lounge/visits/:id/cancel · 502')
    expect(g2?.title).toBe('DragonPass push · webhook · 200')
    expect(g2?.needsAttention).toBe(false)
  })

  it('sorts oldest first and splits a new day', () => {
    const rows = groupTimeline([
      logItem({ id: 'x', createdAt: '2026-10-19T12:00:00.000Z', requestId: 'r9' }),
      logItem({ id: 'y', createdAt: '2026-10-17T12:00:00.000Z', requestId: 'r8' }),
    ])
    expect(rows.filter((r) => r.type === 'day')).toHaveLength(2)
    expect(rows[1].type === 'group' && rows[1].group.items[0].at).toBe('2026-10-17T12:00:00.000Z')
  })

  it('keeps items without a request id as their own groups', () => {
    const rows = groupTimeline([
      logItem({ id: 'p', requestId: null }),
      logItem({ id: 'q', createdAt: '2026-10-18T04:52:00.000Z', requestId: null }),
    ])
    expect(rows.filter((r) => r.type === 'group')).toHaveLength(2)
  })
})

describe('bodies', () => {
  it('explains a missing body', () => {
    expect(missingBodyReason({ method: 'GET', statusCode: 200, hasBodies: false })).toMatch(/successful reads/)
    expect(missingBodyReason({ method: 'POST', statusCode: 200, hasBodies: false })).toMatch(/turned off/)
  })
  it('recognises truncated and text bodies', () => {
    expect(isTruncatedBody({ _truncated: true, _bytes: 40000, preview: '{' })).toBe(true)
    expect(isTruncatedBody({ a: 1 })).toBe(false)
    expect(textBody({ text: '<html>' })).toBe('<html>')
    expect(textBody({ text: 'x', other: 1 })).toBeNull()
  })
})
