// "Send to customer" from one linked ViaTovia email: its own content rebranded as VeloxVerse, or
// one of our templates filled from it. Either way it becomes a draft and opens on the Review
// screen — nothing is sent from here.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { PD_KEYS, useCreateDraftFromInbox } from '../../hooks/usePickdropEmails'
import { useTemplates } from '../../hooks/useEmailTemplates'
import {
  SEND_REBRANDED_LABEL,
  SUPPLIER_COPY_EMOJI,
  SUPPLIER_COPY_KEY,
  USE_TEMPLATE_LABEL,
  draftStatusMeta,
  errorStatus,
  isEditedCopyConflict,
  isNotLinkedError,
  isSupplierCopy,
  pdErrorText,
  pickableTemplates,
  templateIcon,
} from '../../pickdropEmails'
import { pickdropEmailsService } from '../../vvAdminService'
import type { InboxDetail } from '../../types'
import { ToneChip } from './PdUI'
import { draftPath } from './paths'

const OFF_TITLE = 'Switched off in Email templates'

/** "Already made: <template> (<status>) — Open" for each draft this email produced. */
export function AlreadyMade({ email }: { email: InboxDetail }) {
  if (email.drafts.length === 0) return null
  return (
    <ul className="space-y-1.5" aria-label="Customer emails already made from this ViaTovia email">
      {email.drafts.map((d) => {
        const m = draftStatusMeta(d.status)
        return (
          <li key={d.id} className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
            <span className="text-gray-500">Already made:</span>
            <span className="min-w-0 truncate font-medium text-gray-900">
              {isSupplierCopy(d) && <span aria-hidden>{SUPPLIER_COPY_EMOJI} </span>}
              {d.templateName}
            </span>
            <ToneChip tone={m.tone}>{m.label}</ToneChip>
            <Link to={draftPath(d.id)} className="ml-auto inline-flex min-h-9 items-center gap-1 font-semibold text-indigo-600 hover:underline">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function InboxEmailActions({
  email,
  layout,
  onNeedsLink,
}: {
  email: InboxDetail
  /** bar = sticky row in the desktop drawer · sheet = full-width buttons in the phone sheet footer */
  layout: 'bar' | 'sheet'
  /** 409 "Link this email to a booking first" — open the Link control. */
  onNeedsLink: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { data: tpl, isLoading: tplLoading } = useTemplates()
  const create = useCreateDraftFromInbox()
  const [clicked, setClicked] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const supplierTpl = tpl?.templates.find((t) => t.key === SUPPLIER_COPY_KEY)
  // Unknown until the list loads — don't block on it; the server refuses a switched-off template.
  const rebrandOff = supplierTpl?.enabled === false
  const templates = pickableTemplates(tpl?.templates)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [menuOpen])

  const openEditedCopy = async () => {
    try {
      const open = await pickdropEmailsService.listDrafts({ orderNo: email.orderNo ?? '', open: true, limit: 20 })
      const copy = open.items.find(isSupplierCopy)
      if (copy) navigate(draftPath(copy.id))
      else showToast({ type: 'info', title: 'That email is no longer open', message: 'Try again — it may have just been sent or discarded.' })
    } catch (err) {
      showToast({ type: 'error', title: 'Could not open it', message: pdErrorText(err) })
    }
  }

  const make = (templateKey: string) => {
    // Double clicks (and a second button) are ignored while one request runs.
    if (create.isPending) return
    setMenuOpen(false)
    setClicked(templateKey)
    create.mutate(
      { id: email.id, templateKey },
      {
        onSettled: () => setClicked(null),
        onError: (err) => {
          if (isEditedCopyConflict(err)) {
            showToast({ type: 'error', title: 'Already being edited', message: pdErrorText(err), action: { label: 'Open it', onClick: () => void openEditedCopy() } })
          } else if (isNotLinkedError(err)) {
            showToast({ type: 'error', title: 'Not linked to a booking', message: pdErrorText(err) })
            onNeedsLink()
          } else if (errorStatus(err) === 404) {
            showToast({ type: 'error', title: 'Could not create the email', message: pdErrorText(err) })
            void qc.invalidateQueries({ queryKey: PD_KEYS.inbox() })
            void qc.invalidateQueries({ queryKey: PD_KEYS.inboxItem(email.id) })
          } else {
            showToast({ type: 'error', title: 'Could not create the email', message: pdErrorText(err) })
          }
        },
      },
    )
  }

  const sheet = layout === 'sheet'
  const busy = create.isPending
  const btn =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed'

  return (
    <div className={cn('flex gap-2', sheet ? 'flex-col' : 'flex-wrap items-center')}>
      <span title={rebrandOff ? OFF_TITLE : undefined} className={cn(sheet && 'w-full')}>
        <button
          type="button"
          onClick={() => make(SUPPLIER_COPY_KEY)}
          disabled={rebrandOff || busy}
          aria-busy={clicked === SUPPLIER_COPY_KEY}
          className={cn(btn, 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300', sheet && 'w-full')}
        >
          {clicked === SUPPLIER_COPY_KEY ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>{SUPPLIER_COPY_EMOJI}</span>}
          {SEND_REBRANDED_LABEL}
        </button>
      </span>

      <div ref={menuRef} className={cn('relative', sheet && 'w-full')}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={busy}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={cn(btn, 'border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60', sheet && 'w-full')}
        >
          {clicked && clicked !== SUPPLIER_COPY_KEY && <Loader2 className="h-4 w-4 animate-spin" />}
          {USE_TEMPLATE_LABEL}
          <ChevronDown className={cn('h-4 w-4 transition-transform', menuOpen && 'rotate-180')} />
        </button>
        {menuOpen && (
          <ul
            role="menu"
            aria-label="Templates"
            className={cn(
              'absolute z-30 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl',
              sheet ? 'inset-x-0 bottom-full mb-2' : 'left-0 top-full mt-1.5 w-[min(18rem,calc(100vw-3rem))]',
            )}
          >
            {tplLoading && <li className="px-3 py-2 text-sm text-gray-400">Loading templates…</li>}
            {!tplLoading && templates.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No templates</li>}
            {templates.map((t) => {
              const Icon = templateIcon(t.key)
              return (
                <li key={t.key} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!t.enabled}
                    title={t.enabled ? t.description ?? undefined : OFF_TITLE}
                    onClick={() => make(t.key)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {!t.enabled && <span className="text-[11px] text-gray-500">off</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
