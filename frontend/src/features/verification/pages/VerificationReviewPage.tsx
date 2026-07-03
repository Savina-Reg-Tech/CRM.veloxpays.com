import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/lib/utils'
import { VERIFICATION_STATUSES, type VerificationStatus, type VerificationSubject } from '@/types'
import { useReviewQueue } from '../hooks/useVerification'
import { VerificationStatusBadge } from '../statusBadge'
import ReviewUserModal from '../components/ReviewUserModal'

const PAGE_SIZE = 20

const ROLE_FILTERS = [
  { value: 'employee', label: 'Employees' },
  { value: 'agent', label: 'Agents' },
  { value: 'affiliate', label: 'Affiliates' },
] as const

export default function VerificationReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') ?? '') as VerificationStatus | ''
  const [page, setPage] = useState(1)
  const [roles, setRoles] = useState<string[]>([])
  const [status, setStatus] = useState<VerificationStatus | ''>(initialStatus)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Clear URL param once consumed so bookmarking doesn't lock the filter
  useEffect(() => {
    if (searchParams.has('status')) {
      searchParams.delete('status')
      setSearchParams(searchParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const params = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      role: roles.length ? roles.join(',') : undefined,
      status: status || undefined,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, roles, status, debouncedSearch]
  )

  const { data, isLoading, isError } = useReviewQueue(params)
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggleRole = (value: string) => {
    setPage(1)
    setRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    )
  }

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Verification</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Review uploaded documents and activate accounts once all required documents are approved.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRole(r.value)}
              className={
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ' +
                (roles.includes(r.value)
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
              }
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Status</span>
          <select
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value as VerificationStatus | '')
            }}
          >
            <option value="">All</option>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto w-full max-w-xs">
          <Input
            placeholder="Search name, email, or user ID"
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Failed to load the verification queue.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              items.map((u: VerificationSubject) => (
                <tr
                  key={u.id}
                  className={
                    'cursor-pointer border-t border-gray-100 hover:bg-gray-50/80' +
                    (u.verification_status === 'pending' || u.verification_status === 'under_review'
                      ? ' border-l-4 border-l-amber-400'
                      : '')
                  }
                  onClick={() => setSelectedId(u.id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">
                    {u.role.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={u.can_activate ? 'success' : 'neutral'}>
                        {u.docs_approved}/{u.required_total} approved
                      </Badge>
                      {u.docs_uploaded > (u.total_expected ?? u.required_total) && (
                        <Badge variant="warning">
                          +{u.docs_uploaded - (u.total_expected ?? u.required_total)} additional
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <VerificationStatusBadge status={u.verification_status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(u.id)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <ReviewUserModal userId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
