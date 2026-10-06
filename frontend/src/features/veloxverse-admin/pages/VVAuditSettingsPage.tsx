import { useEffect, useState, type ReactNode } from 'react'
import { Info, Lock, Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import Switch from '@/components/ui/Switch'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVAuditDeleteRecipient,
  useVVAuditMeta,
  useVVAuditRecipients,
  useVVAuditSaveRecipient,
  useVVAuditSettings,
  useVVAuditTestRecipient,
  useVVAuditUpdateSettings,
} from '../hooks/useVVAudit'
import { alertTypeLabel, auditError, auditErrorText, humanize, serviceLabel } from '../audit'
import type { AlertRecipient, AlertRecipientInput, AuditSettings, AuditThresholds } from '../auditTypes'
import { AuditEmpty, AuditErrorState, AuditPageShell, AuditTime, MultiSelect, selectClass, useAuditViewer } from '../components/audit/AuditUI'

const DEFAULT_THRESHOLDS: AuditThresholds = {
  spikeCount: 10,
  spikeWindowMinutes: 15,
  errorRatePercent: 5,
  errorRateWindowMinutes: 5,
  supplierConsecutiveFailures: 5,
  supplierFailureRatePercent: 50,
  supplierWindowMinutes: 5,
  paymentDeclineRatePercent: 30,
  paymentWindowMinutes: 15,
  cooldownMinutes: 30,
}

type FieldErrors = Record<string, string>

function NumberBox({
  value,
  onChange,
  min,
  max,
  error,
  label,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  error?: string
  label: string
}) {
  return (
    <span className="inline-flex flex-col">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className={`mx-1 h-8 w-20 rounded-md border px-2 text-sm tabular-nums ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
      />
      {error && <span className="mx-1 text-xs text-red-600">{error}</span>}
    </span>
  )
}

function Sentence({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-y-1 py-2 text-sm text-gray-700">{children}</div>
}

// ── Retention + alert settings ──────────────────────────────────────

function SettingsForm({ settings }: { settings: AuditSettings }) {
  const { showToast } = useToast()
  const update = useVVAuditUpdateSettings()
  const [draft, setDraft] = useState(settings)
  const [errors, setErrors] = useState<FieldErrors>({})
  useEffect(() => setDraft(settings), [settings])

  const t = draft.thresholds
  const setT = (k: keyof AuditThresholds, v: number) => setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [k]: v } }))
  const err = (f: string) => errors[f] ?? errors[`thresholds.${f}`]
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  // Client-side checks mirror VeloxVerse's (it re-validates and returns field errors anyway).
  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    const range = (f: string, v: number, lo: number, hi: number) => {
      if (!Number.isInteger(v) || v < lo || v > hi) e[f] = `Must be a whole number from ${lo} to ${hi}`
    }
    range('retentionDays', draft.retentionDays, Math.max(5, settings.minRetentionDays ?? 5), 90)
    range('summaryRetentionDays', draft.summaryRetentionDays, 5, 1095)
    if (!e.summaryRetentionDays && draft.summaryRetentionDays < draft.retentionDays) e.summaryRetentionDays = 'Must be at least the detailed-log days'
    range('thresholds.spikeCount', t.spikeCount, 1, 10000)
    range('thresholds.spikeWindowMinutes', t.spikeWindowMinutes, 1, 1440)
    range('thresholds.errorRatePercent', t.errorRatePercent, 1, 100)
    range('thresholds.errorRateWindowMinutes', t.errorRateWindowMinutes, 1, 1440)
    range('thresholds.supplierConsecutiveFailures', t.supplierConsecutiveFailures, 1, 10000)
    range('thresholds.supplierFailureRatePercent', t.supplierFailureRatePercent, 1, 100)
    range('thresholds.supplierWindowMinutes', t.supplierWindowMinutes, 1, 1440)
    range('thresholds.paymentDeclineRatePercent', t.paymentDeclineRatePercent, 1, 100)
    range('thresholds.paymentWindowMinutes', t.paymentWindowMinutes, 1, 1440)
    range('thresholds.cooldownMinutes', t.cooldownMinutes, 5, 1440)
    return e
  }

  const save = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    // Send only what changed.
    const body: Record<string, unknown> = {}
    if (draft.retentionDays !== settings.retentionDays) body.retentionDays = draft.retentionDays
    if (draft.summaryRetentionDays !== settings.summaryRetentionDays) body.summaryRetentionDays = draft.summaryRetentionDays
    if (draft.alertsEnabled !== settings.alertsEnabled) body.alertsEnabled = draft.alertsEnabled
    const changedT = Object.fromEntries(Object.entries(t).filter(([k, v]) => settings.thresholds[k as keyof AuditThresholds] !== v))
    if (Object.keys(changedT).length) body.thresholds = changedT
    try {
      await update.mutateAsync(body)
      showToast({ type: 'success', title: 'Settings saved', message: 'Changes take effect within about a minute.' })
    } catch (error) {
      const info = auditError(error)
      if (info.fieldErrors.length) setErrors(Object.fromEntries(info.fieldErrors.map((f) => [f.field, f.message])))
      showToast({ type: 'error', title: 'Could not save settings', message: auditErrorText(error) })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Retention</h2>
          <p className="text-xs text-gray-500">Detailed events older than this are deleted after their daily summary is made.</p>
        </div>
        <Sentence>
          Keep detailed logs for
          <NumberBox label="Detailed log days" value={draft.retentionDays} min={5} max={90} error={err('retentionDays')} onChange={(n) => setDraft((d) => ({ ...d, retentionDays: n }))} />
          days (5–90)
        </Sentence>
        <Sentence>
          Keep daily summaries for
          <NumberBox label="Summary days" value={draft.summaryRetentionDays} min={5} max={1095} error={err('summaryRetentionDays')} onChange={(n) => setDraft((d) => ({ ...d, summaryRetentionDays: n }))} />
          days (at least the detailed days, up to 1095)
        </Sentence>
      </Card>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Alert emails</h2>
            <p className="text-xs text-gray-500">Critical problems email immediately; spikes when they cross these thresholds.</p>
          </div>
          <Switch checked={draft.alertsEnabled} onChange={(v) => setDraft((d) => ({ ...d, alertsEnabled: v }))} label={draft.alertsEnabled ? 'Alerts on' : 'Alerts off'} />
        </div>
        <div className={draft.alertsEnabled ? '' : 'pointer-events-none opacity-50'}>
          <Sentence>
            Error spike: the same error
            <NumberBox label="Spike count" value={t.spikeCount} min={1} max={10000} error={err('spikeCount')} onChange={(n) => setT('spikeCount', n)} />
            times within
            <NumberBox label="Spike window" value={t.spikeWindowMinutes} min={1} max={1440} error={err('spikeWindowMinutes')} onChange={(n) => setT('spikeWindowMinutes', n)} />
            minutes
          </Sentence>
          <Sentence>
            Server errors above
            <NumberBox label="Error rate" value={t.errorRatePercent} min={1} max={100} error={err('errorRatePercent')} onChange={(n) => setT('errorRatePercent', n)} />
            % of requests within
            <NumberBox label="Error rate window" value={t.errorRateWindowMinutes} min={1} max={1440} error={err('errorRateWindowMinutes')} onChange={(n) => setT('errorRateWindowMinutes', n)} />
            minutes
          </Sentence>
          <Sentence>
            Supplier down after
            <NumberBox label="Consecutive failures" value={t.supplierConsecutiveFailures} min={1} max={10000} error={err('supplierConsecutiveFailures')} onChange={(n) => setT('supplierConsecutiveFailures', n)} />
            failures in a row, or
            <NumberBox label="Supplier failure rate" value={t.supplierFailureRatePercent} min={1} max={100} error={err('supplierFailureRatePercent')} onChange={(n) => setT('supplierFailureRatePercent', n)} />
            % failing within
            <NumberBox label="Supplier window" value={t.supplierWindowMinutes} min={1} max={1440} error={err('supplierWindowMinutes')} onChange={(n) => setT('supplierWindowMinutes', n)} />
            minutes
          </Sentence>
          <Sentence>
            Payment issue when declines exceed
            <NumberBox label="Decline rate" value={t.paymentDeclineRatePercent} min={1} max={100} error={err('paymentDeclineRatePercent')} onChange={(n) => setT('paymentDeclineRatePercent', n)} />
            % within
            <NumberBox label="Payment window" value={t.paymentWindowMinutes} min={1} max={1440} error={err('paymentWindowMinutes')} onChange={(n) => setT('paymentWindowMinutes', n)} />
            minutes
          </Sentence>
          <Sentence>
            Email about the same alert at most once every
            <NumberBox label="Cooldown" value={t.cooldownMinutes} min={5} max={1440} error={err('cooldownMinutes')} onChange={(n) => setT('cooldownMinutes', n)} />
            minutes
          </Sentence>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, thresholds: { ...DEFAULT_THRESHOLDS } }))}>
          Reset thresholds to defaults
        </Button>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Last changed <AuditTime iso={settings.updatedAt} />
          {settings.updatedBy && <> by {settings.updatedBy}</>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || update.isPending} onClick={() => { setDraft(settings); setErrors({}) }}>Discard</Button>
          <Button onClick={() => void save()} disabled={!dirty} loading={update.isPending}>Save settings</Button>
        </div>
      </div>
    </div>
  )
}

// ── Recipients ──────────────────────────────────────────────────────

const EMPTY_RECIPIENT: AlertRecipientInput = { email: '', name: '', alertTypes: [], minSeverity: 'high', services: [], isActive: true }

function RecipientModal({ open, onClose, recipient }: { open: boolean; onClose: () => void; recipient: AlertRecipient | null }) {
  const meta = useVVAuditMeta()
  const save = useVVAuditSaveRecipient()
  const { showToast } = useToast()
  const [form, setForm] = useState<AlertRecipientInput>(EMPTY_RECIPIENT)
  const [errors, setErrors] = useState<FieldErrors>({})
  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      recipient
        ? {
            email: recipient.email,
            name: recipient.name ?? '',
            alertTypes: recipient.alertTypes,
            minSeverity: recipient.minSeverity === 'info' ? 'low' : recipient.minSeverity,
            services: recipient.services,
            isActive: recipient.isActive,
          }
        : EMPTY_RECIPIENT
    )
  }, [open, recipient])

  const types = meta.data?.alertTypes ?? ['critical', 'spike', 'supplier_down', 'payment_issue', 'downtime', 'daily_digest']
  const toggleType = (t: string) =>
    setForm((f) => ({ ...f, alertTypes: f.alertTypes?.includes(t) ? f.alertTypes.filter((x) => x !== t) : [...(f.alertTypes ?? []), t] }))

  const submit = async () => {
    const email = form.email?.trim() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErrors({ email: 'Enter a valid email address' })
    try {
      await save.mutateAsync({ id: recipient?.id, body: { ...form, email, name: form.name?.trim() || null } })
      showToast({ type: 'success', title: recipient ? 'Recipient updated' : 'Recipient added', message: email })
      onClose()
    } catch (err) {
      const info = auditError(err)
      if (info.status === 409) return setErrors({ email: 'This email is already a recipient' })
      if (info.fieldErrors.length) return setErrors(Object.fromEntries(info.fieldErrors.map((f) => [f.field.split('.')[0], f.message])))
      showToast({ type: 'error', title: 'Could not save recipient', message: auditErrorText(err) })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipient ? 'Edit alert recipient' : 'Add alert recipient'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} loading={save.isPending}>{recipient ? 'Save' : 'Add recipient'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={errors.email} helperText={errors.email ? undefined : 'Stored lower-case; must be unique.'} />
          <Input label="Name (optional)" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ops on-call" />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Alert types</legend>
          <p className="mb-2 text-xs text-gray-500">None ticked = every immediate alert type. The daily digest is opt-in — tick it to receive it.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {types.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.alertTypes?.includes(t) ?? false} onChange={() => toggleType(t)} className="rounded border-gray-300 text-indigo-600" />
                {alertTypeLabel(t)}{t === 'daily_digest' && <span className="text-xs text-gray-500">(opt-in)</span>}
              </label>
            ))}
          </div>
          {errors.alertTypes && <p className="mt-1 text-xs text-red-600">{errors.alertTypes}</p>}
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Minimum severity</span>
            <select value={form.minSeverity} onChange={(e) => setForm((f) => ({ ...f, minSeverity: e.target.value as AlertRecipientInput['minSeverity'] }))} className={selectClass}>
              {(['low', 'medium', 'high', 'critical'] as const).map((s) => <option key={s} value={s}>{humanize(s)}{s === 'high' ? ' (default)' : ''}</option>)}
            </select>
            <span className="mt-1 block text-xs text-gray-500">Only alerts at least this severe (not applied to the digest).</span>
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Services</span>
            <MultiSelect label={form.services?.length ? 'Selected services' : 'All services'} options={meta.data?.services ?? []} value={form.services ?? []} onChange={(v) => setForm((f) => ({ ...f, services: v }))} format={serviceLabel} />
            <span className="mt-1 block text-xs text-gray-500">Empty = all. Alerts with no service (e.g. downtime) always go.</span>
          </div>
        </div>
        <Switch checked={form.isActive ?? true} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label={form.isActive ? 'Active — receives alerts' : 'Paused — receives nothing'} />
      </div>
    </Modal>
  )
}

function Recipients() {
  const { showToast } = useToast()
  const query = useVVAuditRecipients()
  const del = useVVAuditDeleteRecipient()
  const test = useVVAuditTestRecipient()
  const save = useVVAuditSaveRecipient()
  const [editing, setEditing] = useState<AlertRecipient | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<AlertRecipient | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const sendTest = async (r: AlertRecipient) => {
    setTestingId(r.id)
    try {
      const res = await test.mutateAsync(r.id)
      showToast({ type: 'success', title: 'Test email sent', message: res.email })
    } catch (err) {
      showToast({ type: 'error', title: 'Test email failed', message: auditErrorText(err) })
    } finally {
      setTestingId(null)
    }
  }

  const toggleActive = async (r: AlertRecipient, isActive: boolean) => {
    try {
      await save.mutateAsync({ id: r.id, body: { isActive } })
    } catch (err) {
      showToast({ type: 'error', title: 'Could not update recipient', message: auditErrorText(err) })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      showToast({ type: 'success', title: 'Recipient removed', message: deleting.email })
      setDeleting(null)
    } catch (err) {
      showToast({ type: 'error', title: 'Could not remove recipient', message: auditErrorText(err) })
    }
  }

  const recipients = query.data ?? []
  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Alert recipients</h2>
          <p className="text-xs text-gray-500">Who VeloxVerse emails when something goes wrong.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus className="h-4 w-4" /> Add recipient</Button>
      </div>
      {query.isLoading ? (
        <div className="flex justify-center py-10"><Spinner size="md" /></div>
      ) : query.isError ? (
        <AuditErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : recipients.length === 0 ? (
        <div className="space-y-3 p-4">
          <p className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            No recipients yet. Until you add one, VeloxVerse sends immediate alerts to its fallback list (AUDIT_ALERT_FALLBACK_EMAILS on the VeloxVerse server) — and nobody gets the daily digest.
          </p>
          <AuditEmpty icon={Mail} title="No alert recipients" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Recipient</th>
                <th className="px-4 py-2.5">Alert types</th>
                <th className="px-4 py-2.5">Min severity</th>
                <th className="px-4 py-2.5">Services</th>
                <th className="px-4 py-2.5">Active</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipients.map((r) => (
                <tr key={r.id} className={r.isActive ? undefined : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.email}</p>
                    {r.name && <p className="text-xs text-gray-500">{r.name}</p>}
                  </td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.alertTypes.length === 0 ? <Badge variant="neutral">All immediate</Badge> : r.alertTypes.map((t) => <Badge key={t} variant={t === 'daily_digest' ? 'info' : 'neutral'}>{alertTypeLabel(t)}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.minSeverity}</td>
                  <td className="max-w-[14rem] px-4 py-3 text-xs text-gray-700">{r.services.length ? r.services.map(serviceLabel).join(', ') : 'All services'}</td>
                  <td className="px-4 py-3"><Switch checked={r.isActive} onChange={(v) => void toggleActive(r, v)} disabled={save.isPending} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => void sendTest(r)} loading={testingId === r.id} title="Send test email"><Send className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setModalOpen(true) }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} title="Remove"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RecipientModal open={modalOpen} onClose={() => setModalOpen(false)} recipient={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Remove alert recipient?"
        message={`${deleting?.email ?? ''} will stop receiving audit alerts.`}
        confirmLabel="Remove"
        danger
        loading={del.isPending}
      />
    </Card>
  )
}

/** Retention, alert thresholds and recipients — admins only (§7.11). */
export default function VVAuditSettingsPage() {
  const { isAdmin } = useAuditViewer()
  const settings = useVVAuditSettings(isAdmin)

  return (
    <AuditPageShell title="Audit log settings" subtitle="Retention, alert emails and who receives them.">
      {!isAdmin ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Only admins can change audit log settings.</p>
          </div>
        </Card>
      ) : (
        <>
          {settings.isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="md" label="Loading settings…" /></div>
          ) : settings.isError || !settings.data ? (
            <Card><AuditErrorState error={settings.error} onRetry={() => void settings.refetch()} /></Card>
          ) : (
            <SettingsForm settings={settings.data} />
          )}
          <Recipients />
        </>
      )}
    </AuditPageShell>
  )
}
