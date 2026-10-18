// Request / response body viewer for the API-log drawer: a small recursive tree (no JSON
// library), a Raw view, copy, and in-body search. Values are shown exactly as VeloxVerse stored
// them — "[REDACTED]" becomes a grey "redacted" pill, masked values (containing "***") are
// italic. Bodies live only in React state here: never logged, never written to storage.
import { createContext, useCallback, useContext, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import FocusTrap from 'focus-trap-react'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Maximize2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes, isTruncatedBody, textBody } from '../../audit'
import { useCopy } from './ApiBits'

/** Containers above this depth start open (root = 0, its children = 1). */
const OPEN_DEPTH = 2
/** Array items shown before "Show N more". */
const ARRAY_PAGE = 50
const REDACTED = '[REDACTED]'
const SEP = '\u0000'

type Mode = 'tree' | 'raw'

const isContainer = (v: unknown): v is unknown[] | Record<string, unknown> => v !== null && typeof v === 'object'
const childPath = (path: string, key: string | number) => `${path}${SEP}${key}`

/** Text a leaf shows (and is searched by): strings without quotes, the pill text for redactions. */
function leafText(v: unknown): string {
  if (v === REDACTED) return 'redacted'
  if (typeof v === 'string') return v
  if (v === undefined) return 'undefined'
  return JSON.stringify(v)
}

function countIn(hay: string, needle: string): number {
  if (!needle) return 0
  const h = hay.toLowerCase()
  let n = 0
  for (let i = h.indexOf(needle); i !== -1; i = h.indexOf(needle, i + needle.length)) n++
  return n
}

// ── Search index ────────────────────────────────────────────────────
interface TreeIndex {
  total: number
  /** `${path}${SEP}k|v` → global index of its first match. */
  offsets: Map<string, number>
  /** Containers holding a match — opened while searching. */
  open: Set<string>
  /** Array path → items that must be visible to show its matches. */
  needShown: Map<string, number>
}

/** One walk in render order (key, then value), so match numbers follow what's on screen. */
function indexTree(root: unknown, needle: string): TreeIndex {
  const idx: TreeIndex = { total: 0, offsets: new Map(), open: new Set(), needShown: new Map() }
  if (!needle) return idx
  const stack: Array<{ path: string; childIndex: number; isArray: boolean }> = []
  const hit = (slot: string, n: number) => {
    if (!n) return
    idx.offsets.set(slot, idx.total)
    idx.total += n
    for (const a of stack) {
      idx.open.add(a.path)
      if (a.isArray) idx.needShown.set(a.path, Math.max(idx.needShown.get(a.path) ?? 0, a.childIndex + 1))
    }
  }
  const walk = (v: unknown, path: string) => {
    if (!isContainer(v)) {
      hit(`${path}${SEP}v`, countIn(leafText(v), needle))
      return
    }
    const isArray = Array.isArray(v)
    const frame = { path, childIndex: 0, isArray }
    stack.push(frame)
    const entries: Array<[string | number, unknown]> = isArray ? v.map((c, i) => [i, c]) : Object.entries(v)
    entries.forEach(([k, c], i) => {
      frame.childIndex = i
      const p = childPath(path, k)
      if (!isArray) hit(`${p}${SEP}k`, countIn(String(k), needle))
      walk(c, p)
    })
    stack.pop()
  }
  walk(root, '')
  return idx
}

/** Text with each occurrence of `needle` wrapped in a numbered <mark>. */
function Highlighted({ text, needle, start, current }: { text: string; needle: string; start: number | undefined; current: number }) {
  if (!needle || start === undefined) return <>{text}</>
  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let from = 0
  let n = start
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
    if (i > from) out.push(text.slice(from, i))
    out.push(
      <mark key={i} data-match={n} className={cn('rounded-sm text-inherit', n === current ? 'bg-amber-300 ring-1 ring-amber-500' : 'bg-yellow-100')}>
        {text.slice(i, i + needle.length)}
      </mark>
    )
    n++
    from = i + needle.length
  }
  if (from < text.length) out.push(text.slice(from))
  return <>{out}</>
}

// ── Tree ────────────────────────────────────────────────────────────
interface TreeCtx {
  needle: string
  current: number
  index: TreeIndex
  overrides: Map<string, boolean>
  shown: Map<string, number>
  toggle: (path: string, open: boolean) => void
  showAll: (path: string, n: number) => void
}
const Ctx = createContext<TreeCtx | null>(null)

function Leaf({ value, path }: { value: unknown; path: string }) {
  const { needle, current, index } = useContext(Ctx)!
  const start = index.offsets.get(`${path}${SEP}v`)
  if (value === REDACTED) {
    return (
      <span
        data-match={start}
        title="Removed before storage"
        className={cn(
          'inline-flex items-center rounded-full bg-gray-200 px-2 py-px font-sans text-[11px] font-semibold text-gray-700',
          start !== undefined && (start === current ? 'ring-2 ring-amber-500' : 'ring-2 ring-yellow-300')
        )}
      >
        redacted
      </span>
    )
  }
  const text = leafText(value)
  const hl = <Highlighted text={text} needle={needle} start={start} current={current} />
  if (typeof value === 'string') {
    return (
      <span className={cn('break-all text-emerald-800', value.includes('***') && 'italic')} title={value.includes('***') ? 'Masked value' : undefined}>
        &quot;{hl}&quot;
      </span>
    )
  }
  const tone = typeof value === 'number' ? 'text-sky-700' : typeof value === 'boolean' ? 'text-purple-700' : 'text-gray-400'
  return <span className={cn('break-all', tone)}>{hl}</span>
}

function KeyLabel({ name, path, isIndex }: { name: string | number; path: string; isIndex: boolean }) {
  const { needle, current, index } = useContext(Ctx)!
  if (isIndex) return <span className="shrink-0 text-gray-400">{name}:</span>
  return (
    <span className="break-all font-medium text-gray-800">
      <Highlighted text={String(name)} needle={needle} start={index.offsets.get(`${path}${SEP}k`)} current={current} />:
    </span>
  )
}

function Node({ name, value, path, depth, isIndex = false }: { name?: string | number; value: unknown; path: string; depth: number; isIndex?: boolean }) {
  const ctx = useContext(Ctx)!
  if (!isContainer(value)) {
    return (
      <div className="flex min-w-0 items-baseline gap-1.5 py-0.5 pl-5">
        {name !== undefined && <KeyLabel name={name} path={path} isIndex={isIndex} />}
        <span className="min-w-0"><Leaf value={value} path={path} /></span>
      </div>
    )
  }

  const isArray = Array.isArray(value)
  const size = isArray ? value.length : Object.keys(value).length
  const open = ctx.overrides.get(path) ?? (ctx.index.open.has(path) || depth < OPEN_DEPTH)
  const [o, c] = isArray ? ['[', ']'] : ['{', '}']
  const summary = isArray ? `${size} item${size === 1 ? '' : 's'}` : `${size} key${size === 1 ? '' : 's'}`

  if (size === 0) {
    return (
      <div className="flex min-w-0 items-baseline gap-1.5 py-0.5 pl-5">
        {name !== undefined && <KeyLabel name={name} path={path} isIndex={isIndex} />}
        <span className="text-gray-500">{o}{c}</span>
      </div>
    )
  }

  const limit = isArray ? Math.max(ctx.shown.get(path) ?? ARRAY_PAGE, ctx.index.needShown.get(path) ?? 0) : Infinity
  const entries: Array<[string | number, unknown]> = isArray
    ? value.slice(0, limit).map((v, i) => [i, v])
    : Object.entries(value)
  const hidden = isArray ? Math.max(0, size - limit) : 0

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => ctx.toggle(path, !open)}
        className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:min-h-7"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
        {name !== undefined && <KeyLabel name={name} path={path} isIndex={isIndex} />}
        <span className="text-gray-500">{o}</span>
        {!open && <span className="text-gray-400">… {c} <span className="font-sans text-[11px]">{summary}</span></span>}
      </button>
      {open && (
        <>
          {/* 12px per level on phones, 16px from md. */}
          <div className="ml-2 border-l border-gray-100 pl-3 md:pl-4">
            {entries.map(([k, v]) => (
              <Node key={k} name={k} value={v} path={childPath(path, k)} depth={depth + 1} isIndex={isArray} />
            ))}
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => ctx.showAll(path, size)}
                className="my-1 inline-flex min-h-11 items-center rounded-lg px-2 font-sans text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 md:min-h-8"
              >
                Show {hidden} more
              </button>
            )}
          </div>
          <div className="pl-5 text-gray-500">{c}</div>
        </>
      )}
    </div>
  )
}

// ── Viewer ──────────────────────────────────────────────────────────
type Body =
  | { kind: 'json'; value: unknown; raw: string }
  | { kind: 'text'; text: string; truncatedBytes?: number }

function toBody(value: unknown): Body {
  if (isTruncatedBody(value)) return { kind: 'text', text: String(value.preview ?? ''), truncatedBytes: value._bytes }
  const text = textBody(value)
  if (text !== null) return { kind: 'text', text }
  return { kind: 'json', value, raw: value === undefined ? '' : JSON.stringify(value, null, 2) }
}

const toolBtn =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:min-h-9'

function CopyRaw({ text }: { text: string }) {
  const copy = useCopy()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={toolBtn}
      onClick={() =>
        void copy(text, 'Body').then((ok) => {
          if (!ok) return
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      Copy raw
    </button>
  )
}

function ViewerBody({ value, label, bytes, fullscreen = false, onExpand }: JsonViewerProps & { fullscreen?: boolean; onExpand?: () => void }) {
  const body = useMemo(() => toBody(value), [value])
  const [mode, setMode] = useState<Mode>('tree')
  const [query, setQuery] = useState('')
  const needle = useDeferredValue(query.trim().toLowerCase())
  const [current, setCurrent] = useState(0)
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map())
  const [shown, setShown] = useState<Map<string, number>>(() => new Map())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const searchId = useId()

  const plainText = body.kind === 'json' ? body.raw : body.text
  const treeMode = body.kind === 'json' && mode === 'tree'
  const index = useMemo(() => (treeMode && body.kind === 'json' ? indexTree(body.value, needle) : null), [treeMode, body, needle])
  const total = index ? index.total : countIn(plainText, needle)

  // A new search starts at the first match and lets matching branches open again.
  useEffect(() => {
    setCurrent(0)
    setOverrides(new Map())
  }, [needle, mode])

  useEffect(() => {
    if (!needle || !total) return
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-match="${current}"]`)
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [current, needle, total, mode])

  const step = (d: 1 | -1) => total && setCurrent((c) => (c + d + total) % total)

  const ctx: TreeCtx | null = index
    ? {
        needle,
        current,
        index,
        overrides,
        shown,
        toggle: (p, open) => setOverrides((m) => new Map(m).set(p, open)),
        showAll: (p, n) => setShown((m) => new Map(m).set(p, n)),
      }
    : null

  const size = bytes != null ? formatBytes(bytes) : null

  return (
    <div className={cn('min-w-0', fullscreen ? 'flex min-h-0 flex-1 flex-col gap-2' : 'space-y-2')}>
      {(label || size) && !fullscreen && (
        <p className="text-xs text-gray-500">
          {label && <span className="font-medium text-gray-700">{label}</span>}
          {label && size && ' · '}
          {size}
        </p>
      )}

      {body.kind === 'text' && body.truncatedBytes !== undefined && (
        <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Body was {body.truncatedBytes.toLocaleString('en-GB')} bytes — first 16 KB stored (preview below)
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {body.kind === 'json' && (
          <div role="group" aria-label="View" className="inline-flex shrink-0 rounded-lg border border-gray-200 p-0.5">
            {(['tree', 'raw'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:min-h-8',
                  mode === m ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {m === 'tree' ? 'Tree' : 'Raw'}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 basis-48 items-center gap-1">
          <label htmlFor={searchId} className="sr-only">Search {label?.toLowerCase() ?? 'body'}</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  step(e.shiftKey ? -1 : 1)
                }
              }}
              placeholder="Search…"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:h-9 md:text-sm"
            />
          </div>
          {needle && (
            <>
              <span aria-live="polite" className="shrink-0 whitespace-nowrap px-1 text-xs tabular-nums text-gray-500">
                {total ? `${current + 1} / ${total}` : 'No matches'}
              </span>
              <button type="button" aria-label="Previous match" disabled={!total} onClick={() => step(-1)} className={cn(toolBtn, 'w-11 px-0 disabled:opacity-40 md:w-9')}>
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Next match" disabled={!total} onClick={() => step(1)} className={cn(toolBtn, 'w-11 px-0 disabled:opacity-40 md:w-9')}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <CopyRaw text={plainText} />
        {onExpand && (
          <button type="button" onClick={onExpand} className={cn(toolBtn, 'md:hidden')}>
            <Maximize2 className="h-4 w-4" aria-hidden="true" /> Expand
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'min-w-0 overflow-auto overscroll-contain rounded-lg border border-gray-200 bg-gray-50/60 p-2 font-mono text-xs text-gray-800 md:p-3 md:text-[13px]',
          fullscreen ? 'min-h-0 flex-1' : 'max-h-[50vh] md:max-h-[60vh]'
        )}
      >
        {ctx ? (
          <Ctx.Provider value={ctx}>
            <Node value={(body as { value: unknown }).value} path="" depth={0} />
          </Ctx.Provider>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-xs md:text-[13px]">
            <Highlighted text={plainText} needle={needle} start={needle ? 0 : undefined} current={current} />
          </pre>
        )}
      </div>
    </div>
  )
}

/** Full-screen copy of the body (phones): its own toolbar, search and copy. */
function FullScreenBody({ title, onClose, ...props }: JsonViewerProps & { title: string; onClose: () => void }) {
  const titleId = useId()
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Capture phase + preventDefault: Esc closes this view only, not the drawer under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])
  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[75] flex flex-col bg-white">
        <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-1 py-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close full screen"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-gray-900">{title}</h2>
          {props.bytes != null && <span className="ml-auto shrink-0 pr-3 text-xs text-gray-500">{formatBytes(props.bytes)}</span>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <ViewerBody {...props} fullscreen />
        </div>
      </div>
    </FocusTrap>
  )
}

export interface JsonViewerProps {
  /** A stored body: JSON, `{ text }` for non-JSON, or the truncated-body shape. */
  value: unknown
  /** "Request body" / "Response body" — shown above and used as the full-screen title. */
  label?: string
  /** Stored size, shown as "1.2 KB". */
  bytes?: number | null
}

export function JsonViewer({ value, label, bytes }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const close = useCallback(() => setExpanded(false), [])
  return (
    <>
      <ViewerBody value={value} label={label} bytes={bytes} onExpand={() => setExpanded(true)} />
      {expanded && <FullScreenBody value={value} label={label} bytes={bytes} title={label ?? 'Body'} onClose={close} />}
    </>
  )
}
