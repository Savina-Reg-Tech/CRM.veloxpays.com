// "API logs" settings card (§4.5 / §5.9) — admins only, inside the audit Settings tab.
import { useEffect, useId, useState, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import { cn } from '@/lib/utils'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVAuditSettings, useVVAuditUpdateSettings } from '../../hooks/useVVAudit'
import { auditError, auditErrorText } from '../../audit'
import type { ApiLogCapture, ApiLogSettings, AuditSettingsUpdate } from '../../auditTypes'
import { useAuditViewer } from '../audit/AuditUI'

type Draft = { enabled: boolean; capture: ApiLogCapture; bodies: boolean; retentionDays: string }
type Patch = NonNullable<AuditSettingsUpdate['apiLogs']>

const toDraft = (s: ApiLogSettings): Draft => ({ enabled: s.enabled, capture: s.capture, bodies: s.bodies, retentionDays: String(s.retentionDays) })

const REDACTED = [
  'passwords, OTPs, tokens, API keys, secrets and signatures',
  'Authorization and Cookie headers',
  'card number, CVV, expiry and PIN',
  'passport, address and postcode',
  'eSIM activation codes and QR data, lounge pass QR codes',
  'TravelFusion login, Mint transaction token (only its fp:… fingerprint is kept)',
]

const CAPTURE_OPTIONS: Array<{ value: ApiLogCapture; label: string }> = [
  { value: 'all', label: 'Everything (successful reads without bodies)' },
  { value: 'errors_only', label: 'Problems only — errors, timeouts, unknown outcomes and every payment call' },
]

/** Only the keys that differ from what VeloxVerse has. */
export function changedApiLogKeys(draft: Draft, saved: ApiLogSettings): Patch {
  const patch: Patch = {}
  if (draft.enabled !== saved.enabled) patch.enabled = draft.enabled
  if (draft.capture !== saved.capture) patch.capture = draft.capture
  if (draft.bodies !== saved.bodies) patch.bodies = draft.bodies
  const days = Number(draft.retentionDays)
  if (draft.retentionDays.trim() === '' || days !== saved.retentionDays) patch.retentionDays = days
  return patch
}

function SwitchRow({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {help && <div className="mt-0.5 text-sm text-gray-500">{help}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ApiLogSettingsForm({ settings }: { settings: ApiLogSettings }) {
  const { showToast } = useToast()
  const update = useVVAuditUpdateSettings()
  const [saved, setSaved] = useState(settings)
  const [draft, setDraft] = useState(() => toDraft(settings))
  const [serverError, setServerError] = useState<Record<string, string>>({})
  const retentionId = useId()
  const retentionErrId = useId()
  useEffect(() => {
    setSaved(settings)
    setDraft(toDraft(settings))
  }, [settings])

  const { minRetentionDays: min, maxRetentionDays: max } = saved
  const days = Number(draft.retentionDays)
  const retentionInvalid =
    draft.retentionDays.trim() === '' || !Number.isInteger(days) || days < min || days > max ? `Must be a whole number from ${min} to ${max}` : undefined
  const retentionError = retentionInvalid ?? serverError.retentionDays
  const patch = changedApiLogKeys(draft, saved)
  const dirty = Object.keys(patch).length > 0
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setServerError((e) => {
      if (!e[k]) return e
      const next = { ...e }
      delete next[k]
      return next
    })
  }

  const save = async () => {
    if (retentionInvalid || !dirty) return
    try {
      const next = await update.mutateAsync({ apiLogs: patch })
      if (next?.apiLogs) {
        setSaved(next.apiLogs)
        setDraft(toDraft(next.apiLogs))
      }
      setServerError({})
      showToast({ type: 'success', title: 'API log settings saved', message: 'Changes take effect within about a minute.' })
    } catch (error) {
      const info = auditError(error)
      const fields = info.fieldErrors.filter((f) => f.field.startsWith('apiLogs.'))
      if (fields.length) setServerError(Object.fromEntries(fields.map((f) => [f.field.slice('apiLogs.'.length), f.message])))
      showToast({ type: 'error', title: 'Could not save API log settings', message: auditErrorText(error) })
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">API logs</h2>
        <p className="text-sm text-gray-500">Every request to VeloxVerse, supplier call and webhook.</p>
      </div>

      <div className="mt-2 divide-y divide-gray-100">
        <div>
          <SwitchRow title="Record API logs">
            <Switch className="min-h-11" checked={draft.enabled} onChange={(v) => set('enabled', v)} label={draft.enabled ? 'Recording on' : 'Recording off'} />
          </SwitchRow>
          {!draft.enabled && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              New requests and supplier calls won&apos;t be recorded. Journey events continue.
            </p>
          )}
        </div>

        <fieldset className={cn('py-3', !draft.enabled && 'opacity-60')}>
          <legend className="text-sm font-medium text-gray-900">What to record</legend>
          <div className="mt-1 flex flex-col">
            {CAPTURE_OPTIONS.map((o) => (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm text-gray-700">
                <input
                  type="radio"
                  name="apiLogsCapture"
                  value={o.value}
                  checked={draft.capture === o.value}
                  onChange={() => set('capture', o.value)}
                  className="h-4 w-4 shrink-0 border-gray-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <SwitchRow
          title="Store request / response bodies"
          help={
            <>
              Bodies are redacted before storage. Off = metadata only.
              <details className="mt-1">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-indigo-700 md:min-h-0">What is removed</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-600">
                  {REDACTED.map((r) => <li key={r}>{r}</li>)}
                  <li>Emails, phone numbers and names are masked.</li>
                </ul>
              </details>
            </>
          }
        >
          <Switch className="min-h-11" checked={draft.bodies} onChange={(v) => set('bodies', v)} label={draft.bodies ? 'Bodies stored' : 'Bodies off'} />
        </SwitchRow>

        <div className="py-3">
          <label htmlFor={retentionId} className="text-sm font-medium text-gray-900">Keep logs for</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={retentionId}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              value={draft.retentionDays}
              aria-invalid={!!retentionError}
              aria-describedby={retentionErrId}
              onChange={(e) => set('retentionDays', e.target.value)}
              className={cn(
                'h-11 w-full rounded-lg border px-3 text-base tabular-nums focus:outline-none focus:ring-2 md:h-10 md:w-[120px] md:text-sm',
                retentionError ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'
              )}
            />
            <span className="shrink-0 text-sm text-gray-700">days</span>
          </div>
          <p id={retentionErrId} className={cn('mt-1 text-xs', retentionError ? 'text-red-600' : 'text-gray-500')}>
            {retentionError ?? `${min}–${max} days. Older logs are deleted.`}
          </p>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-2 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Changes are recorded with your name. Viewing or exporting logs is recorded too.
      </p>

      <div className="sticky bottom-0 -mx-4 mt-3 border-t border-gray-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:flex md:justify-end md:gap-2 md:border-0 md:p-0">
        <Button
          variant="outline"
          className="hidden md:inline-flex"
          disabled={!dirty || update.isPending}
          onClick={() => {
            setDraft(toDraft(saved))
            setServerError({})
          }}
        >
          Discard
        </Button>
        <Button className="min-h-11 w-full md:min-h-0 md:w-auto" onClick={() => void save()} disabled={!dirty || !!retentionInvalid} loading={update.isPending}>
          Save API log settings
        </Button>
      </div>
    </Card>
  )
}

/** Renders nothing for non-admins or while loading (the page shows its own states); a short note
 * on VeloxVerse builds that don't have API logs yet. */
export default function ApiLogSettingsCard() {
  const { isAdmin } = useAuditViewer()
  const settings = useVVAuditSettings(isAdmin)
  if (!isAdmin || !settings.data) return null
  if (!settings.data.apiLogs) {
    return (
      <Card className="w-full max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-900">API logs</h2>
        <p className="mt-1 text-sm text-gray-500">This VeloxVerse server doesn&apos;t have API logs yet — settings appear here once it does.</p>
      </Card>
    )
  }
  return <ApiLogSettingsForm settings={settings.data.apiLogs} />
}
