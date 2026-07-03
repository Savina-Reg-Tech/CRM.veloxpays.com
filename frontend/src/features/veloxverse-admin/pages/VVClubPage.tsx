import { useState } from 'react'
import {
  Crown,
  Search,
  Users,
  Tag,
  BarChart3,
  History,
  Eye,
  Ban,
  Plus,
  AlertCircle,
  TrendingUp,
  Award,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import Pagination from '@/components/ui/Pagination'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVClubTiers,
  useVVClubTierBenefits,
  useVVUpdateClubTier,
  useVVClubMembers,
  useVVClubMember,
  useVVClubForceCancel,
  useVVClubPromos,
  useVVCreateClubPromo,
  useVVUpdateClubPromo,
  useVVClubAnalytics,
  useVVClubChangeLog,
} from '../hooks/useVVClub'
import ClubBenefitsEditor from '../components/ClubBenefitsEditor'
import Switch from '@/components/ui/Switch'
import { formatCents, formatDate, formatDateTime, statusBadgeVariant } from '../utils'
import type {
  ClubTierRow,
  ClubMemberRow,
  ClubMembershipDetail,
  ClubPromoRow,
  ClubBenefitVersion,
  ClubMembershipStatus,
} from '../types'

// ─────────────────────────── Constants ────────────────────────────

const PAGE_SIZE = 20

const STATUS_OPTIONS: ClubMembershipStatus[] = ['ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED']

const TIER_COLORS: Record<string, string> = {
  explorer: 'bg-gray-100 text-gray-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-amber-50 text-amber-700',
  platinum: 'bg-violet-50 text-violet-700',
  elite: 'bg-rose-50 text-rose-700',
}

const BENEFIT_LABELS: Record<string, string> = {
  lounge: 'Lounge Access',
  dining: 'Dining Voucher',
  fast_track: 'Fast Track',
  esim: 'Travel eSIM',
  pick_drop: 'Pick & Drop',
  meet_greet: 'Meet & Greet',
  gym: 'Gym Access',
}

// ─────────────────────────── Error Banner ─────────────────────────

function ErrorBanner({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'An error occurred'
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{msg}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// VVClubPage — 5 tabs
// ═══════════════════════════════════════════════════════════════════

type TabKey = 'tiers' | 'members' | 'promos' | 'analytics' | 'changelog'

export default function VVClubPage() {
  const [tab, setTab] = useState<TabKey>('tiers')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">VeloxClub</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tiers" value={tab} onChange={(v: string) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="tiers"><Crown className="mr-1.5 h-4 w-4" />Tiers & Benefits</TabsTrigger>
          <TabsTrigger value="members"><Users className="mr-1.5 h-4 w-4" />Members</TabsTrigger>
          <TabsTrigger value="promos"><Tag className="mr-1.5 h-4 w-4" />Promo Codes</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-4 w-4" />Analytics</TabsTrigger>
          <TabsTrigger value="changelog"><History className="mr-1.5 h-4 w-4" />Change Log</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'tiers' && <TiersTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'promos' && <PromosTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'changelog' && <ChangeLogTab />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab 1 — Tiers & Benefits
// ═══════════════════════════════════════════════════════════════════

function TiersTab() {
  const { data: tiers, isLoading, error } = useVVClubTiers()
  const updateTier = useVVUpdateClubTier()
  const { showToast } = useToast()
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [editingTier, setEditingTier] = useState<ClubTierRow | null>(null)
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})
  const { data: versions } = useVVClubTierBenefits(selectedTierId ?? undefined)

  function savePrice(tier: ClubTierRow) {
    const draft = priceDraft[tier.id] ?? String((tier.annualFeeCents / 100).toFixed(2))
    const cents = Math.round(Number(draft) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      showToast({ title: 'Enter a valid annual price', type: 'error' })
      return
    }
    updateTier.mutate(
      { tierId: tier.id, patch: { annualFeeCents: cents } },
      {
        onSuccess: () => showToast({ title: `${tier.name} price updated`, type: 'success' }),
        onError: (e) => showToast({ title: e instanceof Error ? e.message : 'Update failed', type: 'error' }),
      }
    )
  }

  function toggleActive(tier: ClubTierRow, isActive: boolean) {
    updateTier.mutate(
      { tierId: tier.id, patch: { isActive } },
      {
        onSuccess: () => showToast({ title: `${tier.name} ${isActive ? 'activated' : 'deactivated'}`, type: 'success' }),
        onError: (e) => showToast({ title: e instanceof Error ? e.message : 'Update failed', type: 'error' }),
      }
    )
  }

  if (error) return <ErrorBanner error={error} />
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>

  return (
    <div className="space-y-6">
      {/* Tier rows with edit controls */}
      <div className="space-y-3">
        {tiers?.map((t: ClubTierRow) => {
          const isExplorer = t.slug === 'explorer'
          const draft = priceDraft[t.id] ?? String((t.annualFeeCents / 100).toFixed(2))
          return (
            <div
              key={t.id}
              className="cursor-pointer"
              onClick={() => setSelectedTierId(t.id)}
            >
            <Card
              className={`transition hover:ring-2 hover:ring-primary/30 ${selectedTierId === t.id ? 'ring-2 ring-primary' : ''}`}
              padding="none"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-violet-500 text-white">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[t.slug] ?? 'bg-gray-100 text-gray-700'}`}>
                        {t.name}
                      </span>
                      <Badge variant="neutral">v{t.currentVersion ?? 1}</Badge>
                      {!t.isActive && <Badge variant="danger">Inactive</Badge>}
                      {!t.isPurchasable && <Badge variant="info">Default</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.activeMembers} active member{t.activeMembers === 1 ? '' : 's'}
                      {t.benefits?.point_multiplier ? ` · ${t.benefits.point_multiplier}x points` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {!isExplorer && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500">$</span>
                        <Input
                          value={draft}
                          onChange={(e) => setPriceDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                          className="h-9 w-24"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updateTier.isPending}
                          onClick={() => savePrice(t)}
                        >
                          Save
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Active</span>
                        <Switch
                          checked={t.isActive}
                          onChange={(v) => toggleActive(t, v)}
                        />
                      </div>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setEditingTier(t)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Benefits
                  </Button>
                </div>
              </div>
            </Card>
            </div>
          )
        })}
      </div>

      <ClubBenefitsEditor
        tier={editingTier}
        open={Boolean(editingTier)}
        onClose={() => setEditingTier(null)}
        onSuccess={() => showToast({ title: 'Benefits saved', type: 'success' })}
      />

      {/* Benefit versions for selected tier */}
      {selectedTierId && (
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Benefit History — {tiers?.find((t: ClubTierRow) => t.id === selectedTierId)?.name}</h3>
            {!versions ? (
              <Skeleton className="h-24" />
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500">No benefit versions found.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((v: ClubBenefitVersion) => (
                  <div key={v.id} className={`rounded-lg border p-3 text-sm ${v.isCurrent ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Version {v.version}</span>
                        {v.isCurrent && <Badge variant="success">Current</Badge>}
                      </div>
                      <span className="text-gray-500">{formatDateTime(v.effectiveAt)}</span>
                    </div>
                    {v.changeNote && <p className="text-gray-600 mb-2">{v.changeNote}</p>}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(v.benefits).map(([key, val]: [string, unknown]) => {
                        if (key === 'point_multiplier') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{String(val)}x pts</span>
                        if (key === 'support_level') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">Support: {String(val)}</span>
                        if (key === 'dedicated_manager') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">Manager: {val ? 'Yes' : 'No'}</span>
                        if (key === 'credit_cashback_max_cents') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">Cashback: {formatCents(val as number)}</span>
                        if (key === 'bank_bonus_bdt') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">Bank: {String(val)} BDT</span>
                        const label = BENEFIT_LABELS[key] ?? key
                        const v2 = val as Record<string, unknown>
                        if (v2?.type === 'quota') return <span key={key} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{label}: {String((v2.visits ?? v2.rides) === -1 ? '∞' : (v2.visits ?? v2.rides ?? 0))} free{v2.discount_pct ? ` / ${String(v2.discount_pct)}% off` : ''}</span>
                        if (v2?.type === 'data_grant') return <span key={key} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">{label}: {String(v2.gb)}GB</span>
                        if (v2?.type === 'boolean') return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{label}: {v2.enabled ? 'Yes' : 'No'}</span>
                        return null
                      })}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      {v.changedBy ? `By ${v.changedBy.name} (${v.changedBy.email})` : 'System (seed)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab 2 — Members
// ═══════════════════════════════════════════════════════════════════

function MembersTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [cancelUserId, setCancelUserId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading, error } = useVVClubMembers(page, {
    search: search || undefined,
    tierSlug: tierFilter || undefined,
    status: statusFilter || undefined,
  })
  const { data: memberDetail } = useVVClubMember(selectedUserId ?? undefined)
  const forceCancel = useVVClubForceCancel()
  const { showToast } = useToast()

  function handleCancel() {
    if (!cancelUserId || !cancelReason.trim()) return
    forceCancel.mutate(
      { userId: cancelUserId, reason: cancelReason },
      {
        onSuccess: () => { showToast({ title: 'Membership cancelled', type: 'success' }); setCancelUserId(null); setCancelReason(''); setSelectedUserId(null) },
        onError: (e) => showToast({ title: e instanceof Error ? e.message : 'Cancel failed', type: 'error' }),
      }
    )
  }

  if (error) return <ErrorBanner error={error} />

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or email…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1) }}>
          <option value="">All Tiers</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
          <option value="elite">Elite</option>
        </select>
        <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
                ))
              ) : !data?.members?.length ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No members found</td></tr>
              ) : (
                data.members.map((m: ClubMemberRow) => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-gray-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[m.tierSlug] ?? 'bg-gray-100'}`}>{m.tier}</span>
                    </td>
                    <td className="px-4 py-3"><Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge></td>
                    <td className="px-4 py-3">{formatCents(m.purchasePriceCents)}</td>
                    <td className="px-4 py-3">{formatDate(m.billingCycleEnd)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(m.userId)}><Eye className="h-3.5 w-3.5" /></Button>
                        {(m.status === 'ACTIVE' || m.status === 'PAST_DUE') && (
                          <Button variant="ghost" size="sm" onClick={() => setCancelUserId(m.userId)}><Ban className="h-3.5 w-3.5 text-red-500" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.pagination && (
          <div className="border-t px-4 py-3">
            <Pagination page={data.pagination.page} pageSize={PAGE_SIZE} total={data.pagination.total} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Member Detail Modal */}
      <Modal open={!!selectedUserId && !!memberDetail} onClose={() => setSelectedUserId(null)} title="Member Detail" size="lg">
        {memberDetail && (
          <div className="space-y-4">
            {memberDetail.user && (
              <div className="text-sm">
                <span className="font-medium">{memberDetail.user.name}</span> — {memberDetail.user.email}
              </div>
            )}
            {memberDetail.memberships.map((ms: ClubMembershipDetail) => (
              <div key={ms.id} className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[ms.tierSlug] ?? 'bg-gray-100'}`}>{ms.tier}</span>
                    <Badge variant={statusBadgeVariant(ms.status)}>{ms.status}</Badge>
                    {ms.loyaltyDiscountApplied && <Badge variant="info">Loyalty</Badge>}
                  </div>
                  <span className="text-xs text-gray-500">v{ms.benefitVersion}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div>Paid: <span className="font-medium text-gray-900">{formatCents(ms.purchasePriceCents)}</span></div>
                  <div>Method: {ms.paymentMethod}</div>
                  <div>Cycle: {formatDate(ms.billingCycleStart)} – {formatDate(ms.billingCycleEnd)}</div>
                  <div>Auto-renew: {ms.autoRenew ? 'Yes' : 'No'}</div>
                  <div>Invoice: {ms.invoiceNumber ?? '—'}</div>
                  <div>Order: {ms.orderNo ?? '—'}</div>
                </div>
                {ms.usage.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Usage ({ms.usage.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {ms.usage.map((u, i) => (
                        <span key={i} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {BENEFIT_LABELS[u.benefitKey] ?? u.benefitKey} — {u.bookingType}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Force Cancel Modal */}
      <Modal open={!!cancelUserId} onClose={() => { setCancelUserId(null); setCancelReason('') }} title="Force Cancel Membership">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This will immediately cancel the member's active membership. Benefits stop now.</p>
          <Input placeholder="Reason for cancellation…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setCancelUserId(null); setCancelReason('') }}>Cancel</Button>
            <Button variant="danger" onClick={handleCancel} loading={forceCancel.isPending} disabled={!cancelReason.trim()}>Force Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab 3 — Promo Codes
// ═══════════════════════════════════════════════════════════════════

function PromosTab() {
  const { data: promos, isLoading, error } = useVVClubPromos()
  const createPromo = useVVCreateClubPromo()
  const updatePromo = useVVUpdateClubPromo()
  const { showToast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')

  function handleCreate() {
    if (!code.trim() || !discountValue) return
    createPromo.mutate(
      {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses ? Number(maxUses) : null,
      },
      {
        onSuccess: () => {
          showToast({ title: 'Promo code created', type: 'success' })
          setShowCreate(false); setCode(''); setDiscountValue(''); setMaxUses('')
        },
        onError: (e) => showToast({ title: e instanceof Error ? e.message : 'Create failed', type: 'error' }),
      }
    )
  }

  function toggleActive(promo: ClubPromoRow) {
    updatePromo.mutate(
      { id: promo.id, patch: { isActive: !promo.isActive } },
      {
        onSuccess: () => showToast({ title: `Promo ${promo.isActive ? 'deactivated' : 'activated'}`, type: 'success' }),
        onError: (e) => showToast({ title: e instanceof Error ? e.message : 'Update failed', type: 'error' }),
      }
    )
  }

  if (error) return <ErrorBanner error={error} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-4 w-4" />Create Promo</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Tiers</th>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
                ))
              ) : !promos?.length ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No promo codes yet</td></tr>
              ) : (
                promos.map((p: ClubPromoRow) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
                    <td className="px-4 py-3">
                      {p.discountType === 'PERCENTAGE'
                        ? `${(p.discountValue / 100).toFixed(0)}%`
                        : formatCents(p.discountValue)}
                      {p.maxDiscountCents ? ` (max ${formatCents(p.maxDiscountCents)})` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.applicableTiers.map((t) => (
                          <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.currentUses}{p.maxUses ? `/${p.maxUses}` : ''}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                      {p.firstPurchaseOnly && <Badge variant="info" className="ml-1">1st only</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.expiresAt ? formatDate(p.expiresAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Promo Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Club Promo Code">
        <div className="space-y-4">
          <Input placeholder="Code (e.g. GOLD2026)" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex gap-3">
            <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm flex-1" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}>
              <option value="PERCENTAGE">Percentage (basis points)</option>
              <option value="FIXED">Fixed (cents)</option>
            </select>
            <Input className="flex-1" placeholder={discountType === 'PERCENTAGE' ? 'e.g. 5000 = 50%' : 'e.g. 5000 = $50'} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" />
          </div>
          <Input placeholder="Max uses (blank = unlimited)" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={createPromo.isPending} disabled={!code.trim() || !discountValue}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab 4 — Analytics
// ═══════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data, isLoading, error } = useVVClubAnalytics()

  if (error) return <ErrorBanner error={error} />
  if (isLoading) return <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active Members" value={data.activeMembers} icon={<Users className="h-5 w-5 text-blue-500" />} />
        <StatCard label="MRR" value={`$${data.mrr.toFixed(2)}`} icon={<TrendingUp className="h-5 w-5 text-green-500" />} />
        <StatCard label="Total Revenue" value={formatCents(data.totalRevenueCents)} icon={<Award className="h-5 w-5 text-amber-500" />} />
        <StatCard label="Churn Rate" value={`${(data.churnRate * 100).toFixed(1)}%`} icon={<RefreshCw className="h-5 w-5 text-red-500" />} />
        <StatCard label="Renewal Success" value={`${(data.renewalSuccessRate * 100).toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} />
        <StatCard label="Avg Lifetime Value" value={formatCents(data.avgLifetimeValueCents)} icon={<Award className="h-5 w-5 text-violet-500" />} />
        <StatCard label="Total Memberships" value={data.totalMemberships} icon={<Users className="h-5 w-5 text-gray-500" />} />
        <StatCard label="Upgrades" value={data.upgrades} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} />
      </div>

      {/* By tier */}
      <Card>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-3">Members by Tier</h3>
          <div className="space-y-2">
            {data.byTier.map((t) => (
              <div key={t.slug} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[t.slug] ?? 'bg-gray-100'}`}>{t.name}</span>
                  <span className="text-sm font-medium">{t.count} members</span>
                </div>
                <span className="text-sm font-medium text-green-600">{formatCents(t.revenueCents)} revenue</span>
              </div>
            ))}
            {data.byTier.length === 0 && <p className="text-sm text-gray-400">No active memberships yet</p>}
          </div>
        </div>
      </Card>

      {/* Benefit utilization & promo usage side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">Benefit Utilization</h3>
            {data.benefitUtilization.length === 0 ? (
              <p className="text-sm text-gray-400">No benefits redeemed yet</p>
            ) : (
              <div className="space-y-2">
                {data.benefitUtilization.map((b) => (
                  <div key={b.benefitKey} className="flex items-center justify-between text-sm">
                    <span>{BENEFIT_LABELS[b.benefitKey] ?? b.benefitKey}</span>
                    <span className="font-medium">{b.count} uses</span>
                  </div>
                ))}
              </div>
            )}
            {data.mostRedeemedBenefit && (
              <div className="mt-3 text-xs text-gray-500">Most redeemed: <span className="font-medium">{BENEFIT_LABELS[data.mostRedeemedBenefit] ?? data.mostRedeemedBenefit}</span></div>
            )}
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">Promo Code Usage</h3>
            {data.promoUsage.length === 0 ? (
              <p className="text-sm text-gray-400">No promo codes used yet</p>
            ) : (
              <div className="space-y-2">
                {data.promoUsage.map((p) => (
                  <div key={p.code} className="flex items-center justify-between text-sm">
                    <span className="font-mono">{p.code}</span>
                    <span className="font-medium">{p.count} uses</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Tab 5 — Change Log
// ═══════════════════════════════════════════════════════════════════

function ChangeLogTab() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useVVClubChangeLog(page)

  if (error) return <ErrorBanner error={error} />

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Changed By</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b"><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
              ))
            ) : !data?.changes?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No changes recorded</td></tr>
            ) : (
              data.changes.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[c.tierSlug] ?? 'bg-gray-100'}`}>{c.tier}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">v{c.version}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[300px] truncate">{c.changeNote ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {typeof c.changedBy === 'string' ? c.changedBy : `${c.changedBy.name} (${c.changedBy.email})`}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(c.effectiveAt)}</td>
                  <td className="px-4 py-3">{c.isCurrent ? <Badge variant="success">Current</Badge> : <Badge variant="neutral">Superseded</Badge>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data?.pagination && (
        <div className="border-t px-4 py-3">
          <Pagination page={data.pagination.page} pageSize={PAGE_SIZE} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}
    </Card>
  )
}
