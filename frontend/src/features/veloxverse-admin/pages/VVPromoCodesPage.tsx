import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Ticket, BarChart3, Pencil, Eye } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import Spinner from '@/components/ui/Spinner'
import Skeleton from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVPromoCodes, useVVCreatePromo, useVVUpdatePromo } from '../hooks/useVVPromo'
import { vvPromoService } from '../vvAdminService'
import { ANALYTICS_CURRENCIES } from '../utils'
import { SERVICE_OPTIONS, serviceLabel, discountLabel, formatUsdCents, isPromoExpired, savingsByCurrencyLabel } from '../promo'
import { formatMoney } from '@/lib/utils'
import type { PromoCode, PromoCodeStats, PromoDiscountType, CreatePromoCodeInput, PromoCurrencyAmount } from '../types'

// `text-base` below `sm` keeps iOS Safari from zooming the page when a field gets focus.
const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm'

/** Id of the `<form>` rendered by `PromoForm` — a modal's footer submit button targets it. */
export const PROMO_FORM_ID = 'vv-promo-create-form'

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700">{text}</label>
}

// Checkout currencies that can carry their own promo amounts. USD is the base (the "$" fields
// above), so it isn't repeated here.
const OVERRIDE_CURRENCIES = ANALYTICS_CURRENCIES.filter((c) => c !== 'USD')

type AmountDraft = { min: string; discount: string; max: string }

function centsToInput(cents?: number | null): string {
  return cents == null ? '' : String(cents / 100)
}

/** '' → null (not set); anything else must be a non-negative number, returned as cents (NaN if invalid). */
function inputToCents(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : Number.NaN
}

export function PromoForm({ promo, onClose }: { promo?: PromoCode; onClose: () => void }) {
  const { showToast } = useToast()
  const create = useVVCreatePromo()
  const update = useVVUpdatePromo()
  const editing = Boolean(promo)
  const [code, setCode] = useState(promo?.code ?? '')
  const [description, setDescription] = useState(promo?.description ?? '')
  const [discountType, setDiscountType] = useState<PromoDiscountType>(promo?.discountType ?? 'FIXED')
  // FIXED: dollars. PERCENTAGE: percent.
  const [discountValue, setDiscountValue] = useState(promo ? String(promo.discountValue / 100) : '')
  const [minPurchase, setMinPurchase] = useState(promo?.minPurchaseCents ? centsToInput(promo.minPurchaseCents) : '')
  const [maxDiscount, setMaxDiscount] = useState(centsToInput(promo?.maxDiscountCents))
  const [services, setServices] = useState<string[]>(promo?.applicableServices ?? ['ALL'])
  const [maxUses, setMaxUses] = useState(promo?.maxUses != null ? String(promo.maxUses) : '')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(
    promo ? (promo.maxUsesPerUser != null ? String(promo.maxUsesPerUser) : '') : '1'
  )
  const [expiresAt, setExpiresAt] = useState(promo?.expiresAt ? promo.expiresAt.slice(0, 10) : '')
  const [amounts, setAmounts] = useState<Record<string, AmountDraft>>(() =>
    Object.fromEntries(
      OVERRIDE_CURRENCIES.map((c) => {
        const o = promo?.currencyAmounts?.[c]
        return [c, { min: centsToInput(o?.minPurchaseCents), discount: centsToInput(o?.discountCents), max: centsToInput(o?.maxDiscountCents) }]
      })
    )
  )
  const [error, setError] = useState<string | null>(null)

  const toggleService = (s: string) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const setAmount = (cur: string, field: keyof AmountDraft, value: string) =>
    setAmounts((prev) => ({ ...prev, [cur]: { ...prev[cur], [field]: value } }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = Number(discountValue)
    if (!code.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Enter a code and a discount greater than 0.')
      return
    }
    const minCents = inputToCents(minPurchase)
    const maxCents = discountType === 'PERCENTAGE' ? inputToCents(maxDiscount) : null
    if (Number.isNaN(minCents) || Number.isNaN(maxCents)) {
      setError('Amounts must be numbers of 0 or more.')
      return
    }

    // Per-currency overrides — only the field that applies to this discount type is sent; a blank
    // field is sent as null so the backend falls back to converting the USD amount.
    const currencyAmounts: Record<string, PromoCurrencyAmount> = {}
    for (const cur of OVERRIDE_CURRENCIES) {
      const d = amounts[cur]
      const entry: PromoCurrencyAmount = {
        minPurchaseCents: inputToCents(d.min),
        discountCents: discountType === 'FIXED' ? inputToCents(d.discount) : null,
        maxDiscountCents: discountType === 'PERCENTAGE' ? inputToCents(d.max) : null,
      }
      if (Object.values(entry).some((v) => Number.isNaN(v))) {
        setError(`${cur} amounts must be numbers of 0 or more.`)
        return
      }
      currencyAmounts[cur] = entry
    }

    const input: CreatePromoCodeInput = {
      code: code.trim().toUpperCase(),
      description: description.trim() || (editing ? null : undefined),
      discountType,
      // FIXED: dollars → cents. PERCENTAGE: percent → basis points (10 → 1000).
      discountValue: Math.round(value * 100),
      minPurchaseCents: minCents ?? 0,
      maxDiscountCents: maxCents && maxCents > 0 ? maxCents : editing ? null : undefined,
      applicableServices: services.length ? services : ['ALL'],
      currencyAmounts,
      maxUses: maxUses ? Number(maxUses) : editing ? null : undefined,
      maxUsesPerUser: maxUsesPerUser ? Number(maxUsesPerUser) : editing ? null : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : editing ? null : undefined,
    }

    try {
      if (promo) {
        // The code itself can't be renamed (usage history is keyed to it).
        const { code: _code, ...patch } = input
        void _code
        await update.mutateAsync({ id: promo.id, patch })
        showToast({ type: 'success', title: 'Promo code updated' })
      } else {
        await create.mutateAsync(input)
        showToast({ type: 'success', title: 'Promo code created' })
      }
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : editing ? 'Could not update promo code' : 'Could not create promo code',
      })
    }
  }

  return (
    <form id={PROMO_FORM_ID} onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          {fieldLabel('Code')}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            className="font-mono text-base sm:text-sm"
            disabled={editing}
          />
        </div>
        <div>
          {fieldLabel('Description')}
          <Input className="text-base sm:text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Launch offer" />
        </div>
        <div>
          {fieldLabel('Discount type')}
          <select
            className={selectClass}
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
          >
            <option value="FIXED">Fixed amount</option>
            <option value="PERCENTAGE">Percentage (%)</option>
          </select>
        </div>
        <div>
          {fieldLabel(discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (USD $)')}
          <Input
            className="text-base sm:text-sm"
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </div>
        <div>
          {fieldLabel('Min purchase (USD $)')}
          <Input
            className="text-base sm:text-sm"
            type="number"
            min="0"
            step="0.01"
            value={minPurchase}
            onChange={(e) => setMinPurchase(e.target.value)}
            placeholder="No minimum"
          />
        </div>
        {discountType === 'PERCENTAGE' && (
          <div>
            {fieldLabel('Max discount (USD $)')}
            <Input
              className="text-base sm:text-sm"
              type="number"
              min="0"
              step="0.01"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="No cap"
            />
          </div>
        )}
        <div>
          {fieldLabel('Max total uses')}
          <Input
            className="text-base sm:text-sm"
            type="number"
            min="0"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div>
          {fieldLabel('Max uses / user')}
          <Input
            className="text-base sm:text-sm"
            type="number"
            min="0"
            value={maxUsesPerUser}
            onChange={(e) => setMaxUsesPerUser(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div>
          {fieldLabel('Expires on')}
          <Input className="text-base sm:text-sm" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>

      <div>
        {fieldLabel('Applicable services')}
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleService(value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                services.includes(value)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {fieldLabel('Amounts per currency (optional)')}
        <p className="mb-2 text-xs text-gray-500">
          Enter amounts in each currency itself (e.g. INR in rupees). Leave a field blank to convert the USD
          amount above at the live exchange rate.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OVERRIDE_CURRENCIES.map((cur) => (
            <div key={cur} className="rounded-lg border border-gray-100 p-2">
              <p className="mb-1 text-xs font-semibold text-gray-700">{cur}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-9 text-base sm:h-8 sm:text-sm"
                  value={amounts[cur].min}
                  onChange={(e) => setAmount(cur, 'min', e.target.value)}
                  placeholder="Min · auto"
                  aria-label={`Minimum purchase in ${cur}`}
                />
                {discountType === 'FIXED' ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9 text-base sm:h-8 sm:text-sm"
                    value={amounts[cur].discount}
                    onChange={(e) => setAmount(cur, 'discount', e.target.value)}
                    placeholder="Discount · auto"
                    aria-label={`Discount in ${cur}`}
                  />
                ) : (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9 text-base sm:h-8 sm:text-sm"
                    value={amounts[cur].max}
                    onChange={(e) => setAmount(cur, 'max', e.target.value)}
                    placeholder="Max · auto"
                    aria-label={`Maximum discount in ${cur}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

function PromoRow({ promo }: { promo: PromoCode }) {
  const { showToast } = useToast()
  const update = useVVUpdatePromo()
  const [stats, setStats] = useState<PromoCodeStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [editing, setEditing] = useState(false)
  const overrides = Object.entries(promo.currencyAmounts ?? {}).filter(([, a]) =>
    Object.values(a ?? {}).some((v) => v != null)
  )

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      setStats(await vvPromoService.getStats(promo.id))
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Could not load stats',
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const toggleActive = async (next: boolean) => {
    try {
      await update.mutateAsync({
        id: promo.id,
        patch: { isActive: next } as Partial<CreatePromoCodeInput>,
      })
      showToast({ type: 'success', title: next ? 'Promo code activated' : 'Promo code deactivated' })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Could not update promo code',
      })
    }
  }

  const detailsPath = `/dashboard/veloxverse/promo-codes/${promo.id}`
  const expired = isPromoExpired(promo)

  return (
    <div className="space-y-3 border-b border-gray-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={detailsPath}
              className="break-all font-mono text-base font-bold text-gray-900 hover:text-indigo-600"
            >
              {promo.code}
            </Link>
            <Badge variant="neutral">{discountLabel(promo)}</Badge>
            {expired && <Badge variant="danger">Expired</Badge>}
          </div>
          <p className="text-xs text-gray-500">
            {promo.currentUses ?? promo.usageCount ?? 0}
            {promo.maxUses ? `/${promo.maxUses}` : ''} uses
            {' · '}
            {promo.minPurchaseCents ? `Min ${formatUsdCents(promo.minPurchaseCents)}` : 'No minimum'}
            {' · '}
            {promo.applicableServices.map(serviceLabel).join(', ')}
          </p>
        </div>
        <Switch
          checked={promo.isActive}
          disabled={update.isPending}
          onChange={toggleActive}
          label={promo.isActive ? 'Active' : 'Inactive'}
          className="shrink-0 text-sm text-gray-600"
        />
      </div>
      {overrides.length > 0 && (
        <p className="text-xs text-gray-500">
          {overrides
            .map(([cur, a]) =>
              [
                a.minPurchaseCents != null ? `${cur} min ${formatMoney(a.minPurchaseCents / 100, cur)}` : null,
                a.discountCents != null ? `${cur} off ${formatMoney(a.discountCents / 100, cur)}` : null,
                a.maxDiscountCents != null ? `${cur} max ${formatMoney(a.maxDiscountCents / 100, cur)}` : null,
              ]
                .filter(Boolean)
                .join(', ')
            )
            .join(' · ')}
        </p>
      )}
      {stats && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {stats.totals.uses} uses · {stats.totals.uniqueUsers} unique users · {savingsByCurrencyLabel(stats)}
          {stats.totals.refunded > 0 ? ` · ${stats.totals.refunded} refunded` : ''}
        </p>
      )}
      {/* Actions: an even 3-up grid on phones, a compact inline row from `sm` up. */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Link
          to={detailsPath}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:py-1.5"
        >
          <Eye className="h-4 w-4" />
          <span className="sm:hidden">Details</span>
          <span className="hidden sm:inline">View details</span>
        </Link>
        <Button variant="outline" size="sm" className="justify-center py-2 sm:py-1.5" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-center py-2 sm:py-1.5"
          onClick={loadStats}
          disabled={loadingStats}
        >
          {loadingStats ? <Spinner size="sm" /> : <BarChart3 className="h-4 w-4" />}
          Stats
        </Button>
      </div>
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${promo.code}`}
        description="Changes apply to checkouts from now on."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" form={PROMO_FORM_ID}>
              Save
            </Button>
          </>
        }
      >
        {editing && <PromoForm promo={promo} onClose={() => setEditing(false)} />}
      </Modal>
    </div>
  )
}

export default function VVPromoCodesPage() {
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useVVPromoCodes(status || undefined)

  return (
    <div className="max-w-5xl space-y-5 sm:space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Promo Codes</h1>
            <p className="text-sm text-gray-500">Create and manage checkout discount codes.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="w-full justify-center sm:w-auto">
          <Plus className="h-4 w-4" />
          New code
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter</span>
        <select
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-9 sm:w-auto sm:text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <Card padding="sm" className="sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !data || data.promoCodes.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No promo codes yet.</p>
        ) : (
          <div>
            {data.promoCodes.map((p) => (
              <PromoRow key={p.id} promo={p} />
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New promo code"
        description="Create a new checkout discount code."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" form={PROMO_FORM_ID}>
              Create
            </Button>
          </>
        }
      >
        {creating && <PromoForm onClose={() => setCreating(false)} />}
      </Modal>
    </div>
  )
}
