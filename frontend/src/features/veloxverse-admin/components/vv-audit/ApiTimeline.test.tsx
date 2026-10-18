import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ToastProvider from '@/app/providers/ToastProvider'
import { formatDayLabel, stepLabel } from '../../audit'
import type { ApiLogSummary, ApiTimelineItem } from '../../auditTypes'
import { ApiTimeline, UNKNOWN_HINT } from './ApiTimeline'

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

// The 18 Oct case: cancel times out at DragonPass, the push arrives 80 minutes later.
const story: ApiTimelineItem[] = [
  logItem({ id: 'a', createdAt: '2026-10-18T04:51:00.000Z', statusCode: 502, outcome: 'error', requestId: 'r1' }),
  logItem({
    id: 'b', createdAt: '2026-10-18T04:51:15.000Z', direction: 'outbound', supplier: 'dragonpass',
    operation: 'POST /v2/orders/:id/cancel', statusCode: null, outcome: 'unknown', needsAttention: true, requestId: 'r1', durationMs: 15000,
  }),
  {
    kind: 'audit_event', at: '2026-10-18T04:51:16.000Z',
    event: { id: 'e1', createdAt: '2026-10-18T04:51:16.000Z', service: 'lounge', eventType: 'step', step: 'cancel_failed', status: 'failure', severity: 'high', requestId: 'r1', journeyId: null, referenceType: null, referenceId: null, errorCode: null, errorMessage: null, supplier: null },
  },
  logItem({ id: 'c', createdAt: '2026-10-18T06:11:16.000Z', direction: 'webhook', supplier: 'dragonpass', route: '/webhooks/dragonpass', requestId: 'r2' }),
  logItem({ id: 'd', createdAt: '2026-10-18T06:11:17.000Z', direction: 'outbound', supplier: 'mint', operation: 'POST /v5/purchase/:id/refund', isMoneyCall: true, requestId: 'r2' }),
]

function LocationProbe() {
  const loc = useLocation()
  return <output data-testid="search">{loc.search}</output>
}

function renderTimeline(items: ApiTimelineItem[], props: { compact?: boolean; maxItems?: number } = {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ApiTimeline data={{ items }} {...props} />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('ApiTimeline', () => {
  it('shows the day, the 80-minute gap marker and request group titles', () => {
    renderTimeline(story)
    expect(screen.getByText(formatDayLabel('2026-10-18T04:51:00.000Z'))).toBeInTheDocument()
    expect(screen.getByText('80 min later')).toBeInTheDocument()
    expect(screen.getByText('Customer · POST /api/v1/lounge/visits/:id/cancel · 502')).toBeInTheDocument()
    expect(screen.getByText('DragonPass push · webhook · 200')).toBeInTheDocument()
  })

  it('flags the unknown supplier call and its group', () => {
    renderTimeline(story)
    expect(screen.getByText(UNKNOWN_HINT)).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    // Badges carry text: "No answer" for a null status, never "0".
    expect(screen.getAllByText('No answer').length).toBeGreaterThan(0)
    expect(screen.getByText('Outcome unknown')).toBeInTheDocument()
  })

  it('opens the API-log drawer and the event drawer through the URL', () => {
    renderTimeline(story)
    fireEvent.click(screen.getByText('DragonPass · POST /v2/orders/:id/cancel'))
    expect(screen.getByTestId('search').textContent).toContain('log=b')
    fireEvent.click(screen.getByText(stepLabel('cancel_failed')))
    expect(screen.getByTestId('search').textContent).toContain('event=e1')
  })

  it('collapses a request group with more than 20 items', () => {
    const job: ApiTimelineItem[] = Array.from({ length: 30 }, (_, i) =>
      logItem({
        id: `j${i}`,
        createdAt: new Date(Date.UTC(2026, 9, 18, 3, 0, i)).toISOString(),
        direction: 'outbound',
        supplier: 'dragonpass',
        operation: `GET /v2/orders/${i}`,
        method: 'GET',
        jobName: 'dragonpassReconciliation',
        actor: 'system',
        requestId: 'job-abc',
      })
    )
    renderTimeline(job)
    expect(screen.getByText('Job dragonpassReconciliation')).toBeInTheDocument()
    const expand = screen.getByRole('button', { name: /20 more calls — expand/ })
    expect(screen.queryByText('DragonPass · GET /v2/orders/29')).not.toBeInTheDocument()
    fireEvent.click(expand)
    expect(screen.getByText('DragonPass · GET /v2/orders/29')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /more calls — expand/ })).not.toBeInTheDocument()
  })

  it('caps items with maxItems and renders progressively past 200', () => {
    // One big request (cheap to render: the group stays collapsed; its first call is the card header).
    const many: ApiTimelineItem[] = Array.from({ length: 250 }, (_, i) =>
      logItem({ id: `m${i}`, createdAt: new Date(Date.UTC(2026, 9, 18, 0, 0, i)).toISOString(), direction: 'outbound', supplier: 'mint', requestId: 'r-big' })
    )
    const { unmount } = renderTimeline(many)
    expect(screen.getByText('Showing 200 of 250 items')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /189 more calls — expand/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /239 more calls — expand/ })).toBeInTheDocument()
    unmount()

    renderTimeline(many, { compact: true, maxItems: 50 })
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /39 more calls — expand/ })).toBeInTheDocument()
  })
})
