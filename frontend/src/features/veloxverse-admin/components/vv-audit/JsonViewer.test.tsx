import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ToastProvider from '@/app/providers/ToastProvider'
import { JsonViewer } from './JsonViewer'

const view = (value: unknown) => render(<ToastProvider><JsonViewer value={value} label="Response body" bytes={1229} /></ToastProvider>)

describe('JsonViewer', () => {
  it('shows "[REDACTED]" as a redacted pill and masked values in italics, as sent', () => {
    view({ card: { number: '[REDACTED]' }, email: 'j***@e***.com' })
    expect(screen.getByText('redacted')).toBeInTheDocument()
    expect(screen.queryByText(/\[REDACTED\]/)).not.toBeInTheDocument()
    const masked = screen.getByText('j***@e***.com', { exact: false })
    expect(masked.closest('.italic')).not.toBeNull()
    expect(screen.getByText(/1\.2 KB/)).toBeInTheDocument()
  })

  it('counts search matches across keys and values, opening collapsed branches, and steps through them', async () => {
    const user = userEvent.setup()
    // `deep.deeper` is below the default open depth, so its match is only visible while searching.
    const { container } = view({ status: 'cancelled', order: { deep: { deeper: { note: 'cancel again' } } }, cancelReason: 'x' })
    await user.type(screen.getByRole('searchbox'), 'cancel')
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
    expect(container.querySelectorAll('mark')).toHaveLength(3)
    expect(screen.getByText('again', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next match' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(container.querySelector('mark[data-match="1"]')?.className).toContain('bg-amber-300')
    await user.click(screen.getByRole('button', { name: 'Previous match' }))
    await user.click(screen.getByRole('button', { name: 'Previous match' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('shows the first 50 array items, then "Show N more"', async () => {
    const user = userEvent.setup()
    const items = Array.from({ length: 120 }, (_, i) => `item-${i}`)
    view({ items })
    expect(screen.getByText('item-49', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('item-50', { exact: false })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show 70 more' }))
    expect(screen.getByText('item-119', { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /more$/ })).not.toBeInTheDocument()
  })

  it('switches to the raw pretty-printed JSON', async () => {
    const user = userEvent.setup()
    const { container } = view({ a: 1, b: [true] })
    await user.click(screen.getByRole('button', { name: 'Raw' }))
    expect(container.querySelector('pre')?.textContent).toBe(JSON.stringify({ a: 1, b: [true] }, null, 2))
  })

  it('renders truncated and { text } bodies as text', () => {
    const { unmount } = view({ _truncated: true, _bytes: 48213, preview: '{"partial": tr' })
    expect(screen.getByText(/Body was 48,213 bytes — first 16 KB stored/)).toBeInTheDocument()
    expect(screen.getByText('{"partial": tr')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Raw' })).not.toBeInTheDocument()
    unmount()
    view({ text: '<html>Bad gateway</html>' })
    expect(screen.getByText('<html>Bad gateway</html>')).toBeInTheDocument()
  })
})
