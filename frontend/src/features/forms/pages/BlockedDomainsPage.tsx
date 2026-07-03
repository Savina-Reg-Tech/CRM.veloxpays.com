import { useState } from 'react'
import { Trash2, Plus, ShieldAlert } from 'lucide-react'
import { useBlockedDomains, useAddDomain, useDeleteDomain } from '../hooks/useForms'

export default function BlockedDomainsPage() {
  const [domain, setDomain] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useBlockedDomains()
  const addMutation = useAddDomain()
  const deleteMutation = useDeleteDomain()

  const items = data?.items ?? []

  const handleAdd = async () => {
    setError('')
    const clean = domain.trim().toLowerCase().replace(/^@/, '')
    if (!clean) { setError('Enter a domain'); return }
    try {
      await addMutation.mutateAsync(clean)
      setDomain('')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to add domain')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <ShieldAlert size={22} className="text-red-500 mt-0.5" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Blocked Email Domains</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Submissions from these domains are automatically flagged as spam.
          </p>
        </div>
      </div>

      {/* Add domain */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Add Domain</label>
        <div className="flex gap-2">
          <input
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. mailinator.com"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={15} /> Block
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Domain list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Blocked Domains</p>
          <span className="text-xs text-gray-400">{items.length} domains</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No blocked domains yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.domain}</p>
                  <p className="text-xs text-gray-400">Added {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(d.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
