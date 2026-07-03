import { useState } from 'react'
import { useLeads, useUpdateLeadStatus } from '../hooks/useForms'
import { useDebounce } from '@/hooks/useDebounce'
import { Search } from 'lucide-react'
import type { LeadStatus } from '../types'

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW:       'bg-blue-100 text-blue-700',
  REVIEW:    'bg-amber-100 text-amber-700',
  SPAM:      'bg-red-100 text-red-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
}

export default function SpamLeadsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('SPAM')
  const debouncedSearch = useDebounce(search, 300)
  const PAGE_SIZE = 20

  const { data, isLoading } = useLeads({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  })

  const updateStatus = useUpdateLeadStatus()
  const leads = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Leads</h2>
          <p className="text-sm text-gray-500 mt-0.5">All captured leads from form submissions</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search email or name…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="">All</option>
            <option value="NEW">Normal</option>
            <option value="REVIEW">Review</option>
            <option value="SPAM">Spam</option>
            <option value="CONVERTED">Converted</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No leads found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lead</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Form</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Spam Score</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{lead.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{lead.email ?? '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs">{lead.form_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold ${lead.spam_score >= 61 ? 'text-red-500' : lead.spam_score >= 31 ? 'text-amber-500' : 'text-green-600'}`}>
                      {lead.spam_score}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {lead.time_taken_seconds != null ? `${Number(lead.time_taken_seconds).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus.mutate({ id: lead.id, status: e.target.value as LeadStatus })}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="NEW">Normal</option>
                      <option value="REVIEW">Review</option>
                      <option value="SPAM">Spam</option>
                      <option value="CONVERTED">Converted</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total} total</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40">Previous</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
