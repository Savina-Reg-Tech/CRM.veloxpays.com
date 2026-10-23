// ViaTovia emails as cards/rows. Shared by the Unmatched tab and the full inbox tab.
import { AlertTriangle, ChevronRight, EyeOff, Link2, Paperclip } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '../vv-audit/useMediaQuery'
import { MATCH_METHOD_LABEL, inboundStatusMeta, inboundTypeMeta, shortDateTime } from '../../pickdropEmails'
import type { InboxSummary } from '../../types'
import { ToneChip } from './PdUI'

function Sender({ e }: { e: InboxSummary }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {!e.senderVerified && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Sender not verified" />}
      <span className="truncate">{e.from ?? 'Unknown sender'}</span>
    </span>
  )
}

export default function InboxList({
  items,
  isLoading,
  mode,
  onOpen,
  onLink,
  onIgnore,
}: {
  items: InboxSummary[]
  isLoading: boolean
  /** "unmatched" shows Link / Ignore on every row. */
  mode: 'unmatched' | 'all'
  onOpen: (e: InboxSummary) => void
  onLink?: (e: InboxSummary) => void
  onIgnore?: (e: InboxSummary) => void
}) {
  const isDesktop = useIsDesktop()
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const actions = (e: InboxSummary, full = false) =>
    (mode === 'unmatched' || e.status === 'UNMATCHED' || e.status === 'NEW') && onLink && onIgnore ? (
      <div className={cn('flex gap-2', full && 'w-full')} onClick={(ev) => ev.stopPropagation()}>
        <Button size={full ? 'md' : 'sm'} onClick={() => onLink(e)} className={cn(full ? 'min-h-11 flex-[2]' : 'min-h-9')}>
          <Link2 className="h-4 w-4" /> Link
        </Button>
        <Button size={full ? 'md' : 'sm'} variant="outline" onClick={() => onIgnore(e)} className={cn(full ? 'min-h-11 flex-1' : 'min-h-9')}>
          <EyeOff className="h-4 w-4" /> Ignore
        </Button>
      </div>
    ) : null

  if (isDesktop) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-32 px-4 py-3">Received</th>
              <th className="px-4 py-3">Email</th>
              <th className="w-52 px-4 py-3">{mode === 'unmatched' ? 'Reservation' : 'Booking'}</th>
              <th className="w-56 px-4 py-3">{mode === 'unmatched' ? '' : 'Outcome'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((e) => {
              const type = inboundTypeMeta(e.detectedType)
              const status = inboundStatusMeta(e.status)
              return (
                <tr key={e.id} onClick={() => onOpen(e)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-3 align-top text-xs text-gray-600">{shortDateTime(e.receivedAt)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneChip tone={type.tone}>{type.label}</ToneChip>
                      {e.attachmentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-gray-500" title={`${e.attachmentCount} attachment(s)`}>
                          <Paperclip className="h-3.5 w-3.5" />
                          {e.attachmentCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-medium text-gray-900">{e.subject || '(no subject)'}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      <Sender e={e} />
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    {mode === 'unmatched' ? (
                      <span className="font-mono text-gray-700">{e.reservationNo ?? '—'}</span>
                    ) : (
                      <>
                        <span className="font-mono text-gray-800">{e.orderNo ?? '—'}</span>
                        {e.matchMethod && <p className="mt-0.5 text-gray-500">{MATCH_METHOD_LABEL[e.matchMethod]}</p>}
                        {e.mismatches.length > 0 && (
                          <p className="mt-0.5 font-medium text-amber-700">
                            {e.mismatches.length} difference{e.mismatches.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {mode === 'unmatched' ? (
                      actions(e)
                    ) : (
                      <div className="space-y-1">
                        <ToneChip tone={status.tone} dot>
                          {status.label}
                        </ToneChip>
                        {e.handledNote && <p className="line-clamp-2 text-xs text-gray-500" title={e.handledNote}>{e.handledNote}</p>}
                        {e.error && <p className="line-clamp-2 text-xs text-red-600" title={e.error}>{e.error}</p>}
                      </div>
                    )}
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
      {items.map((e) => {
        const type = inboundTypeMeta(e.detectedType)
        const status = inboundStatusMeta(e.status)
        return (
          <li key={e.id} className="flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <button type="button" onClick={() => onOpen(e)} className="flex flex-col gap-2 text-left">
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <ToneChip tone={type.tone}>{type.label}</ToneChip>
                <span className="text-xs text-gray-500">{shortDateTime(e.receivedAt)}</span>
              </div>
              <p className="flex w-full items-start justify-between gap-2 font-medium text-gray-900">
                <span className="min-w-0 break-words">{e.subject || '(no subject)'}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              </p>
              <p className="w-full truncate text-xs text-gray-500">
                <Sender e={e} />
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {mode === 'all' && (
                  <ToneChip tone={status.tone} dot>
                    {status.label}
                  </ToneChip>
                )}
                {(e.orderNo || e.reservationNo) && <span className="font-mono text-gray-700">{e.orderNo ?? `Res. ${e.reservationNo}`}</span>}
                {e.attachmentCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-gray-500">
                    <Paperclip className="h-3.5 w-3.5" />
                    {e.attachmentCount}
                  </span>
                )}
              </div>
              {mode === 'all' && e.handledNote && <p className="text-xs text-gray-500">{e.handledNote}</p>}
              {e.error && <p className="text-xs text-red-600">{e.error}</p>}
            </button>
            {actions(e, true)}
          </li>
        )
      })}
    </ul>
  )
}
