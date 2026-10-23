// Sent & history: what went out (or was discarded), newest first. A row opens the read-only Review.
import { ChevronRight } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { useIsDesktop } from '../vv-audit/useMediaQuery'
import { draftStatusMeta, shortDateTime } from '../../pickdropEmails'
import type { DraftSummary } from '../../types'
import { TemplateName, ToneChip } from './PdUI'

const when = (d: DraftSummary) => d.sentAt ?? d.discardedAt ?? d.editedAt ?? d.createdAt

export default function HistoryList({ items, isLoading, onOpen }: { items: DraftSummary[]; isLoading: boolean; onOpen: (id: string) => void }) {
  const isDesktop = useIsDesktop()
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
              <th className="w-32 px-4 py-3">When</th>
              <th className="px-4 py-3">Email</th>
              <th className="w-48 px-4 py-3">Order</th>
              <th className="w-64 px-4 py-3">To / by</th>
              <th className="w-32 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((d) => {
              const m = draftStatusMeta(d.status)
              return (
                <tr key={d.id} onClick={() => onOpen(d.id)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-3 align-top text-xs text-gray-600">{shortDateTime(when(d))}</td>
                  <td className="px-4 py-3 align-top">
                    <TemplateName templateKey={d.templateKey} name={d.templateName} />
                    {d.status === 'DISCARDED' && d.discardReason && <p className="mt-1 truncate pl-9 text-xs text-gray-500">Reason: {d.discardReason}</p>}
                    {d.status === 'FAILED' && d.error && <p className="mt-1 truncate pl-9 text-xs text-red-600">{d.error}</p>}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-gray-700">{d.orderNo}</td>
                  <td className="px-4 py-3 align-top text-xs text-gray-600">
                    {d.sentTo && <p className="truncate text-gray-900">{d.sentTo}</p>}
                    <p className="truncate">{d.sentBy ? `by ${d.sentBy}` : d.discardedBy ? `by ${d.discardedBy}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ToneChip tone={m.tone}>{m.label}</ToneChip>
                    {d.sendCount > 1 && <span className="ml-1.5 text-xs font-semibold text-gray-600">×{d.sendCount}</span>}
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
      {items.map((d) => {
        const m = draftStatusMeta(d.status)
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onOpen(d.id)}
              className="flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-indigo-200"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <ToneChip tone={m.tone}>
                  {m.label}
                  {d.sendCount > 1 ? ` ×${d.sendCount}` : ''}
                </ToneChip>
                <span className="text-xs text-gray-500">{shortDateTime(when(d))}</span>
              </div>
              <div className="flex w-full items-center justify-between gap-2">
                <TemplateName templateKey={d.templateKey} name={d.templateName} />
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              </div>
              <p className="font-mono text-xs text-gray-600">{d.orderNo}</p>
              {(d.sentTo || d.sentBy) && (
                <p className="w-full break-words text-xs text-gray-600">
                  {d.sentTo && <>→ {d.sentTo}</>} {d.sentBy && <span className="text-gray-400">by {d.sentBy}</span>}
                </p>
              )}
              {d.status === 'DISCARDED' && d.discardReason && <p className="text-xs text-gray-500">Reason: {d.discardReason}</p>}
              {d.status === 'FAILED' && d.error && <p className="text-xs text-red-600">{d.error}</p>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
