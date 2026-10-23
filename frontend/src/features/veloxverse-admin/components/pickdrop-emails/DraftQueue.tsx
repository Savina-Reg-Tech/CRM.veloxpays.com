// "To review": one row (desktop) or card (phone) per open draft, soonest pickup first.
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Send } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '../vv-audit/useMediaQuery'
import { readiness, triggerHint, waitingAge } from '../../pickdropEmails'
import type { DraftSummary } from '../../types'
import { BookingStatusChip, CountdownChip, OrderNoCopy, ReadinessChip, TemplateName, isTypingTarget, useNow } from './PdUI'

function UpdatedDot({ note }: { note: string | null }) {
  if (!note) return null
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" title={note} aria-label={`Updated: ${note}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
    </span>
  )
}

function Waiting({ createdAt, now }: { createdAt: string; now: number }) {
  const w = waitingAge(createdAt, now)
  return <span className={cn('whitespace-nowrap text-xs', w.overdue ? 'font-semibold text-red-600' : 'text-gray-500')}>{w.text}</span>
}

export default function DraftQueue({
  items,
  isLoading,
  placeholders,
  onOpen,
  onQuickSend,
  onRefresh,
}: {
  items: DraftSummary[]
  isLoading: boolean
  placeholders?: { key: string; label: string }[]
  onOpen: (id: string) => void
  onQuickSend: (d: DraftSummary) => void
  onRefresh: () => void
}) {
  const isDesktop = useIsDesktop()
  const now = useNow()
  const [sel, setSel] = useState(0)
  const rowRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    if (sel >= items.length) setSel(Math.max(0, items.length - 1))
  }, [items.length, sel])

  // j / k (or ↓ / ↑) move, Enter opens, r refreshes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((s) => {
          const n = Math.min(s + 1, items.length - 1)
          rowRefs.current[n]?.scrollIntoView({ block: 'nearest' })
          return n
        })
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((s) => {
          const n = Math.max(s - 1, 0)
          rowRefs.current[n]?.scrollIntoView({ block: 'nearest' })
          return n
        })
      } else if (e.key === 'Enter' && items[sel]) {
        // Let a focused button/link do its own thing.
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'BUTTON' || tag === 'A') return
        e.preventDefault()
        onOpen(items[sel].id)
      } else if (e.key === 'r') {
        e.preventDefault()
        onRefresh()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, sel, onOpen, onRefresh])

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isDesktop) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-36 px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Email</th>
              <th className="w-56 px-4 py-3">Booking</th>
              <th className="w-44 px-4 py-3">Status</th>
              <th className="w-56 px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((d, i) => {
              const ready = readiness(d, placeholders).kind === 'ready'
              return (
                <tr
                  key={d.id}
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  onClick={() => onOpen(d.id)}
                  onMouseEnter={() => setSel(i)}
                  aria-selected={i === sel}
                  className={cn('cursor-pointer transition-colors', i === sel ? 'bg-indigo-50/60 shadow-[inset_3px_0_0_#6366f1]' : 'hover:bg-gray-50')}
                >
                  <td className="px-4 py-3 align-top">
                    <CountdownChip pickupAt={d.pickupAt} now={now} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-0 items-center gap-2">
                      <TemplateName templateKey={d.templateKey} name={d.templateName} />
                      <UpdatedDot note={d.updatedNote} />
                    </div>
                    <p className="mt-1 truncate pl-9 text-xs text-gray-500">
                      {triggerHint(d)} · <Waiting createdAt={d.createdAt} now={now} />
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OrderNoCopy orderNo={d.orderNo} className="-ml-1.5" />
                    <div className="mt-1">
                      <BookingStatusChip status={d.bookingStatus} />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ReadinessChip draft={d} placeholders={placeholders} />
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {ready && (
                        <Button size="sm" variant="outline" onClick={() => onQuickSend(d)} className="min-h-9">
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      )}
                      <Button size="sm" onClick={() => onOpen(d.id)} className="min-h-9">
                        Review <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((d, i) => {
        const ready = readiness(d, placeholders).kind === 'ready'
        return (
          <li
            key={d.id}
            ref={(el) => {
              rowRefs.current[i] = el
            }}
            className={cn(
              'flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm',
              d.bookingStatus === 'CANCELLED' ? 'border-red-200' : 'border-gray-200',
              i === sel && 'ring-2 ring-indigo-200',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CountdownChip pickupAt={d.pickupAt} now={now} />
              <ReadinessChip draft={d} placeholders={placeholders} />
            </div>
            <div className="flex items-center gap-2">
              <TemplateName templateKey={d.templateKey} name={d.templateName} className="text-base" />
              <UpdatedDot note={d.updatedNote} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OrderNoCopy orderNo={d.orderNo} className="-ml-1.5" />
              <BookingStatusChip status={d.bookingStatus} />
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
              <span>{triggerHint(d)}</span>
              <span aria-hidden>·</span>
              <Waiting createdAt={d.createdAt} now={now} />
            </p>
            {d.status === 'FAILED' && d.error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">{d.error}</p>}
            <div className="mt-auto flex gap-2">
              {ready && (
                <Button variant="outline" onClick={() => onQuickSend(d)} className="min-h-11 flex-1">
                  <Send className="h-4 w-4" /> Send
                </Button>
              )}
              <Button onClick={() => onOpen(d.id)} className="min-h-11 flex-[2]">
                Review <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
