import { useMemo, useState } from 'react'
import { useAuthStore, type AuthState } from '@/store/authStore'
import { canViewApprovalQueues } from '@/config/roles'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { ApprovalRequest, ApprovalRequestStatus, ApprovalAction } from '@/types'
import { APPROVAL_STATUSES, isTerminalApprovalStatus } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import Badge from '@/components/ui/Badge'
import {
  useApprovals,
  useApprovalDetail,
  useCreateApprovalRequest,
  useTransitionApproval,
} from '../hooks/useApprovals'
import ApprovalRequestBodyCard from '../components/ApprovalRequestBodyCard'

const PAGE_SIZE = 20

function statusVariant(s: ApprovalRequestStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (s === 'completed' || s === 'approved') return 'success'
  if (s === 'rejected' || s === 'cancelled') return 'danger'
  if (s === 'pending' || s === 'in_review') return 'warning'
  return 'neutral'
}

export default function ApprovalsPage() {
  const user = useAuthStore((s: AuthState) => s.user)
  const isModerator = canViewApprovalQueues(user?.role)
  const [page, setPage] = useState(1)
  const [mineOnly, setMineOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ApprovalRequestStatus | ''>('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [transitionNote, setTransitionNote] = useState('')

  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      mine: isModerator && mineOnly ? true : undefined,
      status: statusFilter || undefined,
    }),
    [page, mineOnly, statusFilter, isModerator]
  )

  const { data, isLoading, isError } = useApprovals(listParams)
  const { data: detail } = useApprovalDetail(selectedId)
  const createReq = useCreateApprovalRequest(() => {
    setShowCreate(false)
    setCreateTitle('')
  })
  const transition = useTransitionApproval()

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const isClosed = detail ? isTerminalApprovalStatus(detail.status) : false
  const roleMismatch =
    detail?.subject_user_role_snapshot &&
    detail?.subject_user_current_role &&
    detail.subject_user_role_snapshot !== detail.subject_user_current_role

  const canSubmitGeneric =
    user?.role === 'employee' ||
    user?.role === 'agent' ||
    user?.role === 'affiliate'

  const submitCreate = () => {
    const title = createTitle.trim()
    if (!title) return
    createReq.mutate({ kind: 'generic', title })
  }

  const doTransition = (id: number, to_status: ApprovalRequestStatus) => {
    const note = transitionNote.trim()
    transition.mutate(
      { id, to_status, ...(note ? { note } : {}) },
      { onSuccess: () => setTransitionNote('') }
    )
  }

  const formatActionLabel = (a: ApprovalAction) => {
    if (a.metadata?.type === 'assign') {
      return 'assignment'
    }
    if (a.from_status && a.from_status === a.to_status) {
      return a.note ?? 'updated'
    }
    return a.from_status ? `${a.from_status} → ${a.to_status}` : a.to_status
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Approvals</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational requests and user onboarding. Moderators see the full queue; others see
            only what they submitted.
          </p>
        </div>
        {canSubmitGeneric && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            New request
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Status</span>
          <select
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value as ApprovalRequestStatus | '')
            }}
          >
            <option value="">All</option>
            {APPROVAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        {isModerator && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => {
                setPage(1)
                setMineOnly(e.target.checked)
              }}
            />
            Only my requests
          </label>
        )}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-600">
          Failed to load approvals.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Requester</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No approval requests yet.
                </td>
              </tr>
            ) : (
              items.map((row: ApprovalRequest) => (
                <tr
                  key={row.id}
                  className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-4 py-3 font-mono text-gray-500">#{row.id}</td>
                  <td className="px-4 py-3 capitalize text-gray-800">
                    {row.kind.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(row.status)} dot>
                      {row.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate" title={row.title}>
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.requester_name ?? `User #${row.requester_id}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <Modal
        open={showCreate}
        onClose={() => !createReq.isPending && setShowCreate(false)}
        title="New operational request"
        description="Creates a generic approval ticket."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={createReq.isPending}
            >
              Cancel
            </Button>
            <Button loading={createReq.isPending} onClick={submitCreate}>
              Submit
            </Button>
          </>
        }
      >
        <Input
          label="Title"
          placeholder="Short summary of what you need approved"
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
        />
      </Modal>

      <Modal
        open={selectedId != null}
        onClose={() => {
          if (!transition.isPending) {
            setSelectedId(null)
            setTransitionNote('')
          }
        }}
        title={detail ? `Request #${detail.id}` : 'Request'}
        description={detail?.title}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSelectedId(null)}
              disabled={transition.isPending}
            >
              Close
            </Button>
            {detail &&
              user &&
              detail.requester_id === user.id &&
              !isClosed &&
              (detail.status === 'pending' || detail.status === 'in_review') && (
                <Button
                  variant="danger"
                  loading={transition.isPending}
                  onClick={() => doTransition(detail.id, 'cancelled')}
                >
                  Cancel request
                </Button>
              )}
            {detail && isModerator && !isClosed && detail.status === 'pending' && (
              <Button
                loading={transition.isPending}
                onClick={() => doTransition(detail.id, 'in_review')}
              >
                Move to review
              </Button>
            )}
            {detail && isModerator && !isClosed && detail.status === 'in_review' && (
              <>
                <Button
                  variant="outline"
                  loading={transition.isPending}
                  onClick={() => doTransition(detail.id, 'pending')}
                >
                  Back to pending
                </Button>
                <Button
                  variant="danger"
                  loading={transition.isPending}
                  onClick={() => doTransition(detail.id, 'rejected')}
                >
                  Reject
                </Button>
                <Button
                  loading={transition.isPending}
                  onClick={() => doTransition(detail.id, 'approved')}
                >
                  Approve
                </Button>
              </>
            )}
            {detail && isModerator && !isClosed && detail.status === 'approved' && (
              <Button
                loading={transition.isPending}
                onClick={() => doTransition(detail.id, 'completed')}
              >
                Mark completed
              </Button>
            )}
          </>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            {isClosed && (
              <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-gray-600">
                This request is closed. Open a new ticket if further approval is needed.
              </p>
            )}
            {roleMismatch && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                Subject role changed since this ticket opened (
                {detail.subject_user_role_snapshot?.replace(/_/g, ' ')} →{' '}
                {detail.subject_user_current_role?.replace(/_/g, ' ')}). Approval rules use the
                original role; consider rejecting and opening a new request.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 text-gray-700">
              <div>
                <p className="text-gray-500 text-xs">Kind</p>
                <p className="font-medium capitalize">{detail.kind.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Status</p>
                <Badge variant={statusVariant(detail.status)} dot>
                  {detail.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              {detail.subject_user_id != null && (
                <div>
                  <p className="text-gray-500 text-xs">Subject user</p>
                  <p className="font-medium">
                    #{detail.subject_user_id}{' '}
                    {detail.subject_user_role && (
                      <span className="text-gray-500 font-normal">
                        ({detail.subject_user_role.replace(/_/g, ' ')})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {detail.assigned_to_id != null && (
                <div>
                  <p className="text-gray-500 text-xs">Assigned to</p>
                  <p className="font-medium">User #{detail.assigned_to_id}</p>
                </div>
              )}
            </div>
            {detail.decision_note && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-gray-500 text-xs mb-1">Decision note</p>
                <p className="text-gray-800">{detail.decision_note}</p>
              </div>
            )}
            {detail && isModerator && !isClosed && detail.status === 'in_review' && (
              <Input
                label="Note (optional, shown on reject/approve)"
                placeholder="Reason or context for the decision"
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
              />
            )}
            <ApprovalRequestBodyCard
              kind={detail.kind}
              body={detail.body}
              requesterName={detail.requester_name}
              requesterId={detail.requester_id}
              subjectUserId={detail.subject_user_id}
            />
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Activity</p>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {(detail.actions ?? []).map((a: ApprovalAction) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs text-gray-700"
                  >
                    <span className="font-medium">{a.actor_name}</span>{' '}
                    <span className="text-gray-500">{formatActionLabel(a)}</span>
                    <span className="text-gray-400 ml-2">{formatDateTime(a.created_at)}</span>
                    {a.note && <p className="text-gray-600 mt-1 italic">{a.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4">Loading…</p>
        )}
      </Modal>
    </div>
  )
}
