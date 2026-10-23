// Settings → Email templates: the six Pick & Drop customer-email templates. Switching one off
// stops new drafts from it; existing drafts stay.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PencilLine } from 'lucide-react'
import Switch from '@/components/ui/Switch'
import Skeleton from '@/components/ui/Skeleton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { AuditErrorState } from '../components/audit/AuditUI'
import { useSaveTemplate, useTemplates } from '../hooks/useEmailTemplates'
import { pdErrorText, relativeTime, templateIcon } from '../pickdropEmails'
import type { EmailTemplate } from '../types'
import { PD_EMAILS_BASE, templatePath } from '../components/pickdrop-emails/paths'

export default function VVEmailTemplatesPage() {
  const { data, isLoading, error, refetch } = useTemplates()
  const save = useSaveTemplate()
  const { showToast } = useToast()
  const [turningOff, setTurningOff] = useState<EmailTemplate | null>(null)

  const setEnabled = (t: EmailTemplate, enabled: boolean) =>
    save.mutate(
      { key: t.key, body: { enabled } },
      {
        onSuccess: (tpl) => {
          setTurningOff(null)
          showToast({ type: 'success', title: `${tpl.name} ${enabled ? 'switched on' : 'switched off'}`, message: `Saved as version ${tpl.version}.` })
        },
        onError: (err) => showToast({ type: 'error', title: 'Not saved', message: pdErrorText(err) }),
      },
    )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-1">
        <Link to={PD_EMAILS_BASE} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Customer emails
        </Link>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Email templates</h1>
        <p className="max-w-2xl text-sm text-gray-500">
          The wording VeloxVerse starts each Pick &amp; Drop customer email from. Changes apply to new drafts; every save is kept as a version you can restore.
        </p>
      </div>

      {error ? (
        <AuditErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.templates.map((t) => {
            const Icon = templateIcon(t.key)
            return (
              <li key={t.key} className={cn('flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm', t.enabled ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', t.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500')}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.enabled ? 'Enabled' : 'Switched off'}</p>
                    </div>
                  </div>
                  <Switch
                    checked={t.enabled}
                    disabled={save.isPending}
                    onChange={(on) => (on ? setEnabled(t, true) : setTurningOff(t))}
                  />
                </div>
                {t.description && <p className="text-sm text-gray-600">{t.description}</p>}
                <p className="mt-auto text-xs text-gray-500">
                  v{t.version} · {t.updatedByUserId ? `edited by ${t.updatedByUserId} ${relativeTime(t.updatedAt)}` : 'default wording'}
                </p>
                <Link
                  to={templatePath(t.key)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <PencilLine className="h-4 w-4" /> Edit
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!turningOff}
        onClose={() => setTurningOff(null)}
        onConfirm={() => turningOff && setEnabled(turningOff, false)}
        title={`Switch off “${turningOff?.name ?? ''}”?`}
        message="No new drafts will be made from this template. Existing drafts stay and can still be sent."
        confirmLabel="Switch off"
        loading={save.isPending}
        danger
      />
    </div>
  )
}
