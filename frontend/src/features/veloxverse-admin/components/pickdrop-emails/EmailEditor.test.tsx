import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { editorHtmlToStored } from '../../pickdropEmails'
import EmailEditor from './EmailEditor'

// A rebranded ViaTovia email body: headings, a detail table, a closing with a placeholder link.
const BODY =
  '<h2>Refund Request</h2>' +
  '<p>Your refund is on its way.</p>' +
  '<table><tbody>' +
  '<tr><th>Reservation</th><td><strong>VIA-1792758404-PRL</strong></td></tr>' +
  '<tr><th>Pickup</th><td><strong>2026-10-31 23:29</strong></td></tr>' +
  '</tbody></table>' +
  '<p><a target="_blank" rel="noopener noreferrer" href="{{ticketLink}}">My Bookings</a> — {{orderNo}}</p>'

/** TipTap keeps the instance on its DOM node. */
const editorOf = (container: HTMLElement) => (container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor

describe('EmailEditor tables', () => {
  it('keeps detail tables: loading and saving unchanged gives back the same HTML', async () => {
    const onChange = vi.fn()
    const { container } = render(<EmailEditor value={BODY} onChange={onChange} placeholders={[]} />)
    await waitFor(() => expect(container.querySelectorAll('.ProseMirror tr')).toHaveLength(2))
    expect(container.querySelector('.ProseMirror th')?.textContent).toBe('Reservation')
    expect(onChange).not.toHaveBeenCalled()
    expect(editorHtmlToStored(editorOf(container).getHTML())).toBe(BODY)
  })

  it('has no insert-table button', () => {
    const { queryByRole } = render(<EmailEditor value={BODY} onChange={() => {}} placeholders={[]} />)
    expect(queryByRole('button', { name: /table/i })).not.toBeInTheDocument()
  })

  it('an edited cell saves with the tables intact', async () => {
    const onChange = vi.fn()
    const { container } = render(<EmailEditor value={BODY} onChange={onChange} placeholders={[]} />)
    const ed = editorOf(container)
    ed.chain().setTextSelection(ed.state.doc.content.size - 2).insertContent(' ok').run()
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const saved: string = onChange.mock.calls.at(-1)![0]
    expect(saved).toContain('<table><tbody><tr><th>Reservation</th><td><strong>VIA-1792758404-PRL</strong></td></tr>')
    expect(saved).not.toMatch(/colgroup|style=|colspan/)
  })

  it('Delete row removes just that row', async () => {
    const onChange = vi.fn()
    const { container } = render(<EmailEditor value={BODY} onChange={onChange} placeholders={[]} />)
    const ed = editorOf(container)
    const cellPos = (n: number) => {
      let found = -1
      ed.state.doc.descendants((node, pos) => {
        if (found < 0 && node.type.name === 'tableCell' && n-- === 0) found = pos + 2
      })
      return found
    }
    ed.chain().setTextSelection(cellPos(0)).deleteRow().run()
    expect(editorHtmlToStored(ed.getHTML())).not.toContain('VIA-1792758404-PRL')
    expect(editorHtmlToStored(ed.getHTML())).toContain('<tr><th>Pickup</th>')
  })
})
