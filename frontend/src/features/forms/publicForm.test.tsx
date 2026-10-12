import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { safeLinkUrl } from './utils/url'
import { parseInlineLinks } from './utils/richText'
import PublicFormPage, { uploadProblem } from './pages/PublicFormPage'

describe('safeLinkUrl', () => {
  it.each([
    ['https://example.com/thanks', 'https://example.com/thanks'],
    ['http://example.com', 'http://example.com'],
    ['/thank-you', '/thank-you'],
    ['  https://example.com  ', 'https://example.com'],
    ['//example.com/x', 'https://example.com/x'],
  ])('allows %j', (input, out) => {
    expect(safeLinkUrl(input)).toBe(out)
  })

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', '', null, undefined])(
    'refuses %j',
    (input) => {
      expect(safeLinkUrl(input)).toBeNull()
    }
  )

  it('allows mailto / tel only for plain links, never for redirects', () => {
    expect(safeLinkUrl('mailto:a@b.c')).toBeNull()
    expect(safeLinkUrl('mailto:a@b.c', { allowContact: true })).toBe('mailto:a@b.c')
    expect(safeLinkUrl('tel:+123', { allowContact: true })).toBe('tel:+123')
    expect(safeLinkUrl('javascript:alert(1)', { allowContact: true })).toBeNull()
  })
})

describe('inline links', () => {
  it('renders a normal link as a link', () => {
    render(<p>{parseInlineLinks('I agree to the [Terms](https://example.com/terms).')}</p>)
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', 'https://example.com/terms')
  })

  it('renders a javascript: link as plain text', () => {
    render(<p>{parseInlineLinks('Click [here](javascript:alert(1)) now')}</p>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/Click here/)).toBeInTheDocument()
  })
})

describe('uploadProblem', () => {
  it('accepts the supported types up to 10 MB', () => {
    expect(uploadProblem({ name: 'cv.pdf', type: 'application/pdf', size: 1024 })).toBeNull()
    expect(uploadProblem({ name: 'cv.docx', type: '', size: 1024 })).toBeNull()
  })
  it('rejects other types and oversized files with a clear message', () => {
    expect(uploadProblem({ name: 'x.exe', type: 'application/x-msdownload', size: 10 })).toMatch(/not accepted/)
    expect(uploadProblem({ name: 'x.zip', type: '', size: 10 })).toMatch(/not accepted/)
    expect(uploadProblem({ name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toMatch(/too large/)
  })
})

describe('PublicFormPage — file chosen on an earlier step', () => {
  afterEach(() => vi.unstubAllGlobals())

  const form = {
    id: 5,
    name: 'Apply',
    description: null,
    submit_button_label: 'Send',
    success_message: 'Thanks',
    form_json: {
      fields: [
        { id: 'cv', type: 'file', label: 'Your CV', required: true },
        { id: 'fullname', type: 'text', label: 'Full name', required: true },
      ],
      steps: [
        { id: 's1', title: 'Documents', fieldIds: ['cv'] },
        { id: 's2', title: 'About you', fieldIds: ['fullname'] },
      ],
    },
  }

  it('shows the attached file and still sends it when submitting on the last step', async () => {
    let posted: FormData | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posted = init.body as FormData
          return { json: async () => ({ success: true, data: {} }) }
        }
        return { ok: true, json: async () => ({ success: true, data: form }) }
      })
    )

    render(
      <MemoryRouter initialEntries={['/embed/5']}>
        <Routes>
          <Route path="/embed/:id" element={<PublicFormPage />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const input = (await screen.findByLabelText('Your CV')) as HTMLInputElement
    expect(input).toHaveAttribute('accept')

    const cv = new File(['%PDF-1.4'], 'my-cv.pdf', { type: 'application/pdf' })
    await user.upload(input, cv)
    // The visitor can see that it is attached.
    expect(await screen.findByText(/my-cv\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/attached/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(await screen.findByRole('textbox'), 'Jane Doe')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(posted).toBeDefined())
    const sent = posted!.get('cv')
    expect(sent).toBeInstanceOf(File)
    expect((sent as File).name).toBe('my-cv.pdf')
    expect(JSON.parse(posted!.get('payload') as string).data.fullname).toBe('Jane Doe')
  })

  it('refuses an unsupported file with a message and attaches nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: form }) })))
    render(
      <MemoryRouter initialEntries={['/embed/5']}>
        <Routes>
          <Route path="/embed/:id" element={<PublicFormPage />} />
        </Routes>
      </MemoryRouter>
    )
    const input = (await screen.findByLabelText('Your CV')) as HTMLInputElement
    // applyAccept: false — simulate a visitor forcing a file past the picker's filter.
    await userEvent.setup({ applyAccept: false }).upload(input, new File(['MZ'], 'tool.exe', { type: 'application/x-msdownload' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not accepted/)
    expect(screen.queryByText(/attached/)).toBeNull()
  })
})
