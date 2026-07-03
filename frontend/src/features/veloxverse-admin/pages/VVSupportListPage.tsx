import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import {
  useVVSupportTickets,
  useVVSupportStats,
  useVVSupportSearch,
} from '../hooks/useVVSupport'
import { formatDateTime, statusBadgeVariant } from '../utils'
import type {
  VVAdminSearchResult,
  VVAdminTicketFilters,
  VVSupportCategory,
  VVSupportPriority,
  VVSupportStatus,
} from '../types'

const STATUSES: VVSupportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITIES: VVSupportPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORIES: VVSupportCategory[] = ['BILLING', 'TECHNICAL', 'ACCOUNT', 'ESIM', 'OTHER']

const TYPE_LABEL: Record<VVAdminSearchResult['type'], string> = {
  TICKET: 'Support ticket',
  ESIM: 'eSIM order',
  LOUNGE: 'Lounge visit',
  BENEFIT: 'Benefit booking',
}

const TYPE_TINT: Record<VVAdminSearchResult['type'], string> = {
  TICKET: 'bg-rose-50 text-rose-600',
  ESIM: 'bg-sky-50 text-sky-600',
  LOUNGE: 'bg-violet-50 text-violet-600',
  BENEFIT: 'bg-amber-50 text-amber-600',
}

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

const selectCls =
  'h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

function CaseSearch() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const { data: results, isFetching } = useVVSupportSearch(query)

  function run() {
    setQuery(input.trim())
  }

  function clear() {
    setInput('')
    setQuery('')
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Search by Case ID (e.g. TKT-ANSHUMAN-2026-000001)"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button onClick={run} disabled={!input.trim()} loading={isFetching}>
          <Search className="h-4 w-4" />
          Search
        </Button>
        {query && (
          <Button variant="outline" onClick={clear}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {query && !isFetching && (
        <div className="space-y-2">
          {!results || results.length === 0 ? (
            <p className="py-3 text-center text-sm text-gray-500">
              No tickets or bookings match "{query}".
            </p>
          ) : (
            results.map((r) => {
              const row = (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_TINT[r.type]}`}
                      >
                        {TYPE_LABEL[r.type]}
                      </span>
                      <span className="truncate font-mono text-xs text-indigo-600">
                        {r.caseId ?? '—'}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-900">{r.subject}</p>
                  </div>
                  <span className="shrink-0 text-xs capitalize text-gray-500">
                    {r.status.toLowerCase().replace(/_/g, ' ')}
                  </span>
                </div>
              )
              return r.type === 'TICKET' ? (
                <Link
                  key={`${r.type}-${r.id}`}
                  to={`/dashboard/veloxverse/support/${r.id}`}
                  className="block transition-opacity hover:opacity-80"
                >
                  {row}
                </Link>
              ) : (
                <div key={`${r.type}-${r.id}`}>{row}</div>
              )
            })
          )}
        </div>
      )}
    </Card>
  )
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <Card padding="sm">
      <p className={`text-2xl font-bold ${tint}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  )
}

export default function VVSupportListPage() {
  const [filters, setFilters] = useState<VVAdminTicketFilters>({})
  const { data: tickets, isLoading } = useVVSupportTickets(filters)
  const { data: stats } = useVVSupportStats()

  function set<K extends keyof VVAdminTicketFilters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: (value || undefined) as VVAdminTicketFilters[K] }))
  }

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-sm text-gray-500">Manage customer tickets and respond.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Total" value={stats?.total ?? 0} tint="text-gray-900" />
        <StatCard label="Open" value={stats?.open ?? 0} tint="text-amber-600" />
        <StatCard label="In progress" value={stats?.inProgress ?? 0} tint="text-indigo-600" />
        <StatCard label="Resolved" value={stats?.resolved ?? 0} tint="text-emerald-600" />
        <StatCard label="Closed" value={stats?.closed ?? 0} tint="text-gray-500" />
      </div>

      <CaseSearch />

      <div className="flex flex-wrap gap-2">
        <select className={selectCls} value={filters.status ?? ''} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select className={selectCls} value={filters.priority ?? ''} onChange={(e) => set('priority', e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className={selectCls} value={filters.category ?? ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-sm text-gray-500">
            No tickets match these filters.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {tickets.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3.5 font-mono text-xs text-indigo-600">{t.caseId ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <Link
                        to={`/dashboard/veloxverse/support/${t.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{t.customer?.email ?? '—'}</td>
                    <td className="px-4 py-3.5 capitalize text-gray-500">{t.category.toLowerCase()}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={priorityBadgeVariant(t.priority)}>{t.priority}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusBadgeVariant(t.status)}>{t.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{formatDateTime(t.updatedAt)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <Link to={`/dashboard/veloxverse/support/${t.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
