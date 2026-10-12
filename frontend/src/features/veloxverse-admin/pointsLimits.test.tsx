import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
const put = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: vi.fn(), delete: vi.fn() },
}))

// The modal's focus trap needs real layout to find focusable elements; jsdom has none.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  FocusTrap: ({ children }: { children: React.ReactNode }) => children,
}))

import ToastProvider from '@/app/providers/ToastProvider'
import VVPointsPage from './pages/VVPointsPage'
import {
  formatPerOrderLimit,
  limitOrZero,
  perOrderPointsWorth,
  pointsAuditFieldLabel,
  pointsAuditValue,
  validatePerOrderLimits,
} from './pointsLimits'
import { vvPointsService } from './vvAdminService'

const plain = (s: string | null) => s?.replace(/ /g, ' ')

// ── pure rules ──────────────────────────────────────────────────────────────
describe('validatePerOrderLimits', () => {
  const ok = (points: string, percent: string, min = 500) => validatePerOrderLimits({ points, percent, minRedeemPoints: min })

  it('accepts 0 (no limit) and ordinary values', () => {
    expect(ok('0', '0')).toEqual({})
    expect(ok('20000', '50')).toEqual({})
    expect(ok('500', '100')).toEqual({}) // equal to the minimum is allowed
  })

  it('refuses a points limit below the minimum to redeem, with the required wording', () => {
    expect(ok('100', '0').points).toBe('Must be at least the minimum to redeem (500 pts), or 0 for no limit.')
  })

  it.each(['101', '-1', '12.5', '', 'abc', '1e2'])('refuses percent %j', (percent) => {
    expect(ok('0', percent).percent).toBeTruthy()
  })

  it.each(['-1', '12.5', '', 'abc'])('refuses points %j', (points) => {
    expect(ok(points, '0').points).toBeTruthy()
  })
})

describe('display helpers', () => {
  it('shows 0 as "No limit"', () => {
    expect(formatPerOrderLimit('maxRedeemPointsPerOrder', 0)).toBe('No limit')
    expect(formatPerOrderLimit('maxRedeemPercentPerOrder', 0)).toBe('No limit')
    expect(formatPerOrderLimit('maxRedeemPointsPerOrder', 20000)).toBe('20,000 pts')
    expect(formatPerOrderLimit('maxRedeemPercentPerOrder', 50)).toBe('50%')
  })

  it('treats a missing value (older VeloxVerse) as 0', () => {
    expect(limitOrZero(undefined)).toBe(0)
    expect(limitOrZero(null)).toBe(0)
    expect(limitOrZero(20000)).toBe(20000)
  })

  it('shows what the points limit is worth per currency, skipping currencies with no rate', () => {
    const rates = { INR: 10, USD: 1000, AUD: 700, GBP: null }
    expect(plain(perOrderPointsWorth(20000, rates, ['INR', 'USD', 'AUD', 'GBP']))).toBe('20,000 pts = INR 2,000.00 · USD 20.00 · AUD 28.57')
    expect(perOrderPointsWorth(0, rates, ['INR'])).toBeNull()
    expect(perOrderPointsWorth(20000, { INR: null }, ['INR'])).toBeNull()
  })

  it('labels the two audit fields and shows 0 as "No limit" only for them', () => {
    expect(pointsAuditFieldLabel('max_redeem_points_per_order')).toBe('Most points per order')
    expect(pointsAuditFieldLabel('max_redeem_percent_per_order')).toBe('Most of an order paid with points (%)')
    expect(pointsAuditFieldLabel('min_redeem_points')).toBeNull()
    expect(pointsAuditValue('max_redeem_points_per_order', '0')).toBe('No limit')
    expect(pointsAuditValue('max_redeem_percent_per_order', 0)).toBe('No limit')
    expect(pointsAuditValue('max_redeem_points_per_order', '20000')).toBe('20000')
    expect(pointsAuditValue('min_redeem_points', '0')).toBe('0')
    expect(pointsAuditValue('min_redeem_points', null)).toBe('—')
  })
})

// ── settings screen ─────────────────────────────────────────────────────────
const baseSettings = {
  id: 's1',
  pointsPerUnitRedeem: { USD: 1000, INR: 10, AUD: 700, GBP: null, EUR: null, NZD: null, BDT: null, CAD: null },
  minRedeemPoints: 500,
  maxRedeemPerDayCents: 0,
  pointsExpiryDays: 365,
  version: 3,
  updatedAt: '2026-10-12T10:00:00.000Z',
}

function mockApi(settings: Record<string, unknown>) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/admin/points/settings')) return { data: { data: { settings } } }
    if (url.endsWith('/admin/points/config')) return { data: { data: { config: [] } } }
    if (url.includes('/admin/points/audit-log')) {
      return {
        data: {
          data: {
            entries: [
              { id: 'a1', createdAt: '2026-10-12T10:00:00.000Z', adminName: 'Admin', adminEmail: null, table: 'points_settings', fieldName: 'max_redeem_points_per_order', oldValue: '0', newValue: '20000' },
              { id: 'a2', createdAt: '2026-10-12T10:01:00.000Z', adminName: 'Admin', adminEmail: null, table: 'points_settings', fieldName: 'max_redeem_percent_per_order', oldValue: '50', newValue: '0' },
            ],
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          },
        },
      }
    }
    return { data: { data: {} } }
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <VVPointsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Global Settings' }).catch(() => screen.getByText('Global Settings')))
  await screen.findByText('Limit per order')
}

describe('Points → Settings → Limit per order', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
  })

  it('treats a response without the two fields as 0 and shows "No limit"', async () => {
    mockApi(baseSettings) // older VeloxVerse: fields absent
    expect((await vvPointsService.getSettings()).maxRedeemPointsPerOrder).toBe(0)
    expect((await vvPointsService.getSettings()).maxRedeemPercentPerOrder).toBe(0)

    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    expect(screen.getByText('Most points per order')).toBeInTheDocument()
    expect(screen.getByText('Most of an order paid with points (%)')).toBeInTheDocument()
    expect(screen.getAllByText('No limit')).toHaveLength(2)
  })

  it('shows saved limits and what the points limit is worth', async () => {
    mockApi({ ...baseSettings, maxRedeemPointsPerOrder: 20000, maxRedeemPercentPerOrder: 50 })
    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    expect(screen.queryByText('No limit')).toBeNull()
    expect(screen.getByText((t) => plain(t) === '20,000 pts = USD 20.00 · AUD 28.57 · INR 2,000.00')).toBeInTheDocument()
  })

  it('refuses bad values in the form and sends nothing', async () => {
    mockApi({ ...baseSettings, maxRedeemPointsPerOrder: 0, maxRedeemPercentPerOrder: 0 })
    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    await user.click(screen.getByRole('button', { name: /edit/i }))

    const points = screen.getByLabelText('Most points per order')
    const percent = screen.getByLabelText('Most of an order paid with points (%)')
    const review = screen.getByRole('button', { name: 'Review Changes' })

    await user.clear(points)
    await user.type(points, '100')
    expect(screen.getByText('Must be at least the minimum to redeem (500 pts), or 0 for no limit.')).toBeInTheDocument()
    expect(review).toBeDisabled()

    await user.clear(points)
    await user.type(points, '0')
    for (const bad of ['101', '12.5']) {
      await user.clear(percent)
      await user.type(percent, bad)
      expect(screen.getByText('Enter a whole number from 0 to 100. 0 = no limit.')).toBeInTheDocument()
      expect(review).toBeDisabled()
    }
    expect(put).not.toHaveBeenCalled()
  })

  it('confirms, then saves only the changed limits as whole numbers', async () => {
    mockApi({ ...baseSettings, maxRedeemPointsPerOrder: 0, maxRedeemPercentPerOrder: 0 })
    put.mockResolvedValue({ data: { data: { settings: { ...baseSettings, maxRedeemPointsPerOrder: 20000, maxRedeemPercentPerOrder: 50 } } } })
    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    await user.click(screen.getByRole('button', { name: /edit/i }))

    const points = screen.getByLabelText('Most points per order')
    await user.clear(points)
    await user.type(points, '20000')
    const percent = screen.getByLabelText('Most of an order paid with points (%)')
    await user.clear(percent)
    await user.type(percent, '50')

    await user.click(screen.getByRole('button', { name: 'Review Changes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Most points per order:/)).toHaveTextContent('Most points per order: no limit→20,000 pts')
    expect(within(dialog).getByText(/Most of an order paid with points:/)).toHaveTextContent('Most of an order paid with points: no limit→50%')

    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put).toHaveBeenCalledWith('/vv-admin/admin/points/settings', { maxRedeemPointsPerOrder: 20000, maxRedeemPercentPerOrder: 50 })
  })

  it('setting a limit back to no limit sends 0, never null or an empty string', async () => {
    mockApi({ ...baseSettings, maxRedeemPointsPerOrder: 20000, maxRedeemPercentPerOrder: 50 })
    put.mockResolvedValue({ data: { data: { settings: baseSettings } } })
    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    const points = screen.getByLabelText('Most points per order')
    await user.clear(points)
    await user.type(points, '0')
    await user.click(screen.getByRole('button', { name: 'Review Changes' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(put.mock.calls[0][1]).toEqual({ maxRedeemPointsPerOrder: 0 })
  })

  it("shows VeloxVerse's 400 message next to the fields", async () => {
    mockApi({ ...baseSettings, maxRedeemPointsPerOrder: 0, maxRedeemPercentPerOrder: 0 })
    const message = "The most points per order (600) can't be lower than the minimum to redeem (1000)."
    put.mockRejectedValue({ response: { status: 400, data: { message } } })
    const user = userEvent.setup()
    renderPage()
    await openSettings(user)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    const points = screen.getByLabelText('Most points per order')
    await user.clear(points)
    await user.type(points, '600')
    await user.click(screen.getByRole('button', { name: 'Review Changes' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save Changes' }))
    // Back in the form, with the server's own words by the limit fields.
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => a.textContent === message)).toBe(true)
    expect(screen.getByLabelText('Most points per order')).toBeInTheDocument()
  })
})

describe('Points → Change Log', () => {
  it('uses the friendly labels and "No limit" for 0', async () => {
    get.mockReset()
    mockApi(baseSettings)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Change Log'))
    expect(await screen.findByText('Most points per order')).toBeInTheDocument()
    expect(screen.getByText('Most of an order paid with points (%)')).toBeInTheDocument()
    expect(screen.getAllByText('No limit')).toHaveLength(2) // old value of one row, new value of the other
    expect(screen.getByText('20000')).toBeInTheDocument()
  })
})
