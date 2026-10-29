import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import ToastProvider from '@/app/providers/ToastProvider'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/features/auth/authService'
import type { User } from '@/types'
import OnboardingProvider from './OnboardingProvider'
import { useOnboarding } from './onboardingContext'
import { onboardingService } from './onboardingService'
import { CURRENT_TOUR_VERSION } from './tourConfig'

// jsdom has no layout, so focus-trap can't find tabbable nodes — trapping isn't under test here.
vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))

const staff = (over: Partial<User> = {}): User => ({
  id: 1, name: 'Sam', email: 'sam@example.com', role: 'admin', is_active: true, account_status: 'active', ...over,
})

function Page({ name }: { name: string }) {
  const navigate = useNavigate()
  const { openGuide } = useOnboarding()
  return (
    <div>
      <h1>{name}</h1>
      <button onClick={() => navigate('/dashboard/customers')}>go elsewhere</button>
      <button onClick={() => openGuide()}>open guide</button>
    </div>
  )
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <OnboardingProvider>
            <Outlet />
          </OnboardingProvider>
        ),
        children: [
          { path: '/dashboard/admin', element: <Page name="Admin home" /> },
          { path: '/dashboard/me', element: <Page name="My home" /> },
          { path: '/dashboard/customers', element: <Page name="Customers" /> },
          { path: '/dashboard/veloxverse/audit-logs', element: <Page name="Audit" /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return router
}

const tourDialog = () => screen.queryByRole('dialog', { name: 'Welcome to Velox CRM' })
const save = () => vi.mocked(onboardingService.saveTourResult)

beforeEach(() => {
  vi.spyOn(onboardingService, 'saveTourResult').mockResolvedValue({ tour_status: 'completed', tour_version: 1, tour_seen_at: 'now' })
})

afterEach(() => {
  queryClient.clear()
  useAuthStore.setState({ user: null })
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function signedIn(fromMe: Partial<User>, persisted: Partial<User> = {}) {
  useAuthStore.setState({ user: staff(persisted) })
  return vi.spyOn(authService, 'getMe').mockResolvedValue(staff(fromMe))
}

describe('welcome tour', () => {
  it('starts on the home page for new staff; Skip saves "dismissed" for the current version', async () => {
    signedIn({ tour_status: null, tour_version: null })
    renderAt('/dashboard/admin')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(tourDialog()).not.toBeInTheDocument()
    expect(save()).toHaveBeenCalledWith('dismissed', CURRENT_TOUR_VERSION)
  })

  it('Esc dismisses; Finish completes', async () => {
    signedIn({ tour_status: null })
    renderAt('/dashboard/admin')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(save()).toHaveBeenLastCalledWith('dismissed', CURRENT_TOUR_VERSION)

    queryClient.clear()
    document.body.innerHTML = ''
    signedIn({ id: 2, tour_status: null }, { id: 2 })
    renderAt('/dashboard/admin')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
    // In jsdom no target is on screen, so only the centred welcome step remains.
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(save()).toHaveBeenLastCalledWith('completed', CURRENT_TOUR_VERSION)
  })

  it('uses the fresh /auth/me copy, not the persisted profile', async () => {
    signedIn({ tour_status: 'completed', tour_version: CURRENT_TOUR_VERSION }, { tour_status: null })
    renderAt('/dashboard/admin')
    await new Promise((r) => setTimeout(r, 1200))
    expect(tourDialog()).not.toBeInTheDocument()
  })

  it.each([
    ['not_offered staff', { tour_status: 'not_offered' as const }, '/dashboard/admin', {}],
    ['a page other than home', { tour_status: null }, '/dashboard/customers', {}],
    ['agent (switched off)', { role: 'agent' as const, tour_status: null }, '/dashboard/me', { role: 'agent' as const }],
  ])('does not start for %s', async (_label, fromMe, path, persisted) => {
    signedIn(fromMe, persisted)
    renderAt(path)
    await new Promise((r) => setTimeout(r, 1200))
    expect(tourDialog()).not.toBeInTheDocument()
  })

  it('starts for support staff on their home page', async () => {
    signedIn({ role: 'support', tour_status: null }, { role: 'support' })
    renderAt('/dashboard/veloxverse/audit-logs')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
  })

  it('waits while a dialog is open', async () => {
    signedIn({ tour_status: null })
    const blocker = document.createElement('div')
    blocker.setAttribute('role', 'dialog')
    document.body.appendChild(blocker)
    renderAt('/dashboard/admin')
    await new Promise((r) => setTimeout(r, 1200))
    expect(tourDialog()).not.toBeInTheDocument()
    blocker.remove()
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
  })

  it('waits while the Quick Guide is open', async () => {
    signedIn({ tour_status: null })
    renderAt('/dashboard/admin?guide=getting-around')
    await new Promise((r) => setTimeout(r, 1200))
    expect(tourDialog()).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' }) // closes the guide
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
  })

  it('a route change mid-tour ends it and saves nothing', async () => {
    signedIn({ tour_status: null })
    const router = renderAt('/dashboard/admin')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
    await act(() => router.navigate('/dashboard/customers'))
    expect(tourDialog()).not.toBeInTheDocument()
    expect(save()).not.toHaveBeenCalled()
  })

  it('sign-out or an expired session mid-tour ends it and saves nothing', async () => {
    signedIn({ tour_status: null })
    renderAt('/dashboard/admin')
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
    act(() => useAuthStore.getState().clearAuth()) // what both Sign out and the 401 handler call
    expect(tourDialog()).not.toBeInTheDocument()
    expect(save()).not.toHaveBeenCalled()
  })

  it('a failed /auth/me never starts the tour', async () => {
    useAuthStore.setState({ user: staff() })
    vi.spyOn(authService, 'getMe').mockRejectedValue({ response: { status: 401 } })
    renderAt('/dashboard/admin')
    await new Promise((r) => setTimeout(r, 1200))
    expect(tourDialog()).not.toBeInTheDocument()
  })
})

describe('Quick Guide', () => {
  const guide = () => screen.queryByRole('dialog', { name: 'Quick Guide' })
  const expandedTopics = () => screen.queryAllByRole('button', { expanded: true })

  it('?guide=<visible id> opens the guide with that topic expanded', async () => {
    signedIn({ tour_status: 'completed', tour_version: CURRENT_TOUR_VERSION }, { role: 'employee' })
    renderAt('/dashboard/customers?guide=staff')
    await waitFor(() => expect(guide()).toBeInTheDocument())
    expect(expandedTopics().map((b) => b.textContent)).toEqual([expect.stringContaining('Users: your team and their roles')])
    expect(screen.getByRole('link', { name: /Go to Users/ })).toHaveAttribute('href', '/dashboard/employees')
  })

  it('?guide=<unknown id> opens the guide with nothing expanded', async () => {
    signedIn({}, { role: 'employee' })
    renderAt('/dashboard/customers?guide=no-such-topic')
    await waitFor(() => expect(guide()).toBeInTheDocument())
    expect(expandedTopics()).toHaveLength(0)
    expect(document.body.textContent).not.toContain('no-such-topic')
  })

  it('?guide=<id the role cannot see> opens with nothing expanded and never shows that topic', async () => {
    signedIn({}, { role: 'support' })
    renderAt('/dashboard/veloxverse/audit-logs?guide=payments')
    await waitFor(() => expect(guide()).toBeInTheDocument())
    expect(expandedTopics()).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/Every payment, its details and a CSV report|guide=payments/)
    // Support only sees its own topics.
    expect(screen.getByText('Audit Logs: what happened to a customer')).toBeInTheDocument()
    expect(screen.queryByText('Customers')).not.toBeInTheDocument()
  })

  it('removes ?guide from the URL once opened', async () => {
    signedIn({}, { role: 'employee' })
    const router = renderAt('/dashboard/customers?guide=customers&search=bob')
    await waitFor(() => expect(guide()).toBeInTheDocument())
    expect(router.state.location.search).toBe('?search=bob')
  })

  it('opens from the context, toggles topics, and closes on Esc', async () => {
    signedIn({}, { role: 'employee' })
    renderAt('/dashboard/customers')
    fireEvent.click(screen.getByRole('button', { name: 'open guide' }))
    await waitFor(() => expect(guide()).toBeInTheDocument())
    const topic = screen.getByRole('button', { name: /^Customers/ })
    fireEvent.click(topic)
    expect(topic).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Search by name, email, phone, city/)).toBeInTheDocument()
    fireEvent.click(topic)
    expect(topic).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(guide()).not.toBeInTheDocument()
  })

  it('"Replay welcome tour" goes home and runs the tour (even for roles without the auto-tour)', async () => {
    signedIn({ role: 'agent', tour_status: null }, { role: 'agent' })
    const router = renderAt('/dashboard/customers?guide=customers')
    await waitFor(() => expect(guide()).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Replay welcome tour/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/me'))
    await waitFor(() => expect(tourDialog()).toBeInTheDocument(), { timeout: 3000 })
  })
})
