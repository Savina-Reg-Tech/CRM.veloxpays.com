import { describe, it, expect } from 'vitest'
import {
  adjacentDraftId,
  chipsToPlaceholders,
  closestPlaceholder,
  countdown,
  detailsCheckRows,
  effectiveValue,
  isAllowedEmailLink,
  isLockedDraftError,
  isSendingStale,
  isTestModeError,
  missingFromError,
  needsCancelledConfirm,
  nextDraftId,
  pdErrorText,
  placeholdersIn,
  placeholdersToChips,
  problemsFromError,
  readiness,
  subjectParts,
  unknownPlaceholdersIn,
  waitingAge,
} from './pickdropEmails'
import type { DraftDetail } from './types'

const NOW = Date.parse('2026-10-23T10:00:00Z')
const at = (ms: number) => new Date(NOW + ms).toISOString()
const H = 3_600_000
const M = 60_000

const httpErr = (status: number, data: Record<string, unknown>) => ({ response: { status, data } })

function draft(over: Partial<DraftDetail> = {}): DraftDetail {
  return {
    id: 'd1',
    orderNo: 'TRF-1',
    templateKey: 'transfer_driver_details',
    templateName: 'Driver details',
    trigger: 'EMAIL',
    status: 'DRAFT',
    subject: 'Your driver for {{pickupDateTime}}',
    missing: [],
    attachVoucher: false,
    sourceEmailId: 'e1',
    pickupAt: at(5 * H),
    bookingStatus: 'APPROVED',
    updatedNote: null,
    createdAt: at(-10 * M),
    editedBy: null,
    editedAt: null,
    sendingStartedAt: null,
    sentBy: null,
    sentAt: null,
    sentTo: null,
    sendCount: 0,
    discardedBy: null,
    discardedAt: null,
    discardReason: null,
    error: null,
    bodyHtml: '<p>Driver {{driverName}} on {{driverPhone}}</p>',
    values: { pickupDateTime: '2026-10-23 15:00', driverName: 'Ravi' },
    adminValues: {},
    requiredFields: ['driverName', 'driverPhone'],
    placeholders: [
      { key: 'driverName', label: 'Driver name' },
      { key: 'driverPhone', label: 'Driver phone' },
    ],
    preview: { to: 'asha@example.com', subject: 's', html: '', text: '', missing: [], voucher: null },
    sourceEmail: null,
    booking: {
      orderNo: 'TRF-1',
      reservationNo: 'R-1',
      status: 'APPROVED',
      upstreamStatus: 'APPROVED',
      pickupAt: at(5 * H),
      pickupLocal: '2026-10-23 15:00',
      pickupName: 'Airport',
      dropoffName: 'Hotel',
      flightNumber: 'AI101',
      driverName: 'Ravi',
      driverPhone: null,
      vehiclePlate: null,
      lastSyncedAt: null,
    },
    ...over,
  }
}

describe('countdown', () => {
  it('is red under 6 h, amber under 24 h, grey after', () => {
    expect(countdown(at(3 * H + 20 * M), NOW)).toEqual({ text: 'in 3 h 20 min', tone: 'red', passed: false })
    expect(countdown(at(7 * H), NOW).tone).toBe('amber')
    expect(countdown(at(23 * H + 59 * M), NOW).tone).toBe('amber')
    expect(countdown(at(30 * H), NOW)).toEqual({ text: 'in 1 d 6 h', tone: 'grey', passed: false })
    expect(countdown(at(45 * M), NOW).text).toBe('in 45 min')
  })

  it('says when the pickup has passed or is unknown', () => {
    expect(countdown(at(-M), NOW)).toEqual({ text: 'Pickup passed', tone: 'grey', passed: true })
    expect(countdown(null, NOW).text).toBe('No pickup time')
    expect(countdown('nonsense', NOW).text).toBe('No pickup time')
  })
})

describe('waitingAge', () => {
  it('turns overdue after 30 minutes', () => {
    expect(waitingAge(at(-45 * M), NOW)).toEqual({ text: 'waiting 45 min', overdue: true })
    expect(waitingAge(at(-30 * M), NOW).overdue).toBe(false)
  })
})

describe('isSendingStale', () => {
  it('lets Send claim a send that started over 10 minutes ago', () => {
    expect(isSendingStale({ status: 'SENDING', sendingStartedAt: at(-11 * M) }, NOW)).toBe(true)
    expect(isSendingStale({ status: 'SENDING', sendingStartedAt: at(-2 * M) }, NOW)).toBe(false)
    expect(isSendingStale({ status: 'DRAFT', sendingStartedAt: at(-60 * M) }, NOW)).toBe(false)
  })
})

describe('readiness', () => {
  it('matches missing fields and lists their labels', () => {
    expect(readiness({ status: 'DRAFT', missing: [], error: null }).kind).toBe('ready')
    const r = readiness({ status: 'DRAFT', missing: ['driverPhone', 'vehiclePlate'], error: null })
    expect(r).toMatchObject({ kind: 'missing', label: '2 fields missing', tone: 'amber' })
    expect(r.detail).toBe('Driver phone, Vehicle plate')
    expect(readiness({ status: 'DRAFT', missing: ['x'], error: null }, [{ key: 'x', label: 'Ex' }]).detail).toBe('Ex')
  })

  it('shows a failed send with its error', () => {
    expect(readiness({ status: 'FAILED', missing: [], error: 'SMTP down' })).toMatchObject({ kind: 'failed', tone: 'red', detail: 'SMTP down' })
  })
})

describe('placeholders', () => {
  it('lists keys once, in order', () => {
    expect(placeholdersIn('Hi {{customerName}}, {{ driverName }} / {{customerName}}')).toEqual(['customerName', 'driverName'])
  })

  it('lets admin values win, and treats "" as cleared', () => {
    expect(effectiveValue({ values: { a: 'auto' }, adminValues: { a: 'mine' } }, 'a')).toBe('mine')
    expect(effectiveValue({ values: { a: 'auto' }, adminValues: { a: '' } }, 'a')).toBe('auto')
  })

  it('suggests the real key for a wrongly cased one', () => {
    expect(closestPlaceholder('drivername', [{ key: 'driverName' }])).toBe('driverName')
    expect(closestPlaceholder('nope', [{ key: 'driverName' }])).toBeNull()
    expect(unknownPlaceholdersIn(['Unknown placeholder {{drivername}}', 'Subject is empty'])).toEqual(['drivername'])
  })

  it('converts text placeholders to chips and back, leaving links alone', () => {
    const html = '<p>Hi {{customerName}}, <a href="{{ticketLink}}">My Bookings</a></p>'
    const chips = placeholdersToChips(html)
    expect(chips).toContain('<span data-placeholder="customerName"></span>')
    expect(chips).toContain('href="{{ticketLink}}"')
    expect(chipsToPlaceholders(chips)).toBe(html)
  })

  it('splits a subject into text and chips', () => {
    expect(subjectParts('Driver {{driverName}}!')).toEqual([{ text: 'Driver ' }, { key: 'driverName' }, { text: '!' }])
  })

  it('accepts only the link targets VeloxVerse keeps', () => {
    expect(isAllowedEmailLink('https://veloxverse.com')).toBe(true)
    expect(isAllowedEmailLink('mailto:help@veloxverse.com')).toBe(true)
    expect(isAllowedEmailLink('tel:+61 400 000 000')).toBe(true)
    expect(isAllowedEmailLink('{{ticketLink}}')).toBe(true)
    expect(isAllowedEmailLink('javascript:alert(1)')).toBe(false)
    expect(isAllowedEmailLink('ftp://x')).toBe(false)
  })
})

describe('detailsCheckRows', () => {
  it('marks missing and different rows, and only shows relevant ones up front', () => {
    const d = draft({
      preview: { to: 'a@b.c', subject: '', html: '', text: '', missing: ['driverPhone'], voucher: null },
      sourceEmail: {
        id: 'e1', receivedAt: at(0), from: 'x', subject: 's', detectedType: 'DRIVER_ASSIGNED', status: 'DRAFTED',
        orderNo: 'TRF-1', reservationNo: 'R-1', matchMethod: 'ORDER_TAG', senderVerified: true,
        mismatches: [{ field: 'driverName', email: 'Ravi K', ours: 'Ravi' }],
        attachmentCount: 0, error: null, handledNote: null, handledBy: null, handledAt: null,
        bodyHtml: null,
        extracted: { driverName: 'Ravi K', passengerName: 'Asha', passengerPhone: '+61 400 111 222' },
      },
    })
    const rows = detailsCheckRows(d)
    const by = (k: string) => rows.find((r) => r.key === k)!
    expect(by('driverPhone').state).toBe('missing')
    expect(by('driverName').state).toBe('different')
    expect(by('driverName').email).toBe('Ravi K')
    expect(by('flightNumber')).toMatchObject({ state: 'ok', relevant: false })
    expect(by('pickupDateTime').relevant).toBe(true)
    // The passenger's phone never shows up as the driver's.
    expect(by('driverPhone').email).toBe('')
  })

  it('turns green once ViaTovia’s value is used or "Keep ours" is clicked', () => {
    const base = draft({
      sourceEmail: {
        id: 'e1', receivedAt: at(0), from: 'x', subject: 's', detectedType: 'DRIVER_ASSIGNED', status: 'DRAFTED',
        orderNo: 'TRF-1', reservationNo: 'R-1', matchMethod: 'ORDER_TAG', senderVerified: true,
        mismatches: [{ field: 'driverName', email: 'Ravi K', ours: 'Ravi' }],
        attachmentCount: 0, error: null, handledNote: null, handledBy: null, handledAt: null,
        bodyHtml: null, extracted: { driverName: 'Ravi K' },
      },
    })
    const used = detailsCheckRows({ ...base, adminValues: { driverName: 'Ravi K' } })
    expect(used.find((r) => r.key === 'driverName')!.state).toBe('ok')
    const kept = detailsCheckRows(base, new Set(['driverName']))
    expect(kept.find((r) => r.key === 'driverName')!.state).toBe('ok')
  })
})

describe('queue navigation', () => {
  it('goes to the next draft, wrapping to the first other one, or null when caught up', () => {
    expect(nextDraftId(['a', 'b', 'c'], 'a')).toBe('b')
    expect(nextDraftId(['a', 'b', 'c'], 'c')).toBe('a')
    expect(nextDraftId(['b', 'c'], 'a')).toBe('b')
    expect(nextDraftId(['a'], 'a')).toBeNull()
    expect(nextDraftId([], 'a')).toBeNull()
  })

  it('moves with [ and ] without wrapping', () => {
    expect(adjacentDraftId(['a', 'b'], 'a', 1)).toBe('b')
    expect(adjacentDraftId(['a', 'b'], 'b', 1)).toBeNull()
    expect(adjacentDraftId(['a', 'b'], 'b', -1)).toBe('a')
    expect(adjacentDraftId(['a', 'b'], 'z', 1)).toBeNull()
  })
})

describe('error helpers', () => {
  it('recognises test mode behind the proxy (403 or 502)', () => {
    expect(isTestModeError(httpErr(502, { message: 'Test mode: only allow-listed customers' }))).toBe(true)
    expect(isTestModeError(httpErr(403, { message: 'Test mode: only allow-listed customers' }))).toBe(true)
    expect(isTestModeError(httpErr(502, { message: 'The email could not be sent: SMTP' }))).toBe(false)
  })

  it('asks for confirmation on a cancelled ride', () => {
    expect(needsCancelledConfirm(httpErr(409, { message: 'cancelled', errors: { needsConfirmation: 'confirmCancelled' } }))).toBe(true)
    expect(needsCancelledConfirm(httpErr(409, { message: 'Already sent' }))).toBe(false)
  })

  it('reads missing fields and problems', () => {
    expect(missingFromError(httpErr(400, { message: 'Fill in', errors: { missing: ['driverPhone', 'vehiclePlate'] } }))).toEqual(['driverPhone', 'vehiclePlate'])
    expect(missingFromError(httpErr(409, { errors: { missing: ['x'] } }))).toEqual([])
    expect(problemsFromError(httpErr(400, { errors: { problems: ['Unknown placeholder {{x}}'] } }))).toEqual(['Unknown placeholder {{x}}'])
    expect(problemsFromError(httpErr(400, { errors: [{ field: 'a' }] }))).toEqual([])
  })

  it('knows a draft that is past editing', () => {
    expect(isLockedDraftError(httpErr(409, { message: 'This email is sent and can no longer be edited' }))).toBe(true)
    expect(isLockedDraftError(httpErr(409, { message: 'Someone else is sending this email right now' }))).toBe(true)
  })

  it('shows the message with its Ref', () => {
    expect(pdErrorText(httpErr(400, { message: 'Fill in before sending: driverPhone', requestId: 'abc' }))).toBe(
      'Fill in before sending: driverPhone (Ref: abc)',
    )
    expect(pdErrorText(httpErr(403, { message: 'nope' }))).toBe("You don't have permission to do this.")
    expect(pdErrorText(new Error('Network Error'))).toBe('Network Error')
  })
})
