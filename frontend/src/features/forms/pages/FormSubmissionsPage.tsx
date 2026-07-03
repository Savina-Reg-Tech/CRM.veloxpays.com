import { useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { useFormSubmissions, useForm } from '../hooks/useForms'
import { SubmissionDataView } from '../utils/submissionDisplay'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api'

const STATUS_COLORS = {
  NEW:       'bg-blue-100 text-blue-700',
  REVIEW:    'bg-amber-100 text-amber-700',
  SPAM:      'bg-red-100 text-red-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
}

function SpamScoreBar({ score }: { score: number }) {
  const pct = Math.min(score, 100)
  const color = score >= 61 ? 'bg-red-500' : score >= 31 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  )
}

export default function FormSubmissionsPage() {
  const { id } = useParams<{ id: string }>()
  const formId = parseInt(id!, 10)
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const PAGE_SIZE = 20

  const { data: form } = useForm(formId)
  const { data, isLoading } = useFormSubmissions(formId, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: statusFilter || undefined })

  const submissions = data?.items ?? []
  const total = data?.total ?? 0

  const handleExport = () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const url = `${API_BASE}/forms/${formId}/submissions/export${params.toString() ? `?${params}` : ''}`
    window.open(url, '_blank')
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard/forms')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Submissions</h2>
          <p className="text-sm text-gray-500">{form?.name ?? '—'}</p>
        </div>
        {/* Filter + Export */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="NEW">Normal</option>
            <option value="REVIEW">Review</option>
            <option value="SPAM">Spam</option>
            <option value="CONVERTED">Converted</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-xl transition-colors"
            title="Export CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No submissions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Spam Score</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time Taken</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((sub) => (
                <Fragment key={sub.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-700">{sub.email ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[sub.status] ?? ''}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-3"><SpamScoreBar score={sub.spam_score} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {sub.time_taken_seconds != null ? `${Number(sub.time_taken_seconds).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(sub.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        {expanded === sub.id ? 'Hide' : 'View data'}
                      </button>
                    </td>
                  </tr>
                  {expanded === sub.id && (
                    <tr>
                      <td colSpan={6} className="px-5 pb-4 bg-gray-50">
                        <SubmissionDataView
                          data={sub.submission_data}
                          formJson={form?.form_json}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
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
