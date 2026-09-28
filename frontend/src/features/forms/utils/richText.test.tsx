import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineLinks } from './richText'

const CONSENT =
  "I agree to VeloxVerse sharing my details. Also I accept VeloxVerse's " +
  '[Terms & Conditions](https://veloxverse.com/terms) and [Privacy Policy](https://veloxverse.com/privacy).'

describe('InlineLinks', () => {
  it('renders consent text and its links as ONE inline element inside a flex label', () => {
    const { container } = render(
      <label className="flex items-start gap-2">
        <input type="checkbox" />
        <InlineLinks text={CONSENT} />
      </label>
    )
    // Exactly two flex items (checkbox + one text run) — the bug was one flex item per text chunk/link.
    const label = container.querySelector('label')!
    expect(label.children).toHaveLength(2)
    expect(label.children[1].tagName).toBe('SPAN')
    expect(label.children[1].textContent).toBe(
      "I agree to VeloxVerse sharing my details. Also I accept VeloxVerse's Terms & Conditions and Privacy Policy."
    )
  })

  it('turns [label](url) into links opening in a new tab', () => {
    render(<InlineLinks text={CONSENT} />)
    const terms = screen.getByRole('link', { name: 'Terms & Conditions' })
    expect(terms).toHaveAttribute('href', 'https://veloxverse.com/terms')
    expect(terms).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://veloxverse.com/privacy')
  })
})
