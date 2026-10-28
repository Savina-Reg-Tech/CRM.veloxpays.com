import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import ToastProvider from '@/app/providers/ToastProvider'
import type { AvailabilityItem, AvailabilityOverview, AvailabilityRule } from '../../types'

const svc = vi.hoisted(() => ({
  overview: vi.fn(),
  updateRule: vi.fn(),
  preview: vi.fn(),
  changes: vi.fn(),
  getCustomerCountry: vi.fn(),
  setCustomerCountry: vi.fn(),
}))

// jsdom has no layout, so focus-trap can't find tabbable nodes — trapping isn't under test here.
vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('../../vvAdminService', () => ({ vvAvailabilityService: svc }))

const { default: VVCountryAvailabilityPage } = await import('../../pages/VVCountryAvailabilityPage')

function rule(key: string, p: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    serviceKey: key, mode: 'all_countries', countries: [], blockedDisplay: 'hidden', unknownCountryPolicy: 'allow',
    strictIpCheck: false, message: null, version: 1, updatedBy: null, updatedAt: '2026-10-28T08:01:33.446Z', ...p,
  }
}
function item(key: string, label: string, p: Partial<AvailabilityItem> = {}): AvailabilityItem {
  return { key, label, kind: 'service', group: 'VeloxAssist', parentKey: null, rule: rule(key), ...p }
}

const OVERVIEW: AvailabilityOverview = {
  enforced: false,
  items: [
    item('velox-assist', 'VeloxAssist'),
    item('velox-assist.pick-drop', 'Pick & Drop', {
      kind: 'sub-service', parentKey: 'velox-assist',
      rule: rule('velox-assist.pick-drop', { mode: 'allow_list', countries: ['AU', 'NZ'], blockedDisplay: 'coming-soon', version: 3 }),
    }),
    item('velox-credit', 'VeloxCredit', { group: 'VeloxCredit' }),
  ],
  countries: [
    { code: 'AU', name: 'Australia' },
    { code: 'IN', name: 'India' },
    { code: 'NZ', name: 'New Zealand' },
  ],
  modes: ['all_countries', 'allow_list', 'deny_list', 'disabled'],
  blockedDisplays: ['hidden', 'coming-soon', 'register-interest'],
  unknownCountryPolicies: ['allow', 'block'],
}

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/dashboard/veloxverse/country-availability', element: <VVCountryAvailabilityPage /> }], {
    initialEntries: [url],
  })
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  )
  return router
}

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset())
  svc.overview.mockResolvedValue(OVERVIEW)
  svc.changes.mockResolvedValue([])
})

describe('Country Availability page', () => {
  it('shows the not-live banner and one card per group with the rule in words', async () => {
    renderAt('/dashboard/veloxverse/country-availability')
    expect(await screen.findByText(/Rules are saved but not live yet/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'VeloxAssist' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'VeloxCredit' })).toBeInTheDocument()
    expect(screen.getByText('Only in')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '1 of 3 restricted')).toBeInTheDocument()
  })

  it('?rule= opens the panel; changing the mode updates the summary and saves with expectedVersion', async () => {
    const user = userEvent.setup()
    svc.updateRule.mockResolvedValue(rule('velox-assist.pick-drop', { mode: 'disabled', version: 4 }))
    const router = renderAt('/dashboard/veloxverse/country-availability?rule=velox-assist.pick-drop')

    const dialog = await screen.findByRole('dialog', { name: 'Pick & Drop' })
    expect(within(dialog).getByText(/Customers who live in or are currently in Australia and New Zealand can use Pick & Drop/)).toBeInTheDocument()
    const save = within(dialog).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    await user.click(within(dialog).getByLabelText(/No one \(switch it off\)/))
    expect(within(dialog).getByText(/Pick & Drop is switched off for everyone and shown as 'Coming soon'/)).toBeInTheDocument()
    await user.click(save)

    await waitFor(() => expect(svc.updateRule).toHaveBeenCalled())
    expect(svc.updateRule).toHaveBeenCalledWith('velox-assist.pick-drop', expect.objectContaining({ mode: 'disabled', countries: [], expectedVersion: 3 }))
    await waitFor(() => expect(router.state.location.search).not.toContain('rule='))
  })

  it('keeps the panel open and reloads on a 409', async () => {
    const user = userEvent.setup()
    svc.updateRule.mockRejectedValue({ response: { status: 409, data: { message: 'Version conflict' } } })
    renderAt('/dashboard/veloxverse/country-availability?rule=velox-credit')

    const dialog = await screen.findByRole('dialog', { name: 'VeloxCredit' })
    await user.click(within(dialog).getByLabelText(/No one \(switch it off\)/))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Someone else changed this rule')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'VeloxCredit' })).toBeInTheDocument()
    await waitFor(() => expect(svc.overview.mock.calls.length).toBeGreaterThan(1))
  })

  it('asks before switching off a parent and names its parts', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard/veloxverse/country-availability?rule=velox-assist')
    const dialog = await screen.findByRole('dialog', { name: 'VeloxAssist' })
    await user.click(within(dialog).getByLabelText(/No one \(switch it off\)/))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('This also switches off Pick & Drop for every customer.')).toBeInTheDocument()
    expect(svc.updateRule).not.toHaveBeenCalled()
  })

  it('previews a country and explains a block', async () => {
    svc.preview.mockResolvedValue({
      country: 'IN',
      services: {
        'velox-assist': { available: true, display: 'show' },
        'velox-assist.pick-drop': { available: false, display: 'coming-soon', blockedBy: 'velox-assist.pick-drop' },
        'velox-credit': { available: true, display: 'show' },
      },
    })
    renderAt('/dashboard/veloxverse/country-availability?tab=preview&country=IN')
    expect(await screen.findByText('India:')).toBeInTheDocument()
    expect(screen.getByText(/2 available, 1 not available/)).toBeInTheDocument()
    expect(svc.preview).toHaveBeenCalledWith('IN')
    expect(screen.getByText(/Not live yet/)).toBeInTheDocument()
  })

  it('shows the change history in words', async () => {
    svc.changes.mockResolvedValue([
      {
        id: 'c1', entity: 'rule', entityId: 'velox-assist.pick-drop',
        before: { mode: 'all_countries', countries: [], blockedDisplay: 'hidden' },
        after: { mode: 'allow_list', countries: ['AU', 'NZ'], blockedDisplay: 'coming-soon' },
        actorId: 'u1', actorEmail: 'admin@veloxverse.com', actorRole: 'ADMIN', reason: 'Client: launch in ANZ first', createdAt: '2026-10-28T09:12:00Z',
      },
    ])
    renderAt('/dashboard/veloxverse/country-availability?tab=history')
    expect(await screen.findByText('admin@veloxverse.com')).toBeInTheDocument()
    expect(screen.getByText('Only in Australia, New Zealand')).toBeInTheDocument()
    expect(screen.getByText(/Client: launch in ANZ first/)).toBeInTheDocument()
  })
})
