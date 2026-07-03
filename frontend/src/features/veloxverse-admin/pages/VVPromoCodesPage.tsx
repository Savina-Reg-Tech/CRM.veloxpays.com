import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Ticket, BarChart3 } from 'lucide-react'
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
import { formatCents } from '../utils'
import type { PromoCode, PromoCodeStats, PromoDiscountType, CreatePromoCodeInput } from '../types'

const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

const SERVICE_OPTIONS = ['ALL', 'ESIM', 'LOUNGE', 'BENEFIT', 'TRAVEL']

const FORM_ID = 'vv-promo-create-form'

function discountLabel(p: PromoCode): string {
  if (p.discountType === 'PERCENTAGE') {
    const pct = `${(p.discountValue / 100).toFixed(0)}%`
    return p.maxDiscountCents ? `${pct} (max ${formatCents(p.maxDiscountCents)})` : pct
  }
  return formatCents(p.discountValue)
}

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-sm font-medium text-gray-700">{text}</label>
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast()
  const create = useVVCreatePromo()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<PromoDiscountType>('FIXED')
  const [discountValue, setDiscountValue] = useState('') // dollars or percent
  const [minPurchase, setMinPurchase] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [services, setServices] = useState<string[]>(['ALL'])
  const [maxUses, setMaxUses] = useState('')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')

  const toggleService = (s: string) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(discountValue)
    if (!code.trim() || !Number.isFinite(value) || value <= 0) return

    const input: CreatePromoCodeInput = {
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      // FIXED: dollars → cents. PERCENTAGE: percent → basis points (10 → 1000).
      discountValue: Math.round(value * 100),
      minPurchaseCents: minPurchase ? Math.round(Number(minPurchase) * 100) : 0,
      maxDiscountCents:
        discountType === 'PERCENTAGE' && maxDiscount ? Math.round(Number(maxDiscount) * 100) : undefined,
      applicableServices: services.length ? services : ['ALL'],
      maxUses: maxUses ? Number(maxUses) : undefined,
      maxUsesPerUser: maxUsesPerUser ? Number(maxUsesPerUser) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }

    try {
      await create.mutateAsync(input)
      showToast({ type: 'success', title: 'Promo code created' })
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Could not create promo code',
      })
    }
  }

  return (
    <form id={FORM_ID} onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          {fieldLabel('Code')}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            className="font-mono"
          />
        </div>
        <div>
          {fieldLabel('Description')}
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Launch offer" />
        </div>
        <div>
          {fieldLabel('Discount type')}
          <select
            className={selectClass}
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
          >
            <option value="FIXED">Fixed ($)</option>
            <option value="PERCENTAGE">Percentage (%)</option>
          </select>
        </div>
        <div>
          {fieldLabel(discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount ($)')}
          <Input
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </div>
        <div>
          {fieldLabel('Min purchase ($)')}
          <Input
            type="number"
            min="0"
            step="0.01"
            value={minPurchase}
            onChange={(e) => setMinPurchase(e.target.value)}
            placeholder="0"
          />
        </div>
        {discountType === 'PERCENTAGE' && (
          <div>
            {fieldLabel('Max discount ($)')}
            <Input
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
            type="number"
            min="0"
            value={maxUsesPerUser}
            onChange={(e) => setMaxUsesPerUser(e.target.value)}
          />
        </div>
        <div>
          {fieldLabel('Expires at')}
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>

      <div>
        {fieldLabel('Applicable services')}
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleService(s)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                services.includes(s)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}

function PromoRow({ promo }: { promo: PromoCode }) {
  const { showToast } = useToast()
  const update = useVVUpdatePromo()
  const [stats, setStats] = useState<PromoCodeStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

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

  return (
    <div className="space-y-2 border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-gray-900">{promo.code}</span>
          <Badge variant="neutral">{discountLabel(promo)}</Badge>
          <span className="text-xs text-gray-500">
            {promo.usageCount}
            {promo.maxUses ? `/${promo.maxUses}` : ''} uses
          </span>
          <span className="text-xs text-gray-500">{promo.applicableServices.join(', ')}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={loadingStats}>
            {loadingStats ? <Spinner size="sm" /> : <BarChart3 className="h-4 w-4" />}
            Stats
          </Button>
          <Switch
            checked={promo.isActive}
            disabled={update.isPending}
            onChange={toggleActive}
            label={promo.isActive ? 'Active' : 'Inactive'}
          />
        </div>
      </div>
      {stats && (
        <p className="text-xs text-gray-500">
          {stats.usageCount} uses · {stats.uniqueUsers} unique users ·{' '}
          {formatCents(stats.totalDiscountCents)} total discount given
        </p>
      )}
    </div>
  )
}

export default function VVPromoCodesPage() {
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useVVPromoCodes(status || undefined)

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
            <p className="text-sm text-gray-500">Create and manage checkout discount codes.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New code
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter</span>
        <select
          className="h-9 w-auto rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
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
            <Button type="submit" form={FORM_ID}>
              Create
            </Button>
          </>
        }
      >
        {creating && <CreateForm onClose={() => setCreating(false)} />}
      </Modal>
    </div>
  )
}
