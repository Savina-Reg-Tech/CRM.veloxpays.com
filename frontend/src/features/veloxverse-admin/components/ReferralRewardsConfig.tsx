import { useState, type FormEvent } from 'react'
import { AlertCircle, Gift, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVPointsSettings, useVVReferralConfig, useVVUpdateReferralConfig } from '../hooks/useVVPoints'
import { formatDateTime } from '../utils'
import { formatPoints, pointsValueLabel, valueAtRate } from '../referral'
import type { ReferralPointsConfigRow } from '../types'

// CRM is the source of truth for the Refer & Earn reward: one row per supported preferred
// currency, each a direct admin-set points count (not a monetary value converted via FX) for
// both the referrer and the referee. VeloxVerse applies the row matching each recipient's own
// preferred currency at award time — see points-referral.service.ts#awardReferralPoints.

/** "≈ INR 50.00" at that currency's redemption rate, or a muted note when redemption is off. */
function WorthLabel({ points, currency, rate }: { points: number; currency: string; rate: number | null | undefined }) {
  const label = pointsValueLabel(valueAtRate(points, currency, rate))
  return label ? (
    <span className="text-xs text-emerald-700">{label}</span>
  ) : (
    <span className="text-xs text-gray-400">no {currency} redemption rate</span>
  )
}

export default function ReferralRewardsConfig() {
  const { data: config, isLoading, error } = useVVReferralConfig()
  const { data: settings } = useVVPointsSettings()
  const updateMut = useVVUpdateReferralConfig()
  const { showToast } = useToast()
  const [editRow, setEditRow] = useState<ReferralPointsConfigRow | null>(null)
  const [referrerValue, setReferrerValue] = useState('')
  const [refereeValue, setRefereeValue] = useState('')

  const rateFor = (currency: string) => settings?.pointsPerUnitRedeem?.[currency] ?? null

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
        onSuccess: () => {
          showToast({ type: 'success', title: `${editRow.currency} referral reward updated` })
          setEditRow(null)
        },
        onError: () => showToast({ type: 'error', title: 'Failed to update referral reward' }),
      }
    )
  }

  function toggleActive(row: ReferralPointsConfigRow) {
    updateMut.mutate(
      { id: row.id, patch: { isActive: !row.isActive } },
      {
        onSuccess: () =>
          showToast({ type: 'success', title: `${row.currency} referral reward ${!row.isActive ? 'enabled' : 'disabled'}` }),
        onError: () => showToast({ type: 'error', title: 'Toggle failed' }),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {error instanceof Error ? error.message : 'Failed to load referral rewards'}
      </div>
    )
  }

  const rows = config ?? []

  return (
    <div className="space-y-4">
      <Card padding="sm" className="sm:p-5">
        <p className="text-sm text-gray-600">
          <Gift className="mr-1 inline h-4 w-4 text-indigo-500" />
          Each currency's reward is a fixed points count — not a money amount converted at a live rate — so it never
          drifts after a referral is made. Each side of a referral is priced in <strong>their own</strong> preferred
          currency. The "≈" value is the points at that currency's redemption rate (Points → Global Settings).
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-gray-500">
          <li>
            Rewards are paid when the new customer completes their first <strong>card-paid</strong> booking. If that
            booking is cancelled or refunded, both rewards are reversed and paid again on their next card-paid booking.
          </li>
          <li>Bookings fully covered by a VeloxClub benefit, credit or points don't qualify.</li>
          <li>
            Codes are rejected for customers who already have a completed or refunded paid booking, and for referral
            loops (someone using the code of a person they referred).
          </li>
          <li>Deactivating a referred user claws back the referrer's reward (the referee keeps their welcome bonus).</li>
        </ul>
      </Card>

      {rows.length === 0 ? (
        <Card className="py-10 text-center text-sm text-gray-500">No currencies configured yet.</Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Currency', 'Referrer earns', 'Referee earns', 'Active', 'Version', 'Updated', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.currency}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatPoints(row.referrerPoints)}</p>
                      <WorthLabel points={row.referrerPoints} currency={row.currency} rate={rateFor(row.currency)} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatPoints(row.refereePoints)}</p>
                      <WorthLabel points={row.refereePoints} currency={row.currency} rate={rateFor(row.currency)} />
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={row.isActive} disabled={updateMut.isPending} onChange={() => toggleActive(row)} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">v{row.version}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDateTime(row.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label={`Edit ${row.currency}`}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
            {rows.map((row) => (
              <div key={row.id} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-gray-900">{row.currency}</span>
                  <Switch
                    checked={row.isActive}
                    disabled={updateMut.isPending}
                    onChange={() => toggleActive(row)}
                    label={row.isActive ? 'Active' : 'Off'}
                    className="text-xs text-gray-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Referrer</p>
                    <p className="font-medium text-gray-900">{formatPoints(row.referrerPoints)}</p>
                    <WorthLabel points={row.referrerPoints} currency={row.currency} rate={rateFor(row.currency)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Referee</p>
                    <p className="font-medium text-gray-900">{formatPoints(row.refereePoints)}</p>
                    <WorthLabel points={row.refereePoints} currency={row.currency} rate={rateFor(row.currency)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    v{row.version} · {formatDateTime(row.updatedAt)}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit ${editRow?.currency ?? ''} referral reward`} size="md">
        {editRow && (
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Referrer points (per successful referral)</label>
              <Input
                type="number"
                min={0}
                value={referrerValue}
                onChange={(e) => setReferrerValue(e.target.value)}
                className="text-base sm:text-sm"
                required
              />
              <p className="mt-1">
                <WorthLabel points={Number(referrerValue) || 0} currency={editRow.currency} rate={rateFor(editRow.currency)} />
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Referee points (welcome bonus)</label>
              <Input
                type="number"
                min={0}
                value={refereeValue}
                onChange={(e) => setRefereeValue(e.target.value)}
                className="text-base sm:text-sm"
                required
              />
              <p className="mt-1">
                <WorthLabel points={Number(refereeValue) || 0} currency={editRow.currency} rate={rateFor(editRow.currency)} />
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Current: {formatPoints(editRow.referrerPoints)} / {formatPoints(editRow.refereePoints)} → New:{' '}
              {formatPoints(Number(referrerValue) || 0)} / {formatPoints(Number(refereeValue) || 0)}. Only future
              referrals use the new values.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditRow(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
