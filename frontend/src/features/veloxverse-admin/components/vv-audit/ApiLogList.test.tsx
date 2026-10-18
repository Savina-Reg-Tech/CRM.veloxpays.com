import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ApiLogSummary } from '../../auditTypes'
import { ApiLogList } from './ApiLogList'
import { activeFilterChips, apiLogFiltersFromParams, countPanelFilters } from './ApiLogFilters'

function log(over: Partial<ApiLogSummary> = {}): ApiLogSummary {
  return {
    id: 'log-1',
    createdAt: '2026-10-18T04:51:07.000Z',
    direction: 'outbound',
    service: 'lounge',
    supplier: 'dragonpass',
    operation: 'POST /v2/orders/:id/cancel',
    method: 'POST',
    url: null,
    route: null,
    statusCode: 200,
    outcome: 'success',
    needsAttention: false,
    isMoneyCall: false,
    durationMs: 812,
    attempt: 1,
    idempotencyKey: null,
    errorCode: null,
    errorMessage: null,
    actor: 'customer',
    jobName: null,
    requestId: 'a1b2c3d4e5f60718',
    journeyId: null,
    userId: null,
    refs: [],
    hasBodies: false,
    bodyTruncated: false,
    isSensitiveMasked: false,
    ip: null,
    userAgent: null,
    customer: null,
    ...over,
  }
}

function Location() {
  const loc = useLocation()
  return <output data-testid="loc">{loc.search}</output>
}

function renderList(ui: React.ReactNode, initial = '/dashboard/veloxverse/audit-logs/api?errorsOnly=1') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      {ui}
      <Location />
    </MemoryRouter>
  )
}

const timedOut = log({ id: 'log-2', statusCode: null, outcome: 'unknown', needsAttention: true, durationMs: 15_000, isMoneyCall: true, attempt: 2, refs: ['DP1234567', 'LNG-42', 'x'] })

describe('ApiLogList', () => {
  it('shows "No answer" for a null status code — never 0 or null (cards)', () => {
    renderList(<ApiLogList logs={[timedOut]} layout="cards" />)
    expect(screen.getByText('No answer')).toBeInTheDocument()
    expect(screen.queryByText(/^(0|null)$/)).not.toBeInTheDocument()
    expect(screen.getByText('15.0 s')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('marks needs-attention rows with the purple border and a text label (table)', () => {
    renderList(<ApiLogList logs={[log(), timedOut]} layout="table" />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    const attention = rows[1]
    expect(within(attention).getByText('Outcome unknown')).toBeInTheDocument()
    expect(within(attention).getByText('No answer')).toBeInTheDocument()
    expect(attention.querySelector('td')?.className).toContain('border-l-violet-600')
    expect(rows[0].querySelector('td')?.className).not.toContain('border-l-violet-600')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Call')
  })

  it('Enter on a focused row opens the drawer (?log=<id>) and keeps the filters', async () => {
    renderList(<ApiLogList logs={[log(), timedOut]} layout="table" />)
    const row = screen.getAllByRole('row')[2]
    row.focus()
    expect(row).toHaveFocus()
    fireEvent.keyDown(row, { key: 'Enter' })
    const search = new URLSearchParams(screen.getByTestId('loc').textContent ?? '')
    expect(search.get('log')).toBe('log-2')
    expect(search.get('errorsOnly')).toBe('1')
  })

  it('a card is a button that opens the drawer, and flags the same request', async () => {
    renderList(<ApiLogList logs={[log(), log({ id: 'log-3' })]} layout="cards" />)
    expect(screen.getByText('same request')).toBeInTheDocument()
    const cards = screen.getAllByRole('button')
    await userEvent.click(cards[1])
    expect(new URLSearchParams(screen.getByTestId('loc').textContent ?? '').get('log')).toBe('log-3')
  })

  it('renders skeletons while loading', () => {
    renderList(<ApiLogList logs={[]} loading layout="table" />)
    expect(screen.getByLabelText('Loading API calls')).toBeInTheDocument()
  })
})

describe('API log filters from the URL', () => {
  it('parses lists, flags and numbers and drops invalid status codes', () => {
    const p = new URLSearchParams('outcome=unknown,timeout&errorsOnly=1&statusCode=5&minDurationMs=5000&ref=LNG-1&log=abc')
    expect(apiLogFiltersFromParams(p)).toEqual({ outcome: ['unknown', 'timeout'], errorsOnly: true, minDurationMs: 5000, ref: 'LNG-1' })
    expect(countPanelFilters(p)).toBe(2)
    expect(activeFilterChips(p).map((c) => c.label)).toEqual(['Outcome: Outcome unknown', 'Outcome: Timed out', 'Errors only', 'Slow (> 5 s)', 'Search: LNG-1', 'Status code: 5'])
  })
})
