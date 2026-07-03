import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import { useVVUpdateClubTierBenefits } from '../hooks/useVVClub'
import type { ClubBenefits, ClubTierRow } from '../types'

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="w-40 shrink-0">{children}</div>
    </div>
  )
}

function Num({ value, onChange, min = -1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <Input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-right"
    />
  )
}

interface ClubBenefitsEditorProps {
  tier: ClubTierRow | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ClubBenefitsEditor({ tier, open, onClose, onSuccess }: ClubBenefitsEditorProps) {
  const update = useVVUpdateClubTierBenefits()
  const [benefits, setBenefits] = useState<ClubBenefits | null>(tier?.benefits ?? null)
  const [note, setNote] = useState('')
  const [seededFor, setSeededFor] = useState<string | null>(null)

  if (tier && open && seededFor !== tier.id) {
    setBenefits(tier.benefits ? JSON.parse(JSON.stringify(tier.benefits)) : null)
    setNote('')
    setSeededFor(tier.id)
  }

  if (!open) return null
  if (!tier || !benefits) return null

  const isExplorer = tier.slug === 'explorer'

  const set = (path: string, value: number | boolean | string) => {
    setBenefits((prev) => {
      if (!prev) return prev
      const next = JSON.parse(JSON.stringify(prev)) as ClubBenefits
      const [group, field] = path.split('.')
      if (field) {
        const groupObj = next[group] as Record<string, unknown> | undefined
        if (groupObj) groupObj[field] = value
      } else {
        next[group] = value
      }
      return next
    })
  }

  const lounge = benefits.lounge as { visits?: number; discount_pct?: number; family_included?: boolean; max_family?: number } | undefined
  const dining = benefits.dining as { visits?: number; discount_pct?: number } | undefined
  const fastTrack = benefits.fast_track as { visits?: number; discount_pct?: number; family_included?: boolean } | undefined
  const esim = benefits.esim as { gb?: number } | undefined
  const pickDrop = benefits.pick_drop as { rides?: number; discount_pct?: number } | undefined
  const meetGreet = benefits.meet_greet as { visits?: number } | undefined
  const gym = benefits.gym as { enabled?: boolean } | undefined

  function handleSave() {
    if (!tier || !benefits) return
    update.mutate(
      { tierId: tier.id, benefits, changeNote: note || undefined },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${tier.name} benefits`} size="lg">
      <p className="mb-4 text-sm text-gray-500">
        {isExplorer
          ? 'This applies immediately to all Explorer users (live benefits — no snapshot).'
          : `This creates a new version for future purchases only. ${tier.activeMembers} existing member${tier.activeMembers === 1 ? '' : 's'} keep their current snapshot.`}
      </p>

      <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
        <div className="py-2">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Lounge</p>
          <Row label="Free visits (-1 = unltd)"><Num value={lounge?.visits ?? 0} onChange={(n) => set('lounge.visits', n)} /></Row>
          <Row label="Discount %"><Num value={lounge?.discount_pct ?? 0} min={0} onChange={(n) => set('lounge.discount_pct', n)} /></Row>
          <Row label="Family included"><Switch checked={Boolean(lounge?.family_included)} onChange={(v) => set('lounge.family_included', v)} /></Row>
          <Row label="Max family"><Num value={lounge?.max_family ?? 0} min={0} onChange={(n) => set('lounge.max_family', n)} /></Row>
        </div>

        <div className="py-2">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Dining</p>
          <Row label="Vouchers / year"><Num value={dining?.visits ?? 0} onChange={(n) => set('dining.visits', n)} /></Row>
          <Row label="Discount %"><Num value={dining?.discount_pct ?? 0} min={0} onChange={(n) => set('dining.discount_pct', n)} /></Row>
        </div>

        <div className="py-2">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Fast Track</p>
          <Row label="Free visits"><Num value={fastTrack?.visits ?? 0} onChange={(n) => set('fast_track.visits', n)} /></Row>
          <Row label="Discount %"><Num value={fastTrack?.discount_pct ?? 0} min={0} onChange={(n) => set('fast_track.discount_pct', n)} /></Row>
          <Row label="Family included"><Switch checked={Boolean(fastTrack?.family_included)} onChange={(v) => set('fast_track.family_included', v)} /></Row>
        </div>

        <div className="py-2">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">eSIM & Transfers</p>
          <Row label="eSIM free GB"><Num value={esim?.gb ?? 0} min={0} onChange={(n) => set('esim.gb', n)} /></Row>
          <Row label="Pick & Drop rides"><Num value={pickDrop?.rides ?? 0} onChange={(n) => set('pick_drop.rides', n)} /></Row>
          <Row label="Pick & Drop discount %"><Num value={pickDrop?.discount_pct ?? 0} min={0} onChange={(n) => set('pick_drop.discount_pct', n)} /></Row>
          <Row label="Meet & Greet (-1 = unltd)"><Num value={meetGreet?.visits ?? 0} onChange={(n) => set('meet_greet.visits', n)} /></Row>
        </div>

        <div className="py-2">
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Perks</p>
          <Row label="Gym access"><Switch checked={Boolean(gym?.enabled)} onChange={(v) => set('gym.enabled', v)} /></Row>
          <Row label="Dedicated manager"><Switch checked={Boolean(benefits.dedicated_manager)} onChange={(v) => set('dedicated_manager', v)} /></Row>
          <Row label="Support level">
            <select
              className={selectClass}
              value={String(benefits.support_level ?? 'standard')}
              onChange={(e) => set('support_level', e.target.value)}
            >
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
              <option value="vip">VIP Dedicated</option>
              <option value="24_7_vip">24/7 VIP</option>
            </select>
          </Row>
          <Row label="Cashback max (cents)"><Num value={Number(benefits.credit_cashback_max_cents ?? 0)} min={0} onChange={(n) => set('credit_cashback_max_cents', n)} /></Row>
          <Row label="Bank bonus (BDT)"><Num value={Number(benefits.bank_bonus_bdt ?? 0)} min={0} onChange={(n) => set('bank_bonus_bdt', n)} /></Row>
          <Row label="Point multiplier"><Num value={Number(benefits.point_multiplier ?? 0)} min={0} onChange={(n) => set('point_multiplier', n)} /></Row>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <label className="text-xs font-medium text-gray-500">Change note (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Q3 promotion — extra lounge visit" />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="primary" className="flex-1" onClick={handleSave} loading={update.isPending}>
          Save new version
        </Button>
      </div>
    </Modal>
  )
}
