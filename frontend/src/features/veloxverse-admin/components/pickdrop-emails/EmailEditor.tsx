// Rich-text editor for customer emails and templates. TipTap with only what VeloxVerse keeps
// (bold/italic/underline, H2/H3, lists, links, rule) plus placeholder chips: {{key}} in the stored
// HTML shows as a non-editable chip with the field's label — red while it has no value.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type ReactNodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes, nodePasteRule, nodeInputRule } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Braces,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Search,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { chipsToPlaceholders, isAllowedEmailLink, placeholderLabel, placeholdersToChips } from '../../pickdropEmails'

// ── Chip state shared with the node views ───────────────────────────
interface ChipMeta {
  placeholders: { key: string; label: string }[]
  /** Keys still without a value — red chips. */
  missing: ReadonlySet<string>
  /** When set, chips for keys not in it are green (has a value); otherwise neutral. */
  filled?: ReadonlySet<string>
}

const ChipMetaContext = createContext<ChipMeta>({ placeholders: [], missing: new Set() })

export function chipTone(key: string, meta: ChipMeta): 'unknown' | 'missing' | 'filled' | 'neutral' {
  if (meta.placeholders.length > 0 && !meta.placeholders.some((p) => p.key === key)) return 'unknown'
  if (meta.missing.has(key)) return 'missing'
  if (meta.filled?.has(key)) return 'filled'
  return 'neutral'
}

const CHIP_CLASS = {
  unknown: 'bg-red-100 text-red-800 ring-red-300 line-through decoration-red-400',
  missing: 'bg-red-50 text-red-700 ring-red-300',
  filled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  neutral: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
} as const

export function PlaceholderChip({ placeholderKey, meta, selected }: { placeholderKey: string; meta: ChipMeta; selected?: boolean }) {
  const tone = chipTone(placeholderKey, meta)
  const label = tone === 'unknown' ? `{{${placeholderKey}}}` : placeholderLabel(placeholderKey, meta.placeholders)
  const title =
    tone === 'unknown'
      ? `Unknown field {{${placeholderKey}}} — it won't be filled in`
      : tone === 'missing'
        ? `{{${placeholderKey}}} — no value yet`
        : `{{${placeholderKey}}}`
  return (
    <span
      title={title}
      className={cn(
        'mx-0.5 inline-flex items-center gap-1 rounded-full px-2 py-px align-baseline text-[0.85em] font-medium ring-1 ring-inset whitespace-nowrap select-none',
        CHIP_CLASS[tone],
        selected && 'ring-2 ring-indigo-500',
      )}
    >
      <Braces className="h-3 w-3 opacity-60" aria-hidden />
      {label}
    </span>
  )
}

function ChipView({ node, selected }: ReactNodeViewProps) {
  const meta = useContext(ChipMetaContext)
  return (
    <NodeViewWrapper as="span" className="inline" data-placeholder={node.attrs.key}>
      <PlaceholderChip placeholderKey={String(node.attrs.key)} meta={meta} selected={selected} />
    </NodeViewWrapper>
  )
}

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

const PlaceholderNode = Node.create({
  name: 'placeholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-placeholder'),
        renderHTML: (attrs) => ({ 'data-placeholder': attrs.key }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-placeholder]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes)]
  },
  renderText({ node }) {
    return `{{${node.attrs.key}}}`
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChipView)
  },
  addPasteRules() {
    return [nodePasteRule({ find: TOKEN, type: this.type, getAttributes: (m) => ({ key: m[1] }) })]
  },
  addInputRules() {
    return [nodeInputRule({ find: /\{\{\s*([A-Za-z0-9_]+)\s*\}\}$/, type: this.type, getAttributes: (m) => ({ key: m[1] }) })]
  },
})

// ── Insert-field menu (shared with the subject input) ───────────────
export function InsertFieldMenu({
  placeholders,
  open,
  onOpenChange,
  onPick,
  meta,
  align = 'left',
  buttonClassName,
}: {
  placeholders: { key: string; label: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (key: string) => void
  meta?: ChipMeta
  align?: 'left' | 'right'
  buttonClassName?: string
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? placeholders.filter((p) => p.label.toLowerCase().includes(s) || p.key.toLowerCase().includes(s)) : placeholders
  }, [placeholders, q])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onOpenChange])

  const pick = (key: string) => {
    onOpenChange(false)
    onPick(key)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          buttonClassName,
        )}
        title="Insert field (or type {{ )"
      >
        <Braces className="h-3.5 w-3.5" />
        Insert field
      </button>
      {open && (
        <div
          className={cn(
            'absolute top-11 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-2 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, list.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (list[active]) pick(list[active].key)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  onOpenChange(false)
                }
              }}
              placeholder="Search fields…"
              aria-label="Search fields"
              className="h-9 w-full rounded-lg border border-gray-300 pl-8 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {list.length === 0 && <li className="px-2 py-3 text-center text-sm text-gray-400">No field matches</li>}
            {list.map((p, i) => {
              const tone = meta ? chipTone(p.key, meta) : 'neutral'
              return (
                <li key={p.key} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(p.key)}
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                      i === active ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.label}</span>
                      <span className="block truncate font-mono text-[11px] text-gray-400">{`{{${p.key}}}`}</span>
                    </span>
                    {tone === 'missing' && <span className="shrink-0 text-[11px] font-medium text-red-600">no value</span>}
                    {tone === 'filled' && <span className="shrink-0 text-[11px] font-medium text-emerald-600">filled</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Editor ──────────────────────────────────────────────────────────
function ToolButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40',
        active ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      {children}
    </button>
  )
}

export interface EmailEditorProps {
  /** Stored HTML, with {{key}} placeholders. */
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholders: { key: string; label: string }[]
  missing?: ReadonlySet<string>
  filled?: ReadonlySet<string>
  disabled?: boolean
  invalid?: boolean
  ariaLabel?: string
  minHeightClass?: string
}

export default function EmailEditor({
  value,
  onChange,
  onBlur,
  placeholders,
  missing = new Set(),
  filled,
  disabled = false,
  invalid = false,
  ariaLabel = 'Email body',
  minHeightClass = 'min-h-[220px]',
}: EmailEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const lastEmitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onBlurRef = useRef(onBlur)
  onBlurRef.current = onBlur
  const openMenuRef = useRef(() => setMenuOpen(true))

  const editor = useEditor({
    editable: !disabled,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['mailto', 'tel'],
          isAllowedUri: (url) => isAllowedEmailLink(url),
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      PlaceholderNode,
    ],
    content: placeholdersToChips(value),
    editorProps: {
      attributes: {
        class: cn('prose-email max-w-none px-3 py-3 text-sm text-gray-900 focus:outline-none', minHeightClass),
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
      },
      // Typing "{{" opens the field menu instead of inserting the braces.
      handleTextInput(view, from, to, text) {
        if (text !== '{') return false
        const before = view.state.doc.textBetween(Math.max(0, from - 1), from)
        if (before !== '{') return false
        view.dispatch(view.state.tr.delete(from - 1, to))
        openMenuRef.current()
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = chipsToPlaceholders(ed.getHTML())
      lastEmitted.current = html
      onChangeRef.current(html)
    },
    onBlur: () => onBlurRef.current?.(),
  })

  // Reload from the server's (cleaned) copy when it differs from what we last had, keeping the cursor.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    lastEmitted.current = value
    const { from, to } = editor.state.selection
    editor.commands.setContent(placeholdersToChips(value), { emitUpdate: false })
    if (editor.isFocused) {
      const size = editor.state.doc.content.size
      editor.commands.setTextSelection({ from: Math.min(from, size), to: Math.min(to, size) })
    }
  }, [editor, value])

  // setEditable emits an update by default — that would autosave the body unchanged (or empty).
  useEffect(() => {
    if (editor && editor.isEditable === disabled) editor.setEditable(!disabled, false)
  }, [editor, disabled])

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            underline: ed.isActive('underline'),
            h2: ed.isActive('heading', { level: 2 }),
            h3: ed.isActive('heading', { level: 3 }),
            ul: ed.isActive('bulletList'),
            ol: ed.isActive('orderedList'),
            link: ed.isActive('link'),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
          }
        : null,
  })

  const meta = useMemo<ChipMeta>(() => ({ placeholders, missing, filled }), [placeholders, missing, filled])

  const insertField = (key: string) => {
    editor?.chain().focus().insertContent({ type: 'placeholder', attrs: { key } }).run()
  }

  const openLink = () => {
    if (!editor) return
    setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '')
    setLinkError('')
    setLinkOpen(true)
  }

  const applyLink = () => {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      return
    }
    if (!isAllowedEmailLink(url)) {
      setLinkError('Use an https://, mailto: or tel: link, or a field such as {{ticketLink}}.')
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
    } else {
      chain.setLink({ href: url }).run()
    }
    setLinkOpen(false)
  }

  const s = state ?? { bold: false, italic: false, underline: false, h2: false, h3: false, ul: false, ol: false, link: false, canUndo: false, canRedo: false }

  return (
    <ChipMetaContext.Provider value={meta}>
      <div
        className={cn(
          'rounded-xl border bg-white focus-within:ring-2',
          invalid ? 'border-red-400 focus-within:ring-red-100' : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-100',
          disabled && 'bg-gray-50',
        )}
      >
        {!disabled && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1.5 py-1.5">
            <div className="order-last ml-auto pl-1 sm:order-none">
              <InsertFieldMenu
                placeholders={placeholders}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                onPick={insertField}
                meta={meta}
                align="right"
              />
            </div>
            <ToolButton label="Bold" active={s.bold} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Italic" active={s.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Underline" active={s.underline} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon className="h-4 w-4" />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
            <ToolButton label="Heading" active={s.h2} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Subheading" active={s.h3} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Bullet list" active={s.ul} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Numbered list" active={s.ol} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="h-4 w-4" />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
            <ToolButton label="Link" active={s.link} onClick={openLink}>
              <Link2 className="h-4 w-4" />
            </ToolButton>
            {s.link && (
              <ToolButton label="Remove link" onClick={() => editor?.chain().focus().extendMarkRange('link').unsetLink().run()}>
                <Unlink className="h-4 w-4" />
              </ToolButton>
            )}
            <ToolButton label="Divider line" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <Minus className="h-4 w-4" />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
            <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
              <Undo2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
              <Redo2 className="h-4 w-4" />
            </ToolButton>
          </div>
        )}
        {linkOpen && (
          <form
            className="flex flex-wrap items-start gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2"
            onSubmit={(e) => {
              e.preventDefault()
              applyLink()
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value)
                  setLinkError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    setLinkOpen(false)
                  }
                }}
                placeholder="https://…, mailto:…, tel:… or {{ticketLink}}"
                aria-label="Link address"
                className="h-9 w-full rounded-lg border border-gray-300 px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {linkError && <p className="mt-1 text-xs text-red-600">{linkError}</p>}
            </div>
            <button type="submit" className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">
              {linkUrl.trim() ? 'Apply' : 'Remove'}
            </button>
            <button type="button" onClick={() => setLinkOpen(false)} className="h-9 rounded-lg px-3 text-xs font-medium text-gray-600 hover:bg-gray-200">
              Cancel
            </button>
          </form>
        )}
        <EditorContent editor={editor} />
      </div>
    </ChipMetaContext.Provider>
  )
}
