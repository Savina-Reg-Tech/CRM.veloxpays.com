import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  DollarSign,
  History,
  Copy,
  Archive,
  Trash2,
  Pencil,
  Send,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import Skeleton from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVPricingRules,
  useVVPricingRule,
  useVVGlobalAudit,
  useVVCreateRule,
  useVVUpdateRule,
  useVVPublishRule,
  useVVArchiveRule,
  useVVDuplicateRule,
  useVVDeleteRule,
} from '../hooks/useVVPricing'
import { formatDateTime, statusBadgeVariant } from '../utils'
import type {
  PricingRule,
  VVRuleStatus,
  VVRuleType,
  VVServiceType,
} from '../types'

// ─────────────────────────── Local helpers / constants ───────────────────────────

const selectClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

/** Format integer cents as a currency string. Inlined — VeloxVerse `formatPrice` has no CRM equivalent. */
function formatPrice(cents: number, currency: string): string {
  const amount = (cents ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

const SERVICE_TYPES: VVServiceType[] = [
  'ALL',
  'LOUNGE',
  'DINING',
  'FAST_TRACK',
  'FITNESS',
  'TRANSFER',
  'FLIGHT',
  'HOTEL',
  'CAR_RENTAL',
  'ESIM',
]

const SERVICE_LABELS: Record<VVServiceType, string> = {
  ALL: 'All Services (global fallback)',
  LOUNGE: 'VeloxLounge — Lounge Access',
  DINING: 'VeloxLounge — Dining',
  FAST_TRACK: 'VeloxLounge — Fast Track',
  FITNESS: 'VeloxLounge — Fitness',
  TRANSFER: 'VeloxAssist — Transfers',
  FLIGHT: 'VeloxTravel — Flights',
  HOTEL: 'VeloxTravel — Hotels',
  CAR_RENTAL: 'VeloxTravel — Car Rental',
  ESIM: 'VeloxeSIM',
}

const RULE_TYPES: VVRuleType[] = ['PROFIT_MARGIN', 'SURGE_PRICING', 'REFUND_PROTECTION']

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

// Payload shape allows nullable date fields (to clear an effective window) while
// remaining assignable to the mutation argument type.
type RulePayload = Omit<Partial<PricingRule>, 'effectiveFrom' | 'effectiveTo'> & {
  effectiveFrom?: string | null
  effectiveTo?: string | null
  changeReason?: string
}

function statusLabel(status: VVRuleStatus): string {
  if (status === 'PUBLISHED') return '🟢 Published'
  if (status === 'DRAFT') return '🟡 Draft'
  return '⚪ Archived'
}

function fmtDate(d?: string): string {
  if (!d) return 'No expiry'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function configSummary(rule: PricingRule): string {
  const c = rule.config
  if (rule.ruleType === 'PROFIT_MARGIN') return `Margin: ${Number(c.percent ?? 0)}%`
  if (rule.ruleType === 'REFUND_PROTECTION')
    return `Refund fee: ${formatPrice(Number(c.feeCents ?? 0), rule.currency)}`
  if (rule.ruleType === 'SURGE_PRICING') {
    const hrs = Number(c.thresholdHours ?? 48)
    const pct = Number(c.surchargePercent ?? 0)
    return `+${pct}% if booked within ${hrs} hours`
  }
  return ''
}

function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// ───────────────────────────── Rule form (create/edit) ─────────────────────────────

function RuleForm({ existing, onClose }: { existing: PricingRule | null; onClose: () => void }) {
  const isEdit = Boolean(existing)
  const { showToast } = useToast()
  const create = useVVCreateRule()
  const update = useVVUpdateRule()

  const [serviceType, setServiceType] = useState<VVServiceType>(existing?.serviceType ?? 'LOUNGE')
  const [ruleType, setRuleType] = useState<VVRuleType>(existing?.ruleType ?? 'PROFIT_MARGIN')
  const [currency, setCurrency] = useState(existing?.currency ?? 'USD')
  const [priority, setPriority] = useState(String(existing?.priority ?? 0))
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInput(existing?.effectiveFrom))
  const [effectiveTo, setEffectiveTo] = useState(toDateInput(existing?.effectiveTo))
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)
  const [changeReason, setChangeReason] = useState('')

  // Config fields
  const initialCfg = (existing?.config ?? {}) as Record<string, unknown>
  const [percent, setPercent] = useState(String(initialCfg.percent ?? 0))
  const [feeDollars, setFeeDollars] = useState(
    initialCfg.feeCents != null ? String(Number(initialCfg.feeCents) / 100) : '8'
  )
  const [feeLabel, setFeeLabel] = useState(
    (initialCfg.feeLabel as string) ?? 'Flexible booking (fully refundable)'
  )
  const [standardLabel, setStandardLabel] = useState(
    (initialCfg.standardLabel as string) ?? 'Standard (non-refundable)'
  )
  const [thresholdHours, setThresholdHours] = useState(String(initialCfg.thresholdHours ?? 48))
  const [surchargePercent, setSurchargePercent] = useState(String(initialCfg.surchargePercent ?? 15))

  const buildConfig = (): Record<string, unknown> => {
    if (ruleType === 'PROFIT_MARGIN') return { percent: Number(percent) }
    if (ruleType === 'REFUND_PROTECTION')
      return { feeCents: Math.round(Number(feeDollars) * 100), feeLabel, standardLabel }
    return {
      thresholdHours: Number(thresholdHours),
      surchargePercent: Number(surchargePercent),
    }
  }

  const pending = create.isPending || update.isPending

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const config = buildConfig()
    const dates = {
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
    }

    try {
      if (isEdit && existing) {
        const payload: RulePayload = {
          config,
          currency,
          priority: Number(priority),
          isActive,
          ...dates,
          changeReason: changeReason.trim() || undefined,
        }
        await update.mutateAsync({
          id: existing.id,
          rule: payload as Partial<PricingRule> & { changeReason?: string },
        })
        showToast({ type: 'success', title: 'Rule updated' })
      } else {
        const payload: RulePayload = {
          serviceType,
          ruleType,
          config,
          currency,
          priority: Number(priority),
          isActive,
          ...dates,
          changeReason: changeReason.trim() || undefined,
        }
        await create.mutateAsync(payload as Partial<PricingRule> & { changeReason?: string })
        showToast({ type: 'success', title: 'Rule created as draft' })
      }
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save pricing rule',
      })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Service Type</label>
          <select
            className={selectClass}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as VVServiceType)}
            disabled={isEdit}
          >
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Rule Type</label>
          <select
            className={selectClass}
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as VVRuleType)}
            disabled={isEdit}
          >
            {RULE_TYPES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Currency</label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
      </div>

      {/* Dynamic config */}
      <div className="space-y-4 rounded-lg bg-gray-50 p-4">
        {ruleType === 'PROFIT_MARGIN' && (
          <div className="space-y-1.5">
            <label className={labelClass}>Margin %</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="500"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </div>
        )}

        {ruleType === 'REFUND_PROTECTION' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Refund fee ({currency})</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={feeDollars}
                onChange={(e) => setFeeDollars(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Refundable label</label>
              <Input value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Standard label</label>
              <Input value={standardLabel} onChange={(e) => setStandardLabel(e.target.value)} />
            </div>
          </div>
        )}

        {ruleType === 'SURGE_PRICING' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Threshold (hours)</label>
              <Input
                type="number"
                min="1"
                max="720"
                value={thresholdHours}
                onChange={(e) => setThresholdHours(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Surge applies when booking is within this many hours. Default: 48 hours.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Surcharge %</label>
              <Input
                type="number"
                min="0"
                max="200"
                step="0.01"
                value={surchargePercent}
                onChange={(e) => setSurchargePercent(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Percentage added on top of (base + margin) for last-minute bookings. Internal — never
                shown to customers.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Effective From</label>
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Effective To (optional)</label>
          <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Priority</label>
          <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-gray-700">Active</p>
          <p className="text-xs text-gray-500">Inactive rules are ignored by the pricing engine.</p>
        </div>
        <Switch checked={isActive} onChange={setIsActive} />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Change reason (audit note)</label>
        <Input
          value={changeReason}
          onChange={(e) => setChangeReason(e.target.value)}
          placeholder="e.g. Q3 margin adjustment"
        />
      </div>

      {!isEdit && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-gray-600">
          ℹ️ Rule will be created as a DRAFT. Publish it when ready.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {isEdit ? 'Save changes' : 'Save as draft'}
        </Button>
      </div>
    </form>
  )
}

// ───────────────────────────── Audit history dialog ─────────────────────────────

function AuditDialog({ ruleId, onClose }: { ruleId: string; onClose: () => void }) {
  const { data, isLoading } = useVVPricingRule(ruleId)
  const audits = data?.audits

  return (
    <Modal open onClose={onClose} title="Rule history" description="Every change made to this pricing rule." size="xl">
      {isLoading || !audits ? (
        <Skeleton className="h-24 w-full" />
      ) : audits.length === 0 ? (
        <p className="text-sm text-gray-500">No history yet.</p>
      ) : (
        <ul className="space-y-3">
          {audits.map((a) => (
            <li key={a.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{a.action}</span>
                <span className="text-xs text-gray-500">{formatDateTime(a.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-500">{a.changedByEmail ?? a.changedById ?? '—'}</p>
              {(a.oldStatus || a.newStatus) && (
                <p className="text-xs text-gray-500">
                  Status: {a.oldStatus ?? '—'} → {a.newStatus ?? '—'}
                </p>
              )}
              {a.changeReason && <p className="mt-1 text-xs italic text-gray-600">“{a.changeReason}”</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// ───────────────────────────── Page ─────────────────────────────

export default function VVPricingPage() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('ALL')
  const statusFilter = tab === 'ALL' ? undefined : tab
  const { data: rules, isLoading } = useVVPricingRules(statusFilter)
  const { data: audit } = useVVGlobalAudit()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PricingRule | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  const publish = useVVPublishRule()
  const archive = useVVArchiveRule()
  const duplicate = useVVDuplicateRule()
  const remove = useVVDeleteRule()

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (rule: PricingRule) => {
    setEditing(rule)
    setShowForm(true)
  }

  const handlePublish = async (id: string) => {
    try {
      await publish.mutateAsync(id)
      showToast({ type: 'success', title: 'Rule published' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to publish rule',
      })
    }
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this rule? It will no longer be applied.')) return
    try {
      await archive.mutateAsync(id)
      showToast({ type: 'success', title: 'Rule archived' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to archive rule',
      })
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicate.mutateAsync(id)
      showToast({ type: 'success', title: 'Rule duplicated as draft' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to duplicate rule',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft rule? This cannot be undone.')) return
    const reason = window.prompt('Reason for deletion (audit note):', '')
    if (reason === null) return
    try {
      await remove.mutateAsync({ id, changeReason: reason.trim() || 'Deleted draft rule' })
      showToast({ type: 'success', title: 'Rule deleted' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete rule',
      })
    }
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard/veloxverse/analytics"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <DollarSign className="h-6 w-6 text-indigo-600" /> Pricing Rules
          </h1>
          <p className="text-sm text-gray-500">
            Margin, surge, and refund-protection rules applied across all bookable services.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create Rule
        </Button>
      </div>

      <Tabs defaultValue="ALL" value={tab} onChange={setTab}>
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <Card className="p-10 text-center text-sm text-gray-500">No pricing rules found.</Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="space-y-3" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {SERVICE_LABELS[rule.serviceType] ?? rule.serviceType} ·{' '}
                    {rule.ruleType.replace(/_/g, ' ')}
                  </span>
                  <Badge variant={statusBadgeVariant(rule.status)}>{statusLabel(rule.status)}</Badge>
                  {rule.priority > 0 && <Badge variant="neutral">Priority {rule.priority}</Badge>}
                  {!rule.isActive && <Badge variant="danger">Inactive</Badge>}
                </div>
                <span className="text-xs text-gray-500">{rule.currency}</span>
              </div>

              <div className="text-sm text-gray-900">{configSummary(rule)}</div>
              <p className="text-xs text-gray-500">
                Effective: {fmtDate(rule.effectiveFrom)} → {fmtDate(rule.effectiveTo)}
              </p>
              {(rule.updatedByEmail || rule.createdByEmail) && (
                <p className="text-xs text-gray-500">
                  Last updated by {rule.updatedByEmail ?? rule.createdByEmail} ·{' '}
                  {fmtDate(rule.updatedAt)}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {rule.status !== 'ARCHIVED' && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {rule.status === 'DRAFT' && (
                  <Button size="sm" onClick={() => handlePublish(rule.id)} loading={publish.isPending}>
                    <Send className="h-3.5 w-3.5" /> Publish
                  </Button>
                )}
                {rule.status === 'PUBLISHED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleArchive(rule.id)}
                    loading={archive.isPending}
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(rule.id)}
                  loading={duplicate.isPending}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHistoryFor(rule.id)}>
                  <History className="h-3.5 w-3.5" /> History
                </Button>
                {rule.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(rule.id)}
                    loading={remove.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" /> Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Global audit trail */}
      {audit && audit.length > 0 && (
        <Card className="space-y-3" padding="md">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <History className="h-4 w-4" /> Recent changes
          </h2>
          <ul className="space-y-2">
            {audit.slice(0, 15).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                <span className="text-gray-900">{formatDateTime(a.createdAt)}</span>
                <span>{a.changedByEmail ?? a.changedById ?? '—'}</span>
                <Badge variant="neutral">{a.action}</Badge>
                {a.changeReason && <span className="italic">“{a.changeReason}”</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit pricing rule' : 'Create pricing rule'}
        description={
          editing
            ? "Update this rule's configuration and effective window."
            : 'New rules start as drafts.'
        }
        size="xl"
      >
        {showForm && <RuleForm existing={editing} onClose={() => setShowForm(false)} />}
      </Modal>

      {historyFor && <AuditDialog ruleId={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}
