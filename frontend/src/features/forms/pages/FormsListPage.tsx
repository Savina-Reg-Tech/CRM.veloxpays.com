import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ExternalLink, Edit2, Trash2, BarChart2, FileText, Code2 } from 'lucide-react'
import { useForms, useDeleteForm, useGlobalStats } from '../hooks/useForms'
import { formApi } from '../formService'
import EmbedModal from '../components/EmbedModal'
import type { Form, EmbedCodes } from '../types'

const STATUS_COLORS = {
  published: 'bg-emerald-100 text-emerald-700',
  draft:     'bg-amber-100 text-amber-700',
  archived:  'bg-gray-100 text-gray-500',
}

function StatCard({ label, value, color = 'text-indigo-600' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function FormsListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [embedForm, setEmbedForm] = useState<Form | null>(null)
  const [embedCodes, setEmbedCodes] = useState<EmbedCodes | null>(null)
  const [embedLoading, setEmbedLoading] = useState(false)
  const PAGE_SIZE = 20

  const { data, isLoading, isError } = useForms({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  const { data: stats } = useGlobalStats()
  const deleteMutation = useDeleteForm()

  const forms = data?.items ?? []
  const total = data?.total ?? 0

  const handleEmbed = async (form: Form) => {
    setEmbedForm(form)
    setEmbedCodes(null)
    setEmbedLoading(true)
    try {
      const codes = await formApi.getEmbedCodes(form.id)
      setEmbedCodes(codes)
    } finally {
      setEmbedLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete form "${name}"? This action cannot be undone.`)) return
    await deleteMutation.mutateAsync(id)
  }

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Form Builder</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage lead capture forms</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/forms/builder/new')}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> New Form
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Forms"      value={stats.forms.total_forms} />
          <StatCard label="Published"        value={stats.forms.published_forms} color="text-emerald-600" />
          <StatCard label="Total Submissions" value={stats.forms.total_submissions} color="text-blue-600" />
          <StatCard label="Total Leads"      value={stats.forms.total_leads} color="text-purple-600" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading forms…</div>
        ) : isError ? (
          <div className="p-10 text-center text-red-500 text-sm">Failed to load forms.</div>
        ) : forms.length === 0 ? (
          <div className="p-16 text-center">
            <FileText size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No forms yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first form to start capturing leads.</p>
            <button
              onClick={() => navigate('/dashboard/forms/builder/new')}
              className="mt-4 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} /> Create Form
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Submissions</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{form.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">/{form.slug}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[form.status]}`}>
                      {form.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-gray-700">{form.total_submissions}</td>
                  <td className="px-5 py-4 text-right font-medium text-gray-700">{form.total_leads}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(form.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEmbed(form)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Embed code"
                      >
                        <Code2 size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/forms/analytics/${form.id}`)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Analytics"
                      >
                        <BarChart2 size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/forms/submissions/${form.id}`)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Submissions"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/forms/builder/${form.id}`)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(form.id, form.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total} total</p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/dashboard/forms/leads')}
          className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
        >
          <ExternalLink size={14} /> View All Leads
        </button>
        <button
          onClick={() => navigate('/dashboard/forms/spam')}
          className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5"
        >
          <ExternalLink size={14} /> Spam Leads
        </button>
        <button
          onClick={() => navigate('/dashboard/forms/blocked-domains')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
        >
          <ExternalLink size={14} /> Blocked Domains
        </button>
      </div>

      {/* Embed Modal */}
      <EmbedModal
        open={!!embedForm}
        onClose={() => setEmbedForm(null)}
        embedCodes={embedCodes}
        isLoading={embedLoading}
      />
    </div>
  )
}
