// "Customer emails" on a Pick & Drop booking: everything said to the customer and by ViaTovia, in
// order, plus New email (from any template) and Refresh from ViaTovia.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownUp, Bell, ChevronDown, Inbox, PencilLine, Plus, RefreshCw, Send, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { useBookingEmails, useBookingOpenDrafts, useCreateBookingDraft, useRefreshBooking } from '../../hooks/usePickdropEmails'
import { useTemplates } from '../../hooks/useEmailTemplates'
import { draftStatusMeta, inboundTypeMeta, isOpenDraft, pdErrorText, shortDateTime, templateIcon } from '../../pickdropEmails'
import type { TimelineItem } from '../../types'
import { ToneChip } from './PdUI'
import { draftPath, inboxEmailPath } from './paths'

const ORDER_KEY = 'vv-pd-timeline-newest-first'
const SHOW_MAX = 10

function readOrderPref(): boolean {
  try {
    return localStorage.getItem(ORDER_KEY) === '1'
  } catch {
    return false
  }
}

function TimelineRow({ item, templateName, onOpen }: { item: TimelineItem; templateName: (k: string) => string; onOpen: (to: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  let icon = <Inbox className="h-4 w-4" />
  let dot = 'bg-gray-100 text-gray-500'
  let body: React.ReactNode = null
  let to: string | null = null

  switch (item.type) {
    case 'VIATOVIA_EMAIL': {
      const t = inboundTypeMeta(item.detectedType)
      to = inboxEmailPath(item.id)
      body = (
        <>
          <p className="break-words text-sm text-gray-900">
            <span className="font-medium">ViaTovia:</span> {item.subject || '(no subject)'}
          </p>
          <ToneChip tone={t.tone} className="mt-1">
            {t.label}
          </ToneChip>
        </>
      )
      break
    }
    case 'EMAIL_TO_CUSTOMER':
      if (item.status === 'SENT') {
        icon = <Send className="h-4 w-4" />
        dot = 'bg-emerald-50 text-emerald-600'
        body = (
          <p className="break-words text-sm text-gray-900">
            <span className="font-medium">Email sent:</span> {item.subject ?? item.kind}
            <span className="block text-xs text-gray-500">
              → {item.to ?? '—'} · {item.by === 'system' ? 'automatic' : `by ${item.by}`}
            </span>
          </p>
        )
      } else {
        icon = <XCircle className="h-4 w-4" />
        dot = 'bg-red-50 text-red-600'
        body = (
          <p className="break-words text-sm text-red-800">
            <span className="font-medium">Email failed:</span> {item.subject ?? item.kind}
            {item.error && <span className="block text-xs">{item.error}</span>}
          </p>
        )
      }
      break
    case 'IN_APP_NOTIFICATION':
      icon = <Bell className="h-4 w-4" />
      dot = 'bg-sky-50 text-sky-600'
      body = (
        <div className="text-sm">
          <p className="font-medium text-gray-900">{item.title}</p>
          <p className={cn('break-words text-xs text-gray-600', !expanded && 'line-clamp-2')}>{item.message}</p>
          {item.message.length > 120 && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-0.5 text-xs font-medium text-indigo-600 hover:underline">
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      )
      break
    case 'DRAFT': {
      const m = draftStatusMeta(item.status)
      const open = isOpenDraft(item)
      icon = <PencilLine className="h-4 w-4" />
      dot = open ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
      to = draftPath(item.id)
      body = (
        <div className="text-sm">
          <p className="break-words text-gray-900">
            <span className="font-medium">Draft:</span> {templateName(item.templateKey)}{' '}
            <ToneChip tone={m.tone} className="ml-1 align-middle">
              {m.label}
            </ToneChip>
          </p>
          {item.status === 'DISCARDED' && item.discardReason && <p className="text-xs text-gray-500">Reason: {item.discardReason}</p>}
        </div>
      )
      break
    }
  }

  const content = (
    <>
      <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', dot)}>{icon}</span>
      <div className="min-w-0 flex-1 pb-4">
        {body}
        <p className="mt-0.5 text-[11px] text-gray-400">{shortDateTime(item.at)}</p>
      </div>
    </>
  )
  return (
    <li className="relative flex gap-3 before:absolute before:bottom-0 before:left-4 before:top-8 before:w-px before:bg-gray-200 last:before:hidden">
      {to ? (
        <button type="button" onClick={() => onOpen(to!)} className="flex w-full gap-3 rounded-lg text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  )
}

export default function BookingEmailsCard({ orderNo, className }: { orderNo: string; className?: string }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const timeline = useBookingEmails(orderNo)
  const openDrafts = useBookingOpenDrafts(orderNo)
  const { data: tpl } = useTemplates()
  const create = useCreateBookingDraft()
  const refresh = useRefreshBooking()
  const [newestFirst, setNewestFirst] = useState(readOrderPref)
  const [showAll, setShowAll] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const toggleOrder = () => {
    setNewestFirst((v) => {
      try {
        localStorage.setItem(ORDER_KEY, v ? '0' : '1')
      } catch {
        /* preference only */
      }
      return !v
    })
  }

  const templateName = (key: string) => tpl?.templates.find((t) => t.key === key)?.name ?? key.replace(/^transfer_/, '').replace(/_/g, ' ')
  const items = timeline.data?.items ?? []
  const ordered = newestFirst ? [...items].reverse() : items
  const shown = showAll ? ordered : ordered.slice(0, SHOW_MAX)
  const waiting = openDrafts.data?.items ?? []

  const newEmail = (templateKey: string) => {
    setMenuOpen(false)
    create.mutate(
      { orderNo, templateKey },
      {
        onSuccess: (d) => navigate(draftPath(d.id)),
        onError: (err) => showToast({ type: 'error', title: 'Could not create the email', message: pdErrorText(err) }),
      },
    )
  }

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {waiting.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(draftPath(waiting[0].id))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-200"
          >
            {waiting.length} email{waiting.length === 1 ? '' : 's'} waiting — Review
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-10"
            loading={refresh.isPending}
            onClick={() =>
              refresh.mutate(
                { orderNo },
                {
                  onSuccess: (r) =>
                    showToast({ type: 'success', title: `Refreshed — ${r.draftsRefreshed} draft${r.draftsRefreshed === 1 ? '' : 's'} updated` }),
                  onError: (err) => showToast({ type: 'error', title: 'Could not refresh from ViaTovia', message: pdErrorText(err) }),
                },
              )
            }
          >
            {!refresh.isPending && <RefreshCw className="h-3.5 w-3.5" />} Refresh from ViaTovia
          </Button>
          <div ref={menuRef} className="relative">
            <Button size="sm" className="min-h-10" onClick={() => setMenuOpen((o) => !o)} loading={create.isPending} aria-expanded={menuOpen} aria-haspopup="menu">
              {!create.isPending && <Plus className="h-3.5 w-3.5" />} New email <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {menuOpen && (
              <ul role="menu" className="absolute right-0 top-11 z-30 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                {!tpl && <li className="px-3 py-2 text-sm text-gray-400">Loading templates…</li>}
                {tpl?.templates.map((t) => {
                  const Icon = templateIcon(t.key)
                  return (
                    <li key={t.key} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!t.enabled}
                        title={t.enabled ? t.description ?? undefined : 'Switched off in Email templates'}
                        onClick={() => newEmail(t.key)}
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
      </div>

      {timeline.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : timeline.error ? (
        <p className="text-sm text-red-700">{pdErrorText(timeline.error, 'Could not load the emails for this booking.')}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">No customer emails or ViaTovia emails for this booking yet.</p>
      ) : (
        <>
          <div className="flex justify-end">
            <button type="button" onClick={toggleOrder} className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
              <ArrowDownUp className="h-3.5 w-3.5" /> {newestFirst ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
          <ol>
            {shown.map((it, i) => (
              <TimelineRow key={`${it.type}-${'id' in it ? it.id : i}-${it.at}`} item={it} templateName={templateName} onOpen={(to) => navigate(to)} />
            ))}
          </ol>
          {ordered.length > SHOW_MAX && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="min-h-10 text-sm font-medium text-indigo-600 hover:underline">
              {showAll ? 'Show less' : `Show all (${ordered.length})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
