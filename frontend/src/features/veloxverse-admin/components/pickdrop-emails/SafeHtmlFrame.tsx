import { useState } from 'react'
import { Maximize2, Minimize2, Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

// Untrusted HTML (ViaTovia's email body, the rendered customer email) is shown only here: an
// iframe with an EMPTY sandbox — no scripts, no same-origin, no forms, no popups — plus a CSP
// that blocks everything but inline styles and images. Never dangerouslySetInnerHTML.
// Images over https (the VeloxVerse logo in previews comes from the web app's /logo.png), plus
// localhost so that logo also shows against a local VeloxVerse — the same as the CRM's own CSP.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data: http://localhost:* http://127.0.0.1:*; font-src https: data:"

const BASE_STYLE =
  'html,body{margin:0;padding:0;background:#fff}' +
  'body{padding:12px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;overflow-wrap:anywhere}' +
  'img{max-width:100%;height:auto}' +
  'table{max-width:100%}'

/** Wraps the HTML in our own head; the sandbox can't be scripted, so height is fixed + scroll. */
export function wrapSrcDoc(html: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<base target="_blank"><style>${BASE_STYLE}</style></head><body>${html}</body></html>`
  )
}

type Device = 'desktop' | 'phone'

const CONTROL =
  'inline-flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'

export function SafeHtmlFrame({
  html,
  title,
  className,
  defaultExpanded = false,
  deviceToggle = false,
  heightClass,
}: {
  html: string
  title: string
  className?: string
  defaultExpanded?: boolean
  /** Desktop / Phone buttons: the phone view renders the email at a phone's width. */
  deviceToggle?: boolean
  /** Overrides the collapsed height. */
  heightClass?: string
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [device, setDevice] = useState<Device>('desktop')
  const phone = deviceToggle && device === 'phone'
  return (
    <div className={cn('relative w-full min-w-0 overflow-hidden rounded-xl border border-gray-200', phone ? 'bg-gray-100' : 'bg-white', className)}>
      <iframe
        sandbox=""
        srcDoc={wrapSrcDoc(html)}
        title={title}
        referrerPolicy="no-referrer"
        className={cn(
          'block max-w-full border-0 bg-white transition-[height,width]',
          phone ? 'mx-auto mt-12 w-[390px] rounded-t-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.08)]' : 'w-full',
          expanded ? 'h-[85vh]' : heightClass ?? 'h-[min(70vh,560px)] min-h-[260px]',
        )}
      />
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {deviceToggle && (
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white/95 shadow-sm" role="group" aria-label="Preview width">
            {(
              [
                ['desktop', 'Desktop', Monitor],
                ['phone', 'Phone', Smartphone],
              ] as const
            ).map(([d, label, Icon]) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                title={`${label} width`}
                className={cn(CONTROL, device === d ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900')}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(CONTROL, 'rounded-lg border border-gray-200 bg-white/95 text-gray-600 shadow-sm hover:bg-white hover:text-gray-900')}
          aria-label={expanded ? 'Shrink' : 'Expand'}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className={cn(deviceToggle && 'hidden sm:inline')}>{expanded ? 'Shrink' : 'Expand'}</span>
        </button>
      </div>
    </div>
  )
}
