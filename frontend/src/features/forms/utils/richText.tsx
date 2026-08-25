import type { ReactNode } from 'react'

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

/**
 * Parses a small Markdown-link subset — `[label](url)` — out of otherwise
 * plain text, rendering matches as real clickable links and leaving
 * everything else as plain text. Lets an admin write something like
 * "I agree to the [Terms of Service](https://…) and [Privacy Policy](https://…)"
 * as a single checkbox/radio option and have both links render wherever
 * they typed them — no rigid two-URL-field UI, any wording/order works.
 */
export function parseInlineLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  LINK_PATTERN.lastIndex = 0
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const [, label, url] = match
    nodes.push(
      <a
        key={`link-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    )
    lastIndex = LINK_PATTERN.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes.length > 0 ? nodes : [text]
}
