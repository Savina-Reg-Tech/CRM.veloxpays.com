import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Star,
  Pencil,
  RefreshCw,
  Plus,
  Search,
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Database,
  Calculator,
  Gift,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import Skeleton from '@/components/ui/Skeleton'
import Pagination from '@/components/ui/Pagination'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVPointsConfig,
  useVVUpdatePointsConfig,
  useVVPointsSettings,
  useVVUpdatePointsSettings,
  useVVPointsUsers,
  useVVUserPoints,
  useVVUserLedgerAll,
  useVVAdjustPoints,
  useVVRecalculateBalance,
  useVVPointsAuditLog,
  useVVPointsDashboard,
  useVVReferralConfig,
  useVVUpdateReferralConfig,
} from '../hooks/useVVPoints'
import { formatDateTime, ANALYTICS_CURRENCIES } from '../utils'
import { buildReferralSummary, referralReasonLabel, type ReferralThreadStatus } from '../referralHistory'
import { formatMoney } from '@/lib/utils'
import type {
  PointsConfigRow,
  PointsSettingsUpdate,
  AdminPointsUser,
  PointsLedgerEntry,
  PointsTransactionType,
  ReferralPointsConfigRow,
} from '../types'

// ─────────────────────────── Helpers ───────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  LOUNGE: 'Lounge', ESIM: 'eSIM', FLIGHT: 'Flights', HOTEL: 'Hotels',
  TRANSFER: 'Transfers', INSURANCE: 'Insurance', MONEY_TRANSFER: 'Money Transfer',
  TUITION: 'Tuition', UTILITY: 'Utility', REFERRAL: 'Referral',
}

const TXN_TYPE_STYLES: Record<PointsTransactionType, { label: string; cls: string }> = {
  EARN:         { label: 'Earned',    cls: 'bg-green-50 text-green-700' },
  REDEEM:       { label: 'Redeemed',  cls: 'bg-blue-50 text-blue-700' },
  EXPIRE:       { label: 'Expired',   cls: 'bg-gray-100 text-gray-600' },
  ADMIN_CREDIT: { label: 'Credit',    cls: 'bg-purple-50 text-purple-700' },
  ADMIN_DEBIT:  { label: 'Debit',     cls: 'bg-red-50 text-red-700' },
  REFERRAL:     { label: 'Referral',  cls: 'bg-amber-50 text-amber-700' },
}

function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString()
}

const PAGE_SIZE = 20

function ErrorBanner({ error }: { error: unknown }) {
  const msg =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (error instanceof Error ? error.message : 'Something went wrong')
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <p className="font-medium">Failed to load data</p>
        <p className="mt-0.5 text-xs text-red-600">{msg}</p>
      </div>
    </div>
  )
}

// ─────────────────────────── Tab 1: Earning Rules ─────────────────

/** Tolerance (percentage points) within which two currencies' % back count as consistent. */
const PERCENT_BACK_TOLERANCE = 0.01

/** Points per unit, shown unrounded up to the 4 dp VeloxVerse stores. */
function fmtRate(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function fmtPercent(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}%`
}

/** At most 4 decimal places — VeloxVerse rejects more with a 400. */
function hasAtMost4Dp(raw: string): boolean {
  return /^\d+(\.\d{1,4})?$/.test(raw.trim())
}

/**
 * Per service: is `percentBack` the same (±tolerance) in every currency, and set for all of them?
 * A mismatch means some currency earns more or less value back than the others.
 */
function findInconsistentServices(config: PointsConfigRow[]): Map<string, string> {
  const byService = new Map<string, PointsConfigRow[]>()
  for (const row of config) {
    const list = byService.get(row.serviceType) ?? []
    list.push(row)
    byService.set(row.serviceType, list)
  }
  const issues = new Map<string, string>()
  for (const [service, rows] of byService) {
    const missing = rows.filter((r) => r.percentBack == null).map((r) => r.currency)
    if (missing.length) {
      issues.set(service, `No redemption rate for ${missing.join(', ')}`)
      continue
    }
    const values = rows.map((r) => r.percentBack as number)
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (max - min > PERCENT_BACK_TOLERANCE) {
      issues.set(service, `% back ranges from ${fmtPercent(min)} to ${fmtPercent(max)} across currencies`)
    }
  }
  return issues
}

/**
 * REFERRAL never appears in `config` — its rows are filtered server-side (see
 * `pointsAdminService.listConfig` in veloxverse), since that reward moved to the dedicated
 * Refer & Earn config (the "Referral" tab below). Every row here is a genuine (service,
 * currency) earning rule: `pointsPerUnit` is a direct, admin-set points count per 1 unit of
 * that row's `currency` (decimals allowed) — not a monetary value converted via live FX. Points
 * are earned on the card-paid amount only; `percentBack` is computed by VeloxVerse.
 */
function EarningRulesTab() {
  const { data: config, isLoading, error } = useVVPointsConfig()
  const { data: settings } = useVVPointsSettings()
  const updateMut = useVVUpdatePointsConfig()
  const { showToast } = useToast()
  const [currency, setCurrency] = useState<string>('USD')
  const [editRow, setEditRow] = useState<PointsConfigRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDesc, setEditDesc] = useState('')

  function openEdit(row: PointsConfigRow) {
    setEditRow(row)
    setEditValue(String(row.pointsPerUnit))
    setEditDesc(row.description ?? '')
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!editRow || !hasAtMost4Dp(editValue)) return
    const pts = Number(editValue)
    if (!Number.isFinite(pts) || pts < 0 || pts > 100000) return
    updateMut.mutate(
      { id: editRow.id, patch: { pointsPerUnit: pts, description: editDesc || undefined } },
      {
        onSuccess: () => { showToast({ type: 'success', title: 'Earning rule updated' }); setEditRow(null) },
        onError: () => showToast({ type: 'error', title: 'Failed to update rule' }),
      }
    )
  }

  function toggleActive(row: PointsConfigRow) {
    updateMut.mutate(
      { id: row.id, patch: { isActive: !row.isActive } },
      {
        onSuccess: () => showToast({ type: 'success', title: `${SERVICE_LABELS[row.serviceType] ?? row.serviceType} (${row.currency}) ${!row.isActive ? 'enabled' : 'disabled'}` }),
        onError: () => showToast({ type: 'error', title: 'Toggle failed' }),
      }
    )
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />

  const allRows = config ?? []
  const rows = allRows.filter((r) => r.currency === currency)
  const inconsistent = findInconsistentServices(allRows)

  // "Match USD % back" helper: usdPointsPerUnit × redeem[CUR] ÷ redeem.USD, rounded to 4 dp.
  const redeem = settings?.pointsPerUnitRedeem ?? {}
  const usdRow = editRow ? allRows.find((r) => r.serviceType === editRow.serviceType && r.currency === 'USD') : undefined
  const curRedeem = editRow ? redeem[editRow.currency] : null
  const usdRedeem = redeem.USD
  const suggested =
    editRow && editRow.currency !== 'USD' && usdRow && curRedeem && usdRedeem
      ? Math.round((usdRow.pointsPerUnit * curRedeem / usdRedeem) * 10000) / 10000
      : null
  const editValid = hasAtMost4Dp(editValue) && Number(editValue) <= 100000
  const previewPercent = editValid && curRedeem ? (Number(editValue) / curRedeem) * 100 : null

  return (
    <>
      <Card className="p-4 mb-4">
        <p className="text-sm text-gray-600">
          <Calculator className="inline h-4 w-4 mr-1 text-indigo-500" />
          Points are earned on the <strong>card-paid amount only</strong> — not on VeloxClub discounts, credit balance or
          redeemed points. Each currency has its own fixed rate (decimals allowed, up to 4 places); there is no live FX.
          “% back” is before the VeloxClub tier multiplier (up to 3×).
        </p>
      </Card>

      {inconsistent.size > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">% back is not consistent across currencies</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {[...inconsistent].map(([service, msg]) => (
                <li key={service}><strong>{SERVICE_LABELS[service] ?? service}</strong>: {msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Each currency has its own independent set of rates — no live FX conversion between
          them, an admin tunes each one directly. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Currency:</span>
        {ANALYTICS_CURRENCIES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setCurrency(code)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              code === currency
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Service</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Points / 1 {currency}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">% back</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Version</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const issue = inconsistent.get(row.serviceType)
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {SERVICE_LABELS[row.serviceType] ?? row.serviceType}
                    {issue && <span className="ml-2" title={issue}><Badge variant="warning">Inconsistent</Badge></span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmtRate(row.pointsPerUnit)}</td>
                  <td className={`px-4 py-3 ${row.percentBack == null ? 'text-amber-700' : 'text-gray-700'}`}>
                    {row.percentBack == null ? 'Redemption off' : fmtPercent(row.percentBack)}
                  </td>
                  <td className="px-4 py-3"><Switch checked={row.isActive} onChange={() => toggleActive(row)} /></td>
                  <td className="px-4 py-3 text-gray-500">v{row.version}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(row.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No earning rules configured for {currency} yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit ${SERVICE_LABELS[editRow?.serviceType ?? ''] ?? ''} Earning Rule (${editRow?.currency ?? ''})`} size="md">
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Points per 1 {editRow?.currency ?? 'unit'} paid by card
            </label>
            <Input type="number" min={0} max={100000} step="0.0001" value={editValue} onChange={(e) => setEditValue(e.target.value)} required />
            {!editValid && editValue !== '' && (
              <p className="mt-1 text-xs text-red-600">Enter a number from 0 to 100,000 with at most 4 decimal places.</p>
            )}
          </div>
          {suggested != null && usdRow && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <span>
                Match USD ({fmtPercent(usdRow.percentBack)} back): <strong>{fmtRate(suggested)}</strong> pts/{editRow?.currency}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditValue(String(suggested))}>Use</Button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="e.g., INR transfer — 1% back" />
          </div>
          {editRow && (
            <p className="text-xs text-gray-500">
              Current: {fmtRate(editRow.pointsPerUnit)} pts/{editRow.currency} ({fmtPercent(editRow.percentBack)} back) → New:{' '}
              {editValue || '0'} pts/{editRow.currency}
              {previewPercent != null && <> ({fmtPercent(Math.round(previewPercent * 10000) / 10000)} back)</>}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button type="submit" loading={updateMut.isPending} disabled={!editValid}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ─────────────────────────── Tab: Referral (Refer & Earn) ─────────
// CRM is the source of truth for the Refer & Earn reward: one row per supported preferred
// currency, each a direct admin-set points count (not a monetary value converted via FX) for
// both the referrer and the referee. VeloxVerse applies the row matching each recipient's own
// preferred currency at award time — see points-referral.service.ts#awardReferralPoints.

function ReferralConfigTab() {
  const { data: config, isLoading, error } = useVVReferralConfig()
  const updateMut = useVVUpdateReferralConfig()
  const { showToast } = useToast()
  const [editRow, setEditRow] = useState<ReferralPointsConfigRow | null>(null)
  const [referrerValue, setReferrerValue] = useState('')
  const [refereeValue, setRefereeValue] = useState('')

  function openEdit(row: ReferralPointsConfigRow) {
    setEditRow(row)
    setReferrerValue(String(row.referrerPoints))
    setRefereeValue(String(row.refereePoints))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!editRow) return
    const referrerPoints = parseInt(referrerValue, 10)
    const refereePoints = parseInt(refereeValue, 10)
    if (isNaN(referrerPoints) || referrerPoints < 0 || isNaN(refereePoints) || refereePoints < 0) return
    updateMut.mutate(
      { id: editRow.id, patch: { referrerPoints, refereePoints } },
      {
        onSuccess: () => { showToast({ type: 'success', title: `${editRow.currency} referral reward updated` }); setEditRow(null) },
        onError: () => showToast({ type: 'error', title: 'Failed to update referral reward' }),
      }
    )
  }

  function toggleActive(row: ReferralPointsConfigRow) {
    updateMut.mutate(
      { id: row.id, patch: { isActive: !row.isActive } },
      {
        onSuccess: () => showToast({ type: 'success', title: `${row.currency} referral reward ${!row.isActive ? 'enabled' : 'disabled'}` }),
        onError: () => showToast({ type: 'error', title: 'Toggle failed' }),
      }
    )
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />

  return (
    <>
      <Card className="p-4 mb-4">
        <p className="text-sm text-gray-600">
          <Gift className="inline h-4 w-4 mr-1 text-indigo-500" />
          Each currency's reward is a fixed points count set here — not a dollar amount converted at a live rate — so
          the value can never drift after a referral is redeemed. VeloxVerse prices each side of a referral by that
          person's own Preferred Currency.
        </p>
        <ul className="mt-2 list-disc pl-5 text-xs text-gray-500 space-y-0.5">
          <li>Rewards are paid when the new customer completes their first <strong>card-paid</strong> booking. If that booking is cancelled or refunded, the rewards are reversed and paid again on their next card-paid booking.</li>
          <li>Bookings fully covered by a VeloxClub benefit, credit or points don't qualify.</li>
          <li>Codes are rejected for customers who already have a completed or refunded paid booking, and for referral loops (someone using the code of a person they referred).</li>
          <li>Deactivating a referred user claws back the referrer's reward (the referee keeps their welcome bonus). See each user's Refer &amp; Earn history under User Points.</li>
        </ul>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Currency</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Referrer earns</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Referee earns</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Version</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(config ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.currency}</td>
                <td className="px-4 py-3 text-gray-700">{fmtNum(row.referrerPoints)} pts</td>
                <td className="px-4 py-3 text-gray-700">{fmtNum(row.refereePoints)} pts</td>
                <td className="px-4 py-3"><Switch checked={row.isActive} onChange={() => toggleActive(row)} /></td>
                <td className="px-4 py-3 text-gray-500">v{row.version}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(row.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {(config ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No currencies configured yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit ${editRow?.currency ?? ''} Referral Reward`} size="md">
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Referrer points (per successful referral)</label>
            <Input type="number" min={0} value={referrerValue} onChange={(e) => setReferrerValue(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Referee points (sign-up welcome bonus)</label>
            <Input type="number" min={0} value={refereeValue} onChange={(e) => setRefereeValue(e.target.value)} required />
          </div>
          {editRow && (
            <p className="text-xs text-gray-500">
              Current: {fmtNum(editRow.referrerPoints)} / {fmtNum(editRow.refereePoints)} pts → New: {referrerValue || '0'} / {refereeValue || '0'} pts
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button type="submit" loading={updateMut.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ─────────────────────────── Tab 2: Global Settings ───────────────

type SettingsNumberKey = 'minRedeemPoints' | 'maxRedeemPerDayCents' | 'pointsExpiryDays'

const SETTINGS_FIELDS: { label: string; key: SettingsNumberKey; suffix: string; help: string }[] = [
  { label: 'Minimum Redeem', key: 'minRedeemPoints', suffix: 'pts', help: 'Minimum points required to redeem' },
  { label: 'Daily cap (USD cents)', key: 'maxRedeemPerDayCents', suffix: 'USD cents (0 = no cap)', help: 'Maximum value a customer can redeem per day, in USD cents, valued at the fixed USD redemption rate' },
  { label: 'Points Expiry', key: 'pointsExpiryDays', suffix: 'days (0 = never)', help: 'Days until earned points expire' },
]

/**
 * Redemption is a fixed "points to redeem 1 <CUR>" rate per currency (`pointsPerUnitRedeem`).
 * No live FX: a currency with no rate has redemption switched off for its customers.
 */
function GlobalSettingsTab() {
  const { data: settings, isLoading, error } = useVVPointsSettings()
  const updateMut = useVVUpdatePointsSettings()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [nums, setNums] = useState<Record<SettingsNumberKey, string>>({ minRedeemPoints: '', maxRedeemPerDayCents: '', pointsExpiryDays: '' })
  const [rates, setRates] = useState<Record<string, string>>({})

  function startEdit() {
    if (!settings) return
    setNums({
      minRedeemPoints: String(settings.minRedeemPoints),
      maxRedeemPerDayCents: String(settings.maxRedeemPerDayCents),
      pointsExpiryDays: String(settings.pointsExpiryDays),
    })
    setRates(Object.fromEntries(ANALYTICS_CURRENCIES.map((c) => [c, settings.pointsPerUnitRedeem?.[c] != null ? String(settings.pointsPerUnitRedeem[c]) : ''])))
    setEditing(true)
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />
  if (!settings) return null

  const current = settings.pointsPerUnitRedeem ?? {}
  const isPosInt = (v: string) => /^\d+$/.test(v.trim()) && Number(v) >= 1
  const isNonNegInt = (v: string) => /^\d+$/.test(v.trim())

  // Only changed currencies are sent. A blank field for a currency that already has a rate is not
  // sent (the API can't clear a rate) — it's treated as "unchanged" and flagged in the form.
  const rateChanges = ANALYTICS_CURRENCIES
    .filter((c) => rates[c]?.trim() && isPosInt(rates[c]) && Number(rates[c]) !== current[c])
    .map((c) => ({ cur: c, from: current[c] ?? null, to: Number(rates[c]) }))
  const numChanges = SETTINGS_FIELDS
    .filter((f) => isNonNegInt(nums[f.key]) && Number(nums[f.key]) !== settings[f.key])
    .map((f) => ({ ...f, from: settings[f.key], to: Number(nums[f.key]) }))
  const invalidRate = ANALYTICS_CURRENCIES.some((c) => rates[c]?.trim() && !isPosInt(rates[c]))
  const invalidNum = SETTINGS_FIELDS.some((f) => !isNonNegInt(nums[f.key] ?? ''))
  const canSave = !invalidRate && !invalidNum && (rateChanges.length > 0 || numChanges.length > 0)

  function handleSave() {
    const patch: PointsSettingsUpdate = {}
    if (rateChanges.length) patch.pointsPerUnitRedeem = Object.fromEntries(rateChanges.map((r) => [r.cur, r.to]))
    for (const n of numChanges) patch[n.key] = n.to
    updateMut.mutate(patch, {
      onSuccess: () => { showToast({ type: 'success', title: 'Settings updated' }); setConfirmOpen(false); setEditing(false) },
      onError: (err) => showToast({
        type: 'error',
        title: 'Failed to update settings',
        message: (err as { response?: { data?: { message?: string } } })?.response?.data?.message,
      }),
    })
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Global Points Settings</h3>
            <p className="text-sm text-gray-500">Version {settings.version} · Last updated {formatDateTime(settings.updatedAt)}</p>
          </div>
          {!editing && <Button size="sm" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
        </div>

        {editing ? (
          <div className="space-y-4">
            {SETTINGS_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="max-w-[200px]"
                    value={nums[f.key]}
                    onChange={(e) => setNums((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">{f.suffix}</span>
                </div>
                {!isNonNegInt(nums[f.key]) && <p className="text-xs text-red-600 mt-0.5">Enter a whole number, 0 or more.</p>}
                <p className="text-xs text-gray-400 mt-0.5">{f.help}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SETTINGS_FIELDS.map((f) => (
              <div key={f.key} className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {fmtNum(settings[f.key])} <span className="text-sm font-normal text-gray-400">{f.suffix}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 mt-4">
        <p className="text-sm font-medium text-gray-900 mb-1">Redemption rate by currency</p>
        <p className="text-xs text-gray-500 mb-3">
          Fixed points needed to redeem 1 unit of each currency — exactly what customers see and pay at checkout. No live
          exchange rates are used. A currency without a rate has redemption switched off.
          {settings.pointsExpiryDays > 0 ? <> Points expire after <strong>{settings.pointsExpiryDays} days</strong>.</> : <> Points <strong>never expire</strong>.</>}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ANALYTICS_CURRENCIES.map((cur) => {
            const pts = current[cur] ?? null
            const draft = rates[cur] ?? ''
            const draftBad = draft.trim() !== '' && !isPosInt(draft)
            return (
              <div key={cur} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Points to redeem 1 {cur}</p>
                  {pts == null && <Badge variant="warning">Redemption off</Badge>}
                </div>
                {editing ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className="h-8"
                      value={draft}
                      placeholder="Not set"
                      onChange={(e) => setRates((p) => ({ ...p, [cur]: e.target.value }))}
                    />
                    {draftBad ? (
                      <p className="mt-1 text-xs text-red-600">Whole number, 1 or more</p>
                    ) : draft.trim() === '' && pts != null ? (
                      <p className="mt-1 text-xs text-amber-700">Blank keeps {fmtNum(pts)} — rates can’t be cleared here</p>
                    ) : draft.trim() !== '' ? (
                      <p className="mt-1 text-xs text-gray-400">{fmtNum(Number(draft))} pts = {formatMoney(1, cur)}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-gray-900">
                    {pts == null ? '—' : <>{fmtNum(pts)} pts = {formatMoney(1, cur)}</>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          If you change a currency’s redemption rate, update its earning rates too (Earning Rules → “Match USD”), or its % back will drift.
        </p>
      </Card>

      {editing && (
        <div className="flex gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canSave}>Review Changes</Button>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm points settings changes" size="md">
        <div className="space-y-4 pt-2">
          {rateChanges.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Redemption rates (points to redeem 1 unit)</p>
              <ul className="space-y-1 text-sm">
                {rateChanges.map((r) => (
                  <li key={r.cur} className="flex items-center gap-2">
                    <span className="w-10 font-mono text-xs text-gray-500">{r.cur}</span>
                    <span className="text-red-500 line-through">{r.from == null ? 'off' : fmtNum(r.from)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-600">{fmtNum(r.to)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {numChanges.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Other settings</p>
              <ul className="space-y-1 text-sm">
                {numChanges.map((n) => (
                  <li key={n.key}>
                    {n.label}: <span className="text-red-500 line-through">{fmtNum(n.from)}</span>
                    <span className="mx-1 text-gray-400">→</span>
                    <span className="font-medium text-green-600">{fmtNum(n.to)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rateChanges.length > 0 && (
            <p className="text-xs text-amber-700">Earning rates for these currencies are not changed automatically — re-check their % back afterwards.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button type="button" onClick={handleSave} loading={updateMut.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─────────────────────────── Tab 3: User Points ───────────────────

const REFERRAL_STATUS_STYLES: Record<ReferralThreadStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  REWARDED: { label: 'Rewarded', variant: 'success' },
  REVERSED: { label: 'Reversed — pending next card-paid booking', variant: 'warning' },
  REVOKED: { label: 'Revoked — account blocked', variant: 'danger' },
}

/** Refer & Earn history for one user, rebuilt from their REFERRAL ledger rows. */
function ReferralHistory({ userId }: { userId: string }) {
  const { data, isLoading, error } = useVVUserLedgerAll(userId)
  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />
  if (error) return <ErrorBanner error={error} />
  const summary = buildReferralSummary(data ?? [])
  if (summary.threads.length === 0) return <p className="text-sm text-gray-400">No referral activity</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        <strong>{summary.rewardedCount}</strong> referral{summary.rewardedCount === 1 ? '' : 's'} currently rewarded ·{' '}
        <strong>{fmtNum(summary.pointsInForce)}</strong> pts in force
        <span className="text-gray-400"> (reversed awards not counted)</span>
      </p>
      {summary.threads.map((t, i) => {
        const st = REFERRAL_STATUS_STYLES[t.status]
        return (
          <div key={t.counterpartyId ?? `unknown-${i}`} className="rounded-lg border border-gray-200 p-3 text-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-700">
                {t.role === 'referee' ? 'Referred by ' : t.role === 'referrer' ? 'Referred ' : 'Referral with '}
                {t.counterpartyId ? (
                  <Link to={`/dashboard/veloxverse/users/${t.counterpartyId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                    {t.counterpartyId.slice(0, 8)}…
                  </Link>
                ) : (
                  <span className="text-gray-400">unknown user</span>
                )}
                {t.role === 'referee' && <span className="text-gray-400"> (welcome bonus)</span>}
              </span>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <ol className="space-y-1 text-xs">
              {t.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-32 text-gray-400">{formatDateTime(e.createdAt)}</span>
                  <span className={`font-medium ${e.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {e.amount >= 0 ? '+' : ''}{fmtNum(e.amount)}
                  </span>
                  <span className="text-gray-600">
                    {e.kind === 'award' ? `Awarded${e.bookingRef ? ` · booking ${e.bookingRef}` : ''}` : referralReasonLabel(e.reason)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

/** Metadata fields are optional — rows written before the card-only earning release lack them. */
function metaNum(meta: Record<string, unknown> | null, key: string): number | null {
  const v = meta?.[key]
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function LedgerDetails({ entry }: { entry: PointsLedgerEntry }) {
  const meta = entry.metadata
  if (entry.type === 'EARN' && entry.amount > 0) {
    const spent = metaNum(meta, 'amount_spent_cents')
    const cur = (meta?.amount_spent_currency as string | undefined) ?? null
    if (spent == null || !cur) return <span className="text-gray-400">—</span>
    const excluded = [
      ['club', metaNum(meta, 'excluded_club_discount_cents')],
      ['credit', metaNum(meta, 'excluded_credit_cents')],
      ['points', metaNum(meta, 'excluded_points_cents')],
    ].filter(([, v]) => (v as number | null) != null && (v as number) > 0) as [string, number][]
    const mult = metaNum(meta, 'club_multiplier')
    return (
      <div>
        <p className="text-gray-700">Earned on {formatMoney(spent / 100, cur)}{mult && mult !== 1 ? ` · ${mult}× club` : ''}</p>
        {excluded.length > 0 && (
          <p className="text-gray-400">Excluded: {excluded.map(([k, v]) => `${k} ${formatMoney(v / 100, cur)}`).join(' · ')}</p>
        )}
      </div>
    )
  }
  if (entry.type === 'REDEEM' && entry.amount < 0) {
    const applied = metaNum(meta, 'applied_cents')
    const cur = (meta?.currency as string | undefined) ?? null
    const rate = metaNum(meta, 'points_per_unit_redeem')
    if (applied == null || !cur) return <span className="text-gray-400">—</span>
    return (
      <p className="text-gray-700">
        {formatMoney(applied / 100, cur)} off{rate != null ? <span className="text-gray-400"> · {fmtNum(rate)} pts = {formatMoney(1, cur)}</span> : null}
      </p>
    )
  }
  if (entry.type === 'REFERRAL' && entry.amount < 0) {
    return <span className="text-red-600">{referralReasonLabel(meta?.reason as string | undefined)}</span>
  }
  if (entry.type === 'EARN' && entry.amount < 0 && meta?.clawback_of) {
    // Points earned on a booking that was later cancelled.
    return <span className="text-red-600">Reversed: booking cancelled</span>
  }
  if (entry.type === 'REDEEM' && entry.amount > 0) {
    return <span className="text-gray-500">Returned (payment {entry.referenceId ?? '—'})</span>
  }
  return <span className="text-gray-400">—</span>
}

function UserPointsTab() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<AdminPointsUser | null>(null)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const { data, isLoading, error } = useVVPointsUsers(page, search || undefined)
  const { data: userDetail } = useVVUserPoints(selectedUser?.id, ledgerPage)
  const adjustMut = useVVAdjustPoints()
  const recalcMut = useVVRecalculateBalance()
  const { showToast } = useToast()

  function doSearch(e: FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleAdjust(e: FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    const amt = parseInt(adjustAmount, 10)
    if (isNaN(amt) || amt === 0 || !adjustReason.trim()) return
    adjustMut.mutate(
      { userId: selectedUser.id, amount: amt, reason: adjustReason.trim() },
      {
        onSuccess: () => {
          showToast({ type: 'success', title: `${amt > 0 ? 'Credited' : 'Debited'} ${Math.abs(amt)} points` })
          setAdjustOpen(false); setAdjustAmount(''); setAdjustReason('')
        },
        onError: () => showToast({ type: 'error', title: 'Adjustment failed' }),
      }
    )
  }

  function handleRecalc() {
    if (!selectedUser) return
    recalcMut.mutate(selectedUser.id, {
      onSuccess: (res) => {
        if (res.drift === 0) showToast({ type: 'success', title: 'Balance is correct — no drift detected' })
        else showToast({ type: 'success', title: `Drift corrected: ${res.previousBalance} → ${res.correctBalance}` })
      },
      onError: () => showToast({ type: 'error', title: 'Recalculation failed' }),
    })
  }

  // ── User Detail Drawer ──
  if (selectedUser && userDetail) {
    const u = userDetail.user
    const b = userDetail.balance
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setLedgerPage(1) }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
        </Button>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{u.firstName ?? ''} {u.lastName ?? ''}</h3>
              <p className="text-sm text-gray-500">{u.email}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adjust
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRecalc} loading={recalcMut.isPending}>
                <RefreshCw className="h-4 w-4 mr-1" /> Recalculate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="text-xl font-bold text-amber-700">{fmtNum(b.balance)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-gray-500">Lifetime Earned</p>
              <p className="text-xl font-bold text-green-700">{fmtNum(b.lifetimeEarned)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-xs text-gray-500">Lifetime Redeemed</p>
              <p className="text-xl font-bold text-blue-700">{fmtNum(b.lifetimeRedeemed)}</p>
            </div>
          </div>

          <h4 className="text-sm font-medium text-gray-700 mb-2">Points History</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Details</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Balance After</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {userDetail.history.map((e: PointsLedgerEntry) => {
                  const st = TXN_TYPE_STYLES[e.type] ?? { label: e.type, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                      <td className={`px-3 py-2 font-medium ${e.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{e.amount >= 0 ? '+' : ''}{fmtNum(e.amount)}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[280px] truncate">{e.description ?? '—'}</td>
                      <td className="px-3 py-2 text-xs"><LedgerDetails entry={e} /></td>
                      <td className="px-3 py-2 text-gray-500">{fmtNum(e.balanceAfter)}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  )
                })}
                {userDetail.history.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No history</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {userDetail.pagination.totalPages > 1 && (
            <div className="mt-3 flex justify-center">
              <Pagination page={ledgerPage} pageSize={PAGE_SIZE} total={userDetail.pagination.total} onPageChange={setLedgerPage} />
            </div>
          )}

          <h4 className="mt-6 mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Gift className="h-4 w-4 text-indigo-500" /> Refer &amp; Earn history
          </h4>
          <ReferralHistory userId={u.id} />
        </Card>

        {/* Adjust modal */}
        <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust Points" size="md">
          <form onSubmit={handleAdjust} className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (positive = credit, negative = debit)</label>
              <Input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="e.g., 500 or -200" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason (required)</label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g., Compensation for service issue" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button type="submit" loading={adjustMut.isPending}>Confirm</Button>
            </div>
          </form>
        </Modal>
      </div>
    )
  }

  // ── User List ──
  return (
    <div className="space-y-4">
      <form onSubmit={doSearch} className="flex gap-2 max-w-md">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email..."
        />
        <Button type="submit" size="sm"><Search className="h-4 w-4" /></Button>
      </form>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : error ? (
        <ErrorBanner error={error} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Balance</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Earned</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Redeemed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.users ?? []).map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setSelectedUser(u); setLedgerPage(1) }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.firstName ?? ''} {u.lastName ?? ''}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{fmtNum(u.balance)}</td>
                    <td className="px-4 py-3 text-green-600">{fmtNum(u.lifetimeEarned)}</td>
                    <td className="px-4 py-3 text-blue-600">{fmtNum(u.lifetimeRedeemed)}</td>
                    <td className="px-4 py-3"><Badge variant="neutral">{u.role}</Badge></td>
                  </tr>
                ))}
                {(data?.users ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination page={page} pageSize={PAGE_SIZE} total={data.pagination.total} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────── Tab 4: Change Log ────────────────────

function ChangeLogTab() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useVVPointsAuditLog(page)

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Admin</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Table</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Field</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Old → New</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.entries ?? []).map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(e.createdAt)}</td>
                <td className="px-4 py-3 text-gray-700">{e.adminName}{e.adminEmail ? ` (${e.adminEmail})` : ''}</td>
                <td className="px-4 py-3"><Badge variant="neutral">{e.table.replace('points_', '')}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{e.fieldName}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="text-red-500 line-through">{e.oldValue ?? '—'}</span>
                  <span className="mx-1 text-gray-400">→</span>
                  <span className="text-green-600 font-medium">{e.newValue ?? '—'}</span>
                </td>
              </tr>
            ))}
            {(data?.entries ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No changes recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Tab 5: Dashboard ─────────────────────

function DashboardTab() {
  const { data, isLoading, error } = useVVPointsDashboard()

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />
  if (!data) return null

  const t = data.totals
  const r = data.redemptions
  const a = data.adminAdjustments

  const statCards: { label: string; value: string; icon: typeof Star; color: string }[] = [
    { label: 'Total Issued', value: fmtNum(t.totalIssued), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Total Redeemed', value: fmtNum(t.totalRedeemed), icon: TrendingDown, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Expired', value: fmtNum(t.totalExpired), icon: AlertCircle, color: 'text-gray-500 bg-gray-100' },
    { label: 'Outstanding', value: fmtNum(t.outstandingPoints), icon: Star, color: 'text-amber-600 bg-amber-50' },
    { label: 'Liability (USD equivalent)', value: formatMoney(t.outstandingLiability, 'USD'), icon: Database, color: 'text-red-600 bg-red-50' },
    { label: 'Redemptions', value: fmtNum(r.count), icon: Calculator, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Avg Redemption (USD equivalent)', value: formatMoney(r.averageValue, 'USD'), icon: Calculator, color: 'text-violet-600 bg-violet-50' },
    { label: 'Admin Credits', value: `${fmtNum(a.creditCount)} (+${fmtNum(a.creditTotal)})`, icon: Plus, color: 'text-purple-600 bg-purple-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${s.color.split(' ')[1]}`}>
                <s.icon className={`h-5 w-5 ${s.color.split(' ')[0]}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-semibold text-gray-900">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Ledger stats */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Database className="h-4 w-4 text-gray-400" />
          Ledger: <strong>{fmtNum(data.ledgerStats.totalRows)}</strong> rows
          {data.ledgerStats.oldestEntry && <> · Oldest entry: <strong>{formatDateTime(data.ledgerStats.oldestEntry)}</strong></>}
        </div>
      </Card>

      {/* Top users */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" /> Top 10 Users by Lifetime Earned
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Earned</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.topUsers.map((u, i) => (
                <tr key={u.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2 font-semibold text-green-600">{fmtNum(u.lifetimeEarned)}</td>
                  <td className="px-4 py-2 text-amber-700">{fmtNum(u.balance)}</td>
                </tr>
              ))}
              {data.topUsers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────── Main Page ─────────────────────────────

export default function VVPointsPage() {
  const [tab, setTab] = useState('rules')

  return (
    <div className="max-w-full space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Star className="h-6 w-6 text-amber-500" /> Points System
        </h1>
        <p className="text-sm text-gray-500">
          Configure earning rates, redemption settings, manage user points, and view analytics.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules" value={tab} onChange={setTab}>
        <TabsList>
          <TabsTrigger value="rules">Earning Rules</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="settings">Global Settings</TabsTrigger>
          <TabsTrigger value="users">User Points</TabsTrigger>
          <TabsTrigger value="log">Change Log</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <div className="pt-2">
        {tab === 'rules' && <EarningRulesTab />}
        {tab === 'referral' && <ReferralConfigTab />}
        {tab === 'settings' && <GlobalSettingsTab />}
        {tab === 'users' && <UserPointsTab />}
        {tab === 'log' && <ChangeLogTab />}
        {tab === 'dashboard' && <DashboardTab />}
      </div>
    </div>
  )
}
