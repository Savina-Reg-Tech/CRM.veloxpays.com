import { useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Untrusted HTML (ViaTovia's email body, the rendered customer email) is shown only here: an
// iframe with an EMPTY sandbox — no scripts, no same-origin, no forms, no popups — plus a CSP
// that blocks everything but inline styles and images. Never dangerouslySetInnerHTML.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:"

const BASE_STYLE =
  'html,body{margin:0;padding:0;background:#fff}' +
  'body{padding:12px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;overflow-wrap:anywhere}' +
  'img{max-width:100%;height:auto}'

/** Wraps the HTML in our own head; the sandbox can't be scripted, so height is fixed + scroll. */
export function wrapSrcDoc(html: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<base target="_blank"><style>${BASE_STYLE}</style></head><body>${html}</body></html>`
  )
}

export function SafeHtmlFrame({
  html,
  title,
  className,
  defaultExpanded = false,
}: {
  html: string
  title: string
  className?: string
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className={cn('relative w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      <iframe
        sandbox=""
        srcDoc={wrapSrcDoc(html)}
        title={title}
        referrerPolicy="no-referrer"
        className={cn('block w-full max-w-full border-0 transition-[height]', expanded ? 'h-[85vh]' : 'h-[min(70vh,560px)] min-h-[260px]')}
      />
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 px-2.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={expanded ? 'Shrink' : 'Expand'}
      >
        {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {expanded ? 'Shrink' : 'Expand'}
      </button>
    </div>
  )
}
