import { useState } from 'react'
import { Eye, Phone, Clock } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useForm, useLeads, useUpdateLeadStatus } from '@/features/forms/hooks/useForms'
import { formApi } from '@/features/forms/formService'
import { SubmissionDataView } from '@/features/forms/utils/submissionDisplay'
import type { Lead, LeadStatus } from '@/features/forms/types'

// VeloxVerse's own "Meet & Greet" customer page (frontend/src/app/dashboard/velox-assist/meet-greet)
// doesn't book anything in VeloxVerse's database — it just embeds THIS CRM's public form builder
// (see VeloxVerse's frontend/src/lib/crm-embed.ts: MEET_GREET_CRM_FORM_ID = 7, pointed at this
// CRM's /embed/7). Submissions already land natively in this CRM's own forms/leads tables, so no
// VeloxVerse backend change was needed here — this just surfaces that existing data inside
// VeloxAssist instead of leaving it only reachable from Forms > Submissions.
const MEET_GREET_FORM_ID = 7

const STATUS_FILTERS: { value: '' | LeadStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'CONVERTED', label: 'Confirmed' },
  { value: 'SPAM', label: 'Spam' },
]

const STATUS_BADGE: Record<LeadStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  NEW: 'neutral',
  REVIEW: 'warning',
  CONVERTED: 'success',
  SPAM: 'danger',
}

function LeadCard({ lead, onViewMore }: { lead: Lead; onViewMore: (l: Lead) => void }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{lead.name || 'Unnamed request'}</p>
          <p className="truncate text-xs text-gray-500">{lead.email || '—'}</p>
        </div>
        <Badge variant={STATUS_BADGE[lead.status] ?? 'neutral'}>{lead.status}</Badge>
      </div>

      {lead.phone && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          {lead.phone}
        </span>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {new Date(lead.created_at).toLocaleString()}
        </span>
        <Button variant="outline" size="sm" onClick={() => onViewMore(lead)}>
          <Eye className="h-3.5 w-3.5" />
          View more
        </Button>
      </div>
    </Card>
  )
}

export default function MeetGreetSection() {
  const [status, setStatus] = useState<'' | LeadStatus>('')
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const { data: form } = useForm(MEET_GREET_FORM_ID)
  const { data, isLoading, isError, refetch } = useLeads({
    form_id: MEET_GREET_FORM_ID,
    status: status || undefined,
    limit: 60,
  })
  const updateStatus = useUpdateLeadStatus()

  const leads = data?.items ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {form?.name ?? 'Meet & Greet'} requests, captured from the form embedded on VeloxVerse's Meet
        &amp; Greet booking page (this CRM's own Form #{MEET_GREET_FORM_ID}). Mark a request{' '}
        <span className="font-medium text-gray-700">Confirmed</span> once your team has arranged the
        greeter, or <span className="font-medium text-gray-700">Spam</span> to dismiss it.
      </p>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'ALL'}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === f.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-gray-500">
            Could not load Meet &amp; Greet requests. If Form #{MEET_GREET_FORM_ID} was deleted or
            recreated with a different id in Forms, this page will need updating to match.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-500">
          {status ? 'No requests match this filter.' : 'No Meet & Greet requests yet.'}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onViewMore={setDetailLead} />
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      <Modal
        open={!!detailLead}
        onClose={() => setDetailLead(null)}
        title={detailLead?.name || 'Meet & Greet request'}
        description={detailLead?.email ?? undefined}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailLead(null)}>
              Close
            </Button>
            {detailLead && detailLead.status !== 'CONVERTED' && (
              <Button
                onClick={() =>
                  updateStatus.mutate(
                    { id: detailLead.id, status: 'CONVERTED' },
                    { onSuccess: () => setDetailLead(null) }
                  )
                }
                loading={updateStatus.isPending}
              >
                Mark confirmed
              </Button>
            )}
          </>
        }
      >
        {detailLead && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={STATUS_BADGE[detailLead.status] ?? 'neutral'}>{detailLead.status}</Badge>
              <span className="text-xs text-gray-400">
                Submitted {new Date(detailLead.created_at).toLocaleString()}
              </span>
            </div>
            {detailLead.phone && (
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <Phone className="h-4 w-4 text-gray-400" />
                {detailLead.phone}
              </p>
            )}
            <SubmissionDataView
              data={detailLead.submission_data}
              formJson={form?.form_json}
              fileUrl={(fieldId) => formApi.leadFileUrl(detailLead.id, fieldId)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
