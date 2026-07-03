import { Mail, UserCircle } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { ApprovalRequestKind } from '@/types'

interface Props {
  kind: ApprovalRequestKind
  body: Record<string, unknown> | null
  requesterName?: string | null
  requesterId?: number
  subjectUserId?: number | null
}

const FIELD_LABELS: Record<string, string> = {
  subject_email: 'Account email',
  auto: 'Source',
  created_by_user_id: 'Created by',
}

function humanizeKey(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

function formatGenericValue(key: string, value: unknown): string {
  if (key === 'auto') return value ? 'Automatic (user provisioning)' : 'Manual'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ApprovalRequestBodyCard({
  kind,
  body,
  requesterName,
  requesterId,
  subjectUserId,
}: Props) {
  if (!body || Object.keys(body).length === 0) return null

  const isAutoOnboarding = kind === 'user_onboarding' && body.auto === true
  const email =
    typeof body.subject_email === 'string' ? body.subject_email : null

  if (isAutoOnboarding) {
    const requestedBy =
      requesterName ?? (requesterId != null ? `User #${requesterId}` : null)

    return (
      <Card
        padding="sm"
        className="bg-gradient-to-br from-indigo-50/60 via-white to-white border-indigo-100"
      >
        <CardHeader
          className="mb-3"
          title="Onboarding details"
          description="This account was provisioned and is waiting for approval before sign-in."
          action={
            <Badge variant="info" className="shrink-0">
              Auto-created
            </Badge>
          }
        />
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {email && (
            <div className="flex gap-3 rounded-lg bg-white/80 border border-gray-100 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Mail size={16} aria-hidden />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">Account email</dt>
                <dd className="text-sm font-medium text-gray-900 truncate" title={email}>
                  {email}
                </dd>
              </div>
            </div>
          )}
          {requestedBy && (
            <div className="flex gap-3 rounded-lg bg-white/80 border border-gray-100 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <UserCircle size={16} aria-hidden />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">Requested by</dt>
                <dd className="text-sm font-medium text-gray-900">{requestedBy}</dd>
              </div>
            </div>
          )}
          {subjectUserId != null && (
            <div className="sm:col-span-2 rounded-lg bg-white/80 border border-gray-100 px-3 py-2.5">
              <dt className="text-xs text-gray-500">New user record</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                User #{subjectUserId}
                <span className="text-gray-500 font-normal ml-2">
                  Inactive until this request is approved
                </span>
              </dd>
            </div>
          )}
        </dl>
      </Card>
    )
  }

  const entries = Object.entries(body).filter(([key]) => !key.startsWith('_'))
  if (entries.length === 0) return null

  return (
    <Card padding="sm">
      <CardHeader
        className="mb-3"
        title={kind === 'user_onboarding' ? 'Onboarding details' : 'Request details'}
      />
      <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-gray-50/50 px-3 py-2.5 text-sm"
          >
            <dt className="text-gray-500">{humanizeKey(key)}</dt>
            <dd className="font-medium text-gray-900 sm:text-right break-all">
              {formatGenericValue(key, value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
