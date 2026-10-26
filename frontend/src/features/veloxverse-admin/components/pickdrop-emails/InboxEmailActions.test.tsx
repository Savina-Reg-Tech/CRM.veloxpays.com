import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryRouter, useParams } from 'react-router-dom'
import ToastProvider from '@/app/providers/ToastProvider'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
import type { EmailTemplate, InboxDetail } from '../../types'

const svc = vi.hoisted(() => ({
  getInbox: vi.fn(),
  createDraftFromInbox: vi.fn(),
  listDrafts: vi.fn(),
  listInbox: vi.fn(),
}))
const tplSvc = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('focus-trap-react', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('../../vvAdminService', () => ({ pickdropEmailsService: svc, emailTemplatesService: tplSvc }))

const { default: InboxDrawer } = await import('./InboxDrawer')

function tpl(key: string, name: string, enabled = true): EmailTemplate {
  return {
    id: key,
    key,
    service: 'assist_transfer',
    name,
    description: null,
    subject: '',
    bodyHtml: '',
    requiredFields: [],
    enabled,
    version: 1,
    updatedByUserId: null,
    updatedAt: '2026-10-01T00:00:00Z',
  }
}

function email(over: Partial<InboxDetail> = {}): InboxDetail {
  return {
    id: 'in1',
    receivedAt: '2026-10-25T10:00:00Z',
    from: 'operation@viatovia.com',
    subject: '[Booking Refunded] VIA-1792758404-PRL',
    detectedType: 'CANCELLED',
    status: 'MATCHED',
    orderNo: 'TRF-1',
    reservationNo: 'VIA-1792758404-PRL',
    matchMethod: 'ORDER_TAG',
    senderVerified: true,
    mismatches: [],
    attachmentCount: 0,
    error: null,
    handledNote: 'No customer email needed for this kind of ViaTovia email',
    handledBy: null,
    handledAt: null,
    to: null,
    bodyHtml: '<p>Refunded</p>',
    bodyText: null,
    extracted: null,
    attachments: [],
    drafts: [],
    candidates: [],
    ...over,
  }
}

function DraftPage() {
  return <p>review {useParams().id}</p>
}

function renderDrawer(data: InboxDetail, onLink = vi.fn()) {
  svc.getInbox.mockResolvedValue(data)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/', element: <InboxDrawer emailId={data.id} onClose={() => {}} onLink={onLink} onIgnore={() => {}} /> },
      { path: '/dashboard/veloxverse/pickdrop/emails/drafts/:id', element: <DraftPage /> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onLink }
}

const signIn = (role: string) => useAuthStore.setState({ user: { id: 1, name: 'Ops', email: 'ops@example.com', role } as unknown as User })
const conflict = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { message } } })

beforeEach(() => {
  vi.clearAllMocks()
  signIn('admin')
  tplSvc.list.mockResolvedValue({
    templates: [
      tpl('transfer_ride_approved', 'Ride approved'),
      tpl('transfer_general_message', 'General message'),
      tpl('transfer_driver_changed', 'Driver changed', false),
      tpl('transfer_supplier_copy', 'ViaTovia email (rebranded)'),
    ],
    placeholders: [],
  })
})
afterEach(() => useAuthStore.setState({ user: null }))

describe('ViaTovia inbox drawer — send to customer', () => {
  it('rebrands a cancelled email and opens Review; the banner says it can still be sent', async () => {
    svc.createDraftFromInbox.mockResolvedValue({ id: 'd9', orderNo: 'TRF-1' })
    renderDrawer(email())
    const btn = await screen.findByRole('button', { name: /send to customer \(rebranded\)/i })
    expect(screen.getByText(/our automatic email already covers this/i)).toBeInTheDocument()
    await userEvent.click(btn)
    await screen.findByText('review d9')
    expect(svc.createDraftFromInbox).toHaveBeenCalledWith('in1', 'transfer_supplier_copy')
  })

  it('ignores a second click while the first is running', async () => {
    let resolve: (v: unknown) => void = () => {}
    svc.createDraftFromInbox.mockReturnValue(new Promise((r) => (resolve = r)))
    renderDrawer(email())
    const btn = await screen.findByRole('button', { name: /send to customer \(rebranded\)/i })
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(svc.createDraftFromInbox).toHaveBeenCalledTimes(1)
    resolve({ id: 'd9', orderNo: 'TRF-1' })
    await screen.findByText('review d9')
  })

  it('"Use a template…" lists templates without the rebranded one; switched-off ones are disabled', async () => {
    svc.createDraftFromInbox.mockResolvedValue({ id: 'd2', orderNo: 'TRF-1' })
    renderDrawer(email())
    await userEvent.click(await screen.findByRole('button', { name: /use a template/i }))
    const menu = await screen.findByRole('menu', { name: 'Templates' })
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: /general message/i })).toBeInTheDocument())
    expect(within(menu).queryByRole('menuitem', { name: /rebranded/i })).not.toBeInTheDocument()
    const off = within(menu).getByRole('menuitem', { name: /driver changed/i })
    expect(off).toBeDisabled()
    expect(off).toHaveAttribute('title', 'Switched off in Email templates')
    await userEvent.click(within(menu).getByRole('menuitem', { name: /general message/i }))
    await screen.findByText('review d2')
    expect(svc.createDraftFromInbox).toHaveBeenCalledWith('in1', 'transfer_general_message')
  })

  it('disables the rebrand button when its template is switched off', async () => {
    tplSvc.list.mockResolvedValue({ templates: [tpl('transfer_supplier_copy', 'ViaTovia email (rebranded)', false)], placeholders: [] })
    renderDrawer(email())
    await waitFor(() => expect(screen.getByRole('button', { name: /send to customer \(rebranded\)/i })).toBeDisabled())
    expect(screen.getByTitle('Switched off in Email templates')).toBeInTheDocument()
  })

  it('409 on an edited copy → toast with "Open it" that opens the open rebranded draft', async () => {
    svc.createDraftFromInbox.mockRejectedValue(
      conflict(409, 'Another rebranded ViaTovia email for this booking is being edited — send or discard it first'),
    )
    svc.listDrafts.mockResolvedValue({ items: [{ id: 'd1', templateKey: 'transfer_ride_approved' }, { id: 'd7', templateKey: 'transfer_supplier_copy' }], total: 2 })
    renderDrawer(email())
    await userEvent.click(await screen.findByRole('button', { name: /send to customer \(rebranded\)/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open it' }))
    await screen.findByText('review d7')
    expect(svc.listDrafts).toHaveBeenCalledWith({ orderNo: 'TRF-1', open: true, limit: 20 })
  })

  it('409 "link first" opens the Link control', async () => {
    svc.createDraftFromInbox.mockRejectedValue(conflict(409, 'Link this email to a booking first'))
    const { onLink } = renderDrawer(email())
    await userEvent.click(await screen.findByRole('button', { name: /send to customer \(rebranded\)/i }))
    await waitFor(() => expect(onLink).toHaveBeenCalled())
  })

  it('lists drafts already made from the email above the buttons', async () => {
    renderDrawer(email({ status: 'DRAFTED', drafts: [{ id: 'd5', templateKey: 'transfer_supplier_copy', templateName: 'ViaTovia email (rebranded)', status: 'DRAFT' } as InboxDetail['drafts'][number]] }))
    expect(await screen.findByText('Already made:')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/dashboard/veloxverse/pickdrop/emails/drafts/d5')
    expect(screen.getByRole('button', { name: /send to customer \(rebranded\)/i })).toBeEnabled()
  })

  it('no actions for an unmatched email', async () => {
    renderDrawer(email({ status: 'UNMATCHED', orderNo: null }))
    await screen.findByText('[Booking Refunded] VIA-1792758404-PRL')
    expect(screen.queryByRole('button', { name: /send to customer/i })).not.toBeInTheDocument()
  })

  it('no actions for the support role', async () => {
    signIn('support')
    renderDrawer(email())
    await screen.findByText('[Booking Refunded] VIA-1792758404-PRL')
    expect(screen.queryByRole('button', { name: /send to customer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /use a template/i })).not.toBeInTheDocument()
  })
})
