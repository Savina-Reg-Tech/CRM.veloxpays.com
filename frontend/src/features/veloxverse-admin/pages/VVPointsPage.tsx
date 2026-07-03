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
  useVVAdjustPoints,
  useVVRecalculateBalance,
  useVVPointsAuditLog,
  useVVPointsDashboard,
} from '../hooks/useVVPoints'
import { formatDateTime } from '../utils'
import type {
  PointsConfigRow,
  PointsSettings,
  AdminPointsUser,
  PointsLedgerEntry,
  PointsTransactionType,
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

function EarningRulesTab() {
  const { data: config, isLoading, error } = useVVPointsConfig()
  const updateMut = useVVUpdatePointsConfig()
  const { showToast } = useToast()
  const [editRow, setEditRow] = useState<PointsConfigRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDesc, setEditDesc] = useState('')

  function openEdit(row: PointsConfigRow) {
    setEditRow(row)
    setEditValue(String(row.pointsPerDollar))
    setEditDesc(row.description ?? '')
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!editRow) return
    const pts = parseInt(editValue, 10)
    if (isNaN(pts) || pts < 0) return
    updateMut.mutate(
      { id: editRow.id, patch: { pointsPerDollar: pts, description: editDesc || undefined } },
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
        onSuccess: () => showToast({ type: 'success', title: `${SERVICE_LABELS[row.serviceType] ?? row.serviceType} ${!row.isActive ? 'enabled' : 'disabled'}` }),
        onError: () => showToast({ type: 'error', title: 'Toggle failed' }),
      }
    )
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Service</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Points / $1</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Active</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Version</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(config ?? []).map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{SERVICE_LABELS[row.serviceType] ?? row.serviceType}</td>
                <td className="px-4 py-3 text-gray-700">{row.serviceType === 'REFERRAL' ? `${fmtNum(row.pointsPerDollar)} flat` : fmtNum(row.pointsPerDollar)}</td>
                <td className="px-4 py-3"><Switch checked={row.isActive} onChange={() => toggleActive(row)} /></td>
                <td className="px-4 py-3 text-gray-500">v{row.version}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(row.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit ${SERVICE_LABELS[editRow?.serviceType ?? ''] ?? ''} Earning Rule`} size="md">
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {editRow?.serviceType === 'REFERRAL' ? 'Points (flat reward)' : 'Points per $1 spent'}
            </label>
            <Input type="number" min={0} value={editValue} onChange={(e) => setEditValue(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="e.g., Q3 promo — double points" />
          </div>
          {editRow && (
            <p className="text-xs text-gray-500">
              Current: {fmtNum(editRow.pointsPerDollar)} pts{editRow.serviceType !== 'REFERRAL' ? '/$1' : ' flat'} → New: {editValue || '0'} pts{editRow.serviceType !== 'REFERRAL' ? '/$1' : ' flat'}
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

function GlobalSettingsTab() {
  const { data: settings, isLoading, error } = useVVPointsSettings()
  const updateMut = useVVUpdatePointsSettings()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<PointsSettings>>({})

  function startEdit() {
    if (!settings) return
    setForm({
      pointsPerDollarRedeem: settings.pointsPerDollarRedeem,
      minRedeemPoints: settings.minRedeemPoints,
      maxRedeemPerDayCents: settings.maxRedeemPerDayCents,
      pointsExpiryDays: settings.pointsExpiryDays,
    })
    setEditing(true)
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    updateMut.mutate(form, {
      onSuccess: () => { showToast({ type: 'success', title: 'Settings updated' }); setEditing(false) },
      onError: () => showToast({ type: 'error', title: 'Failed to update settings' }),
    })
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
  if (error) return <ErrorBanner error={error} />
  if (!settings) return null

  const fields: { label: string; key: keyof PointsSettings; suffix: string; help: string }[] = [
    { label: 'Redemption Rate', key: 'pointsPerDollarRedeem', suffix: 'pts = $1', help: 'How many points equal one dollar when redeeming' },
    { label: 'Minimum Redeem', key: 'minRedeemPoints', suffix: 'pts', help: 'Minimum points required to redeem' },
    { label: 'Daily Redeem Cap', key: 'maxRedeemPerDayCents', suffix: 'cents (0=no limit)', help: 'Maximum dollar value redeemable per day in cents' },
    { label: 'Points Expiry', key: 'pointsExpiryDays', suffix: 'days (0=never)', help: 'Days until earned points expire' },
  ]

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
          <form onSubmit={handleSave} className="space-y-4">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="max-w-[200px]"
                    value={String(form[f.key] ?? 0)}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: parseInt(e.target.value, 10) || 0 }))}
                  />
                  <span className="text-sm text-gray-500">{f.suffix}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{f.help}</p>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" loading={updateMut.isPending}>Save Changes</Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {fmtNum(settings[f.key] as number)} <span className="text-sm font-normal text-gray-400">{f.suffix}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 mt-4">
        <p className="text-sm text-gray-600">
          <Calculator className="inline h-4 w-4 mr-1 text-amber-500" />
          Current conversion: <strong>{fmtNum(settings.pointsPerDollarRedeem)} points = $1.00</strong>
          {settings.pointsExpiryDays > 0 && <> · Points expire after <strong>{settings.pointsExpiryDays} days</strong></>}
          {settings.pointsExpiryDays === 0 && <> · Points <strong>never expire</strong></>}
        </p>
      </Card>
    </>
  )
}

// ─────────────────────────── Tab 3: User Points ───────────────────

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
                      <td className="px-3 py-2 text-gray-500">{fmtNum(e.balanceAfter)}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  )
                })}
                {userDetail.history.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No history</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {userDetail.pagination.totalPages > 1 && (
            <div className="mt-3 flex justify-center">
              <Pagination page={ledgerPage} pageSize={PAGE_SIZE} total={userDetail.pagination.total} onPageChange={setLedgerPage} />
            </div>
          )}
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
    { label: 'Liability', value: `$${t.outstandingLiability.toFixed(2)}`, icon: Database, color: 'text-red-600 bg-red-50' },
    { label: 'Redemptions', value: fmtNum(r.count), icon: Calculator, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Avg Redemption', value: `$${r.averageValue.toFixed(2)}`, icon: Calculator, color: 'text-violet-600 bg-violet-50' },
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
          <TabsTrigger value="settings">Global Settings</TabsTrigger>
          <TabsTrigger value="users">User Points</TabsTrigger>
          <TabsTrigger value="log">Change Log</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <div className="pt-2">
        {tab === 'rules' && <EarningRulesTab />}
        {tab === 'settings' && <GlobalSettingsTab />}
        {tab === 'users' && <UserPointsTab />}
        {tab === 'log' && <ChangeLogTab />}
        {tab === 'dashboard' && <DashboardTab />}
      </div>
    </div>
  )
}
