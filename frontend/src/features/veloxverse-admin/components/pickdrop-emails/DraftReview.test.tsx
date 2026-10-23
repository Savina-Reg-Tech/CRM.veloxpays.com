import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter, useParams } from 'react-router-dom'
import ToastProvider from '@/app/providers/ToastProvider'
import type { DraftDetail, DraftSummary } from '../../types'

const svc = vi.hoisted(() => ({
  listDrafts: vi.fn(),
  getDraft: vi.fn(),
  editDraft: vi.fn(),
  sendDraft: vi.fn(),
  resendDraft: vi.fn(),
  discardDraft: vi.fn(),
  listInbox: vi.fn(),
  getInbox: vi.fn(),
  linkInbox: vi.fn(),
  ignoreInbox: vi.fn(),
  downloadAttachment: vi.fn(),
  syncInbox: vi.fn(),
  createBookingDraft: vi.fn(),
  refreshBooking: vi.fn(),
  bookingTimeline: vi.fn(),
}))

// jsdom has no layout, so focus-trap can't find tabbable nodes — trapping isn't under test here.
vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))

vi.mock('../../vvAdminService', () => ({
  pickdropEmailsService: svc,
  emailTemplatesService: {
    list: vi.fn().mockResolvedValue({
      templates: [],
      placeholders: [
        { key: 'driverName', label: 'Driver name', sample: 'Ravi' },
        { key: 'driverPhone', label: 'Driver phone', sample: '+61' },
      ],
    }),
  },
}))

const { default: DraftReview } = await import('./DraftReview')
const { SafeHtmlFrame } = await import('./SafeHtmlFrame')

function detail(over: Partial<DraftDetail> = {}): DraftDetail {
  return {
    id: 'd1',
    orderNo: 'TRF-1',
    templateKey: 'transfer_driver_details',
    templateName: 'Driver details',
    trigger: 'EMAIL',
    status: 'DRAFT',
    subject: 'Your driver {{driverName}}',
    missing: ['driverPhone'],
    attachVoucher: false,
    sourceEmailId: null,
    pickupAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    bookingStatus: 'APPROVED',
    updatedNote: null,
    createdAt: new Date().toISOString(),
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
    values: { driverName: 'Ravi' },
    adminValues: {},
    requiredFields: ['driverName', 'driverPhone'],
    placeholders: [
      { key: 'driverName', label: 'Driver name' },
      { key: 'driverPhone', label: 'Driver phone' },
    ],
    preview: { to: 'asha@example.com', subject: 'Your driver Ravi', html: '<p>Hi</p>', text: 'Hi', missing: ['driverPhone'], voucher: null },
    sourceEmail: null,
    booking: null,
    ...over,
  }
}

const summary = (id: string): DraftSummary => {
  const { bodyHtml: _b, values: _v, adminValues: _a, requiredFields: _r, placeholders: _p, preview: _pr, sourceEmail: _s, booking: _bk, ...rest } = detail({ id })
  return rest
}

function ReviewRoute() {
  const { id = '' } = useParams()
  return <DraftReview key={id} id={id} />
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/dashboard/veloxverse/pickdrop/emails/drafts/:id', element: <ReviewRoute /> },
      { path: '/dashboard/veloxverse/pickdrop/emails', element: <p>Queue page</p> },
    ],
    { initialEntries: ['/dashboard/veloxverse/pickdrop/emails/drafts/d1'] },
  )
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  svc.listDrafts.mockResolvedValue({ items: [summary('d1'), summary('d2')], total: 2, page: 1, limit: 100 })
  svc.getDraft.mockImplementation(async (id: string) => detail({ id }))
})

describe('DraftReview', () => {
  it('blocks Send while a field is missing, autosaves the fill-in, then sends and opens the next draft', async () => {
    const user = userEvent.setup()
    const filled = detail({ adminValues: { driverPhone: '+61 400 000 000' }, missing: [], preview: { ...detail().preview, missing: [] } })
    // Like the server: once saved, a fetch returns the saved draft.
    let saved = false
    svc.getDraft.mockImplementation(async (id: string) => (id === 'd1' && saved ? filled : detail({ id })))
    svc.editDraft.mockImplementation(async () => {
      saved = true
      return filled
    })
    svc.sendDraft.mockResolvedValue({ ...filled, status: 'SENT', sentTo: 'asha@example.com', sendCount: 1 })

    const router = setup()
    expect(await screen.findByText('1 missing')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: /send email/i })
    expect(send).toBeDisabled()

    await user.type(screen.getByLabelText(/driver phone/i, { selector: '#fill-driverPhone' }), '+61 400 000 000')
    await waitFor(() => expect(svc.editDraft).toHaveBeenCalled(), { timeout: 3000 })
    expect(svc.editDraft.mock.calls.at(-1)).toEqual(['d1', { values: { driverPhone: '+61 400 000 000' } }])

    await waitFor(() => expect(screen.getByRole('button', { name: /send email/i })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /send email/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('asha@example.com')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^send/i }))

    await waitFor(() => expect(svc.sendDraft).toHaveBeenCalledWith('d1', {}))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/veloxverse/pickdrop/emails/drafts/d2'))
  })

  it('shows test mode as information, not an error', async () => {
    const user = userEvent.setup()
    const ready = detail({ missing: [], preview: { ...detail().preview, missing: [] } })
    svc.getDraft.mockResolvedValue(ready)
    svc.sendDraft.mockRejectedValue({ response: { status: 403, data: { success: false, message: 'Test mode: only allow-listed customers get emails' } } })

    setup()
    await user.click(await screen.findByRole('button', { name: /send email/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^send/i }))
    expect(await screen.findByText(/only test accounts receive emails/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('asks again before sending about a cancelled ride', async () => {
    const user = userEvent.setup()
    const ready = detail({ missing: [], preview: { ...detail().preview, missing: [] } })
    svc.getDraft.mockResolvedValue(ready)
    svc.sendDraft
      .mockRejectedValueOnce({ response: { status: 409, data: { message: 'This ride is cancelled — confirm to send anyway', errors: { needsConfirmation: 'confirmCancelled' } } } })
      .mockResolvedValueOnce({ ...ready, status: 'SENT', sentTo: 'asha@example.com' })

    setup()
    await user.click(await screen.findByRole('button', { name: /send email/i }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^send/i }))
    await user.click(await screen.findByRole('button', { name: /send anyway/i }))
    await waitFor(() => expect(svc.sendDraft).toHaveBeenLastCalledWith('d1', { confirmCancelled: true }))
  })

  it('opens a sent email read-only with Resend', async () => {
    svc.getDraft.mockResolvedValue(detail({ status: 'SENT', sentBy: 'ops@veloxverse.com', sentAt: new Date().toISOString(), sentTo: 'asha@example.com', sendCount: 1 }))
    setup()
    expect(await screen.findByText(/Sent by ops@veloxverse.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend/i })).toBeEnabled()
    expect(screen.queryByLabelText(/^subject$/i)).not.toBeInTheDocument()
  })
})

describe('SafeHtmlFrame', () => {
  it('renders untrusted HTML in a fully sandboxed iframe', () => {
    render(<SafeHtmlFrame html={'<script>alert(1)</script><p>Hi</p>'} title="x" />)
    const frame = screen.getByTitle('x')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'")
  })
})
