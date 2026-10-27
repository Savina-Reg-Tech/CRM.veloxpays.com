// Pick & Drop → Customer emails. ViaTovia emails us about our customers' rides; VeloxVerse turns
// the ones the customer needs into drafts. Tabs: To review (default) · Unmatched · Sent & history
// · ViaTovia inbox. The tab is the route; the open inbox email is ?email=<id>.
import { useCallback, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Inbox, RefreshCw, Search, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Pagination from '@/components/ui/Pagination'
import { useToast } from '@/app/providers/ToastProvider'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { AuditEmpty, AuditErrorState } from '../components/audit/AuditUI'
import {
  OPEN_QUEUE_PARAMS,
  useDraftQueue,
  useInbox,
  usePickdropBadge,
  useSyncInbox,
} from '../hooks/usePickdropEmails'
import { useTemplates } from '../hooks/useEmailTemplates'
import { isReaderOff, pdErrorText } from '../pickdropEmails'
import type { DraftStatus, DraftSummary, InboundStatus, InboxSummary } from '../types'
import DraftQueue from '../components/pickdrop-emails/DraftQueue'
import InboxList from '../components/pickdrop-emails/InboxList'
import HistoryList from '../components/pickdrop-emails/HistoryList'
import InboxDrawer from '../components/pickdrop-emails/InboxDrawer'
import LinkEmailDialog from '../components/pickdrop-emails/LinkEmailDialog'
import IgnoreDialog from '../components/pickdrop-emails/IgnoreDialog'
import SendFlow from '../components/pickdrop-emails/SendDialog'
import { AllCaughtUp, ShortcutsPopover } from '../components/pickdrop-emails/PdUI'
import { PD_EMAILS_BASE, TEMPLATES_BASE, draftPath } from '../components/pickdrop-emails/paths'

export type PickdropEmailsTab = 'review' | 'unmatched' | 'history' | 'inbox'

const PAGE_SIZE = 25

const HISTORY_FILTERS: Array<{ value: DraftStatus | ''; label: string }> = [
  { value: 'SENT', label: 'Sent' },
  { value: 'DISCARDED', label: 'Discarded' },
  { value: 'FAILED', label: 'Failed' },
  { value: '', label: 'All' },
]

const INBOX_FILTERS: Array<{ value: InboundStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'DRAFTED', label: 'Drafted' },
  { value: 'UNMATCHED', label: 'Unmatched' },
  { value: 'IGNORED', label: 'Ignored' },
  { value: 'NEW', label: 'New' },
]

function FilterChips<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            value === o.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function OrderSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Order number"
        aria-label="Search by order number"
        className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────
function ReviewTab() {
  const navigate = useNavigate()
  const { data, isLoading, isFetching, error, refetch } = useDraftQueue(OPEN_QUEUE_PARAMS)
  const { data: tpl } = useTemplates()
  const [quickSend, setQuickSend] = useState<DraftSummary | null>(null)
  const open = useCallback((id: string) => navigate(draftPath(id)), [navigate])
  const refresh = useCallback(() => void refetch(), [refetch])

  if (error) return <AuditErrorState error={error} onRetry={refresh} />
  const items = data?.items ?? []
  if (!isLoading && items.length === 0) return <AllCaughtUp />
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>Soonest pickup first</span>
        {isFetching && !isLoading && <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Updating…</span>}
      </div>
      <DraftQueue items={items} isLoading={isLoading} placeholders={tpl?.placeholders} onOpen={open} onQuickSend={setQuickSend} onRefresh={refresh} />
      {data && data.total > items.length && (
        <p className="text-center text-xs text-gray-500">
          Showing the first {items.length} of {data.total} — work through these and the rest move up.
        </p>
      )}
      {quickSend && (
        <SendFlow
          draftId={quickSend.id}
          open
          onClose={() => setQuickSend(null)}
          onSent={() => setQuickSend(null)}
          onMissing={() => open(quickSend.id)}
          onVoucherError={() => open(quickSend.id)}
        />
      )}
    </div>
  )
}

function InboxTab({ mode }: { mode: 'unmatched' | 'all' }) {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InboundStatus | ''>('')
  const [order, setOrder] = useState('')
  const orderNo = useDebounce(order.trim(), 300)
  const query = mode === 'unmatched' ? { status: 'UNMATCHED' as const, page, limit: PAGE_SIZE } : { status: status || undefined, orderNo: orderNo || undefined, page, limit: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useInbox(query)
  const [linkEmail, setLinkEmail] = useState<InboxSummary | null>(null)
  const [ignoreEmail, setIgnoreEmail] = useState<InboxSummary | null>(null)
  const openId = params.get('email')
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('email', id)
    else next.delete('email')
    setParams(next, { replace: !id })
  }
  const items = data?.items ?? []

  return (
    <div className="space-y-3">
      {mode === 'all' ? (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            options={INBOX_FILTERS}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          />
          <OrderSearch
            value={order}
            onChange={(v) => {
              setOrder(v)
              setPage(1)
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          ViaTovia emails no booking could be found for after 30 minutes of retries. Link each one to its booking, or mark it as needing no action.
        </p>
      )}
      {error ? (
        <AuditErrorState error={error} onRetry={() => void refetch()} />
      ) : !isLoading && items.length === 0 ? (
        mode === 'unmatched' ? (
          <AllCaughtUp text="No unmatched ViaTovia emails." />
        ) : (
          <AuditEmpty title="No ViaTovia emails" text="Nothing matches these filters." icon={Inbox} />
        )
      ) : (
        <>
          <InboxList
            items={items}
            isLoading={isLoading}
            mode={mode}
            onOpen={(e) => setOpen(e.id)}
            onLink={setLinkEmail}
            onIgnore={setIgnoreEmail}
          />
          {data && data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
        </>
      )}
      <InboxDrawer emailId={openId} onClose={() => setOpen(null)} onLink={setLinkEmail} onIgnore={setIgnoreEmail} />
      <LinkEmailDialog email={linkEmail} onClose={() => setLinkEmail(null)} />
      <IgnoreDialog email={ignoreEmail} onClose={() => setIgnoreEmail(null)} />
    </div>
  )
}

function HistoryTab() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<DraftStatus | ''>('SENT')
  const [page, setPage] = useState(1)
  const [order, setOrder] = useState('')
  const orderNo = useDebounce(order.trim(), 300)
  const { data, isLoading, error, refetch } = useDraftQueue({ status: status || undefined, orderNo: orderNo || undefined, page, limit: PAGE_SIZE })
  const items = data?.items ?? []
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips
          options={HISTORY_FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        />
        <OrderSearch
          value={order}
          onChange={(v) => {
            setOrder(v)
            setPage(1)
          }}
        />
      </div>
      {error ? (
        <AuditErrorState error={error} onRetry={() => void refetch()} />
      ) : !isLoading && items.length === 0 ? (
        <AuditEmpty title="Nothing here yet" text="Customer emails show up here once they're sent or discarded." icon={FileText} />
      ) : (
        <>
          <HistoryList items={items} isLoading={isLoading} onOpen={(id) => navigate(draftPath(id))} />
          {data && data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function VVPickdropEmailsPage({ tab }: { tab: PickdropEmailsTab }) {
  const badge = usePickdropBadge()
  const sync = useSyncInbox()
  const { showToast } = useToast()

  const checkInbox = () =>
    sync.mutate(undefined, {
      onSuccess: (r) =>
        showToast({
          type: 'success',
          title: r.stored ? `Checked: ${r.stored} new ViaTovia email${r.stored === 1 ? '' : 's'}` : 'Checked: nothing new',
          message: r.dryRun ? 'Dry run — nothing was stored.' : undefined,
        }),
      onError: (err) =>
        isReaderOff(err)
          ? showToast({ type: 'info', title: "The inbox reader isn't switched on yet", message: pdErrorText(err) })
          : showToast({ type: 'error', title: 'Could not check the inbox', message: pdErrorText(err) }),
    })

  const tabs: Array<{ key: PickdropEmailsTab; label: string; to: string; count?: number }> = [
    { key: 'review', label: 'To review', to: PD_EMAILS_BASE, count: badge.open },
    { key: 'unmatched', label: 'Unmatched', to: `${PD_EMAILS_BASE}/unmatched`, count: badge.unmatched },
    { key: 'history', label: 'Sent & history', to: `${PD_EMAILS_BASE}/history` },
    { key: 'inbox', label: 'ViaTovia inbox', to: `${PD_EMAILS_BASE}/inbox` },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header — sticky on phones so "Check inbox now" is always one tap away. */}
      <div className="sticky -top-4 z-20 -mx-4 bg-gray-50/95 px-4 pb-2 pt-4 backdrop-blur sm:-top-6 sm:-mx-6 sm:px-6 sm:pt-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Pick &amp; Drop Emails</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {badge.isLoading ? 'Loading…' : `${badge.open} to review · ${badge.unmatched} unmatched`}
              <span className="hidden sm:inline"> · Rides by ViaTovia</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShortcutsPopover
              items={[
                { keys: ['j', '↓'], label: 'Next email' },
                { keys: ['k', '↑'], label: 'Previous email' },
                { keys: ['Enter'], label: 'Open' },
                { keys: ['r'], label: 'Refresh' },
              ]}
            />
            <Link
              to={TEMPLATES_BASE}
              className="hidden h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 md:inline-flex"
            >
              <FileText className="h-4 w-4" /> Templates
            </Link>
            <Button onClick={checkInbox} loading={sync.isPending} className="h-10 w-10 p-0 lg:w-auto lg:px-4" aria-label="Check inbox now" title="Check inbox now">
              {!sync.isPending && <RefreshCw className="h-4 w-4" />}
              <span className="hidden lg:inline">Check inbox now</span>
            </Button>
          </div>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Customer email lists">
          {tabs.map((t) => (
            <NavLink
              key={t.key}
              to={t.to}
              end
              className={({ isActive }) =>
                cn(
                  '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors sm:px-4',
                  isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                )
              }
            >
              {t.label}
              {!!t.count && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                    t.key === 'unmatched' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {t.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {tab === 'review' && <ReviewTab />}
      {tab === 'unmatched' && <InboxTab key="unmatched" mode="unmatched" />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'inbox' && <InboxTab key="all" mode="all" />}
    </div>
  )
}
