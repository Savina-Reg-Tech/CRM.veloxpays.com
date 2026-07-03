import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, Send, User as UserIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVSupportTicket,
  useVVReplyTicket,
  useVVUpdateTicketStatus,
} from '../hooks/useVVSupport'
import { formatDateTime, statusBadgeVariant } from '../utils'
import type { VVSupportMessage, VVSupportPriority, VVSupportStatus } from '../types'

const STATUSES: VVSupportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

/** URGENT → danger, HIGH → warning, MEDIUM → info, LOW → neutral. */
function priorityBadgeVariant(priority: VVSupportPriority): BadgeVariant {
  switch (priority) {
    case 'URGENT':
      return 'danger'
    case 'HIGH':
      return 'warning'
    case 'MEDIUM':
      return 'info'
    default:
      return 'neutral'
  }
}

/** Message thread with clear admin vs customer distinction. */
function AdminMessageThread({ messages }: { messages: VVSupportMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500">
        <MessageSquare className="h-8 w-8 opacity-50" />
        <p className="text-sm">No messages yet. Send a reply to get started.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const isAdmin = m.senderRole === 'ADMIN'
        return (
          <div key={m.id} className={`flex gap-3 ${isAdmin ? 'flex-row' : 'flex-row-reverse'}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isAdmin
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isAdmin ? 'A' : <UserIcon className="h-3.5 w-3.5" />}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                isAdmin
                  ? 'rounded-tl-sm border border-gray-200 bg-white text-gray-900'
                  : 'rounded-tr-sm bg-indigo-50 text-gray-900'
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                <span className="font-semibold">{isAdmin ? 'Admin' : 'Customer'}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(m.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function VVSupportDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: ticket, isLoading } = useVVSupportTicket(ticketId)
  const reply = useVVReplyTicket()
  const updateStatus = useVVUpdateTicketStatus()
  const [message, setMessage] = useState('')

  async function changeStatus(status: VVSupportStatus) {
    if (!ticketId) return
    try {
      await updateStatus.mutateAsync({ id: ticketId, status })
      showToast({ type: 'success', title: 'Status updated' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update status',
      })
    }
  }

  async function send() {
    if (!message.trim() || !ticketId) return
    try {
      await reply.mutateAsync({ id: ticketId, message })
      setMessage('')
      showToast({ type: 'success', title: 'Reply sent' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to send reply',
      })
    }
  }

  async function quickResolve() {
    if (!ticketId) return
    try {
      if (message.trim()) {
        await reply.mutateAsync({ id: ticketId, message })
        setMessage('')
      }
      await updateStatus.mutateAsync({ id: ticketId, status: 'RESOLVED' })
      showToast({ type: 'success', title: 'Ticket resolved' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to resolve ticket',
      })
    }
  }

  const selectCls =
    'h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

  return (
    <div className="max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard/veloxverse/support')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !ticket ? (
        <Card>
          <p className="py-12 text-center text-sm text-gray-500">Ticket not found.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Ticket header */}
          <Card padding="sm" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {ticket.caseId && (
                  <p className="mb-1 font-mono text-xs text-indigo-600">{ticket.caseId}</p>
                )}
                <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                <Badge variant={statusBadgeVariant(ticket.status)}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {/* Customer info */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <UserIcon className="h-3 w-3" />
                {ticket.customer?.name ?? 'Unknown'}
              </span>
              <span>{ticket.customer?.email ?? '—'}</span>
              <span className="capitalize">{ticket.category.toLowerCase()}</span>
              <span>Opened {formatDateTime(ticket.createdAt)}</span>
            </div>

            {/* Status + quick actions row */}
            <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Status:</label>
                <select
                  value={ticket.status}
                  disabled={updateStatus.isPending}
                  onChange={(e) => changeStatus(e.target.value as VVSupportStatus)}
                  className={selectCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={quickResolve}
                  disabled={reply.isPending || updateStatus.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {message.trim() ? 'Reply & Resolve' : 'Mark Resolved'}
                </Button>
              )}
            </div>
          </Card>

          {/* Message thread */}
          <Card padding="sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Conversation</h2>
            <AdminMessageThread messages={ticket.messages ?? []} />
          </Card>

          {/* Reply box */}
          <Card padding="sm" className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Reply to customer</h2>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your response to the customer..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                Your reply will be visible to the customer and will send them a notification.
              </p>
              <div className="flex gap-2">
                {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && message.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={quickResolve}
                    disabled={reply.isPending || updateStatus.isPending}
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reply & Resolve
                  </Button>
                )}
                <Button onClick={send} loading={reply.isPending} disabled={!message.trim()}>
                  {!reply.isPending && <Send className="h-4 w-4" />}
                  {reply.isPending ? 'Sending...' : 'Send reply'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
