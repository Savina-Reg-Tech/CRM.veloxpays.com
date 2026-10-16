import { useEffect, useMemo, useRef, useState, type ElementType, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  Car,
  Check,
  DollarSign,
  Dumbbell,
  Handshake,
  History,
  Lock,
  Pencil,
  Smartphone,
  Sofa,
  Sparkles,
  Undo2,
  Users,
  Utensils,
  Zap,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Switch from '@/components/ui/Switch'
import { cn } from '@/lib/utils'
import { useToast } from '@/app/providers/ToastProvider'
import { vvClubService } from '../vvAdminService'
import { apiErrorMessage } from '../utils'
import {
  SHEET_GROUPS,
  SUPPORT_OPTIONS,
  collectChanges,
  collectErrors,
  formatChangeValue,
  formatUsd,
  formatValue,
  inputValue,
  isExplorer,
  noneEdits,
  parseEdit,
  planSaves,
  savedValue,
  validate,
  type CellChange,
  type Edits,
  type SheetField,
  type SheetGroup,
} from '../clubSheet'
import type { ClubTierRow } from '../types'

const GROUP_ICONS: Record<string, ElementType> = {
  price: DollarSign,
  lounge: Sofa,
  dining: Utensils,
  fast_track: Zap,
  esim: Smartphone,
  pick_drop: Car,
  meet_greet: Handshake,
  gym: Dumbbell,
  perks: Sparkles,
}

/** Column accent per tier (header stripe and tint). */
const TIER_ACCENT: Record<string, { stripe: string; tint: string; text: string }> = {
  explorer: { stripe: 'bg-gray-400', tint: 'bg-gray-50/60', text: 'text-gray-700' },
  silver: { stripe: 'bg-slate-400', tint: 'bg-slate-50/50', text: 'text-slate-700' },
  gold: { stripe: 'bg-amber-400', tint: 'bg-amber-50/40', text: 'text-amber-700' },
  platinum: { stripe: 'bg-violet-400', tint: 'bg-violet-50/40', text: 'text-violet-700' },
  elite: { stripe: 'bg-rose-400', tint: 'bg-rose-50/40', text: 'text-rose-700' },
}
const accentFor = (slug: string) => TIER_ACCENT[slug] ?? TIER_ACCENT.explorer

const SAVE_NOTICE =
  'Paid members keep the benefits they bought until they renew. New prices and benefits apply to new purchases and renewals. Explorer changes apply to all Explorer users immediately.'

const cellKey = (tierId: string, fieldId: string) => `${tierId}:${fieldId}`

interface ClubTiersSheetProps {
  tiers: ClubTierRow[]
  edits: Edits
  onEditsChange: (next: Edits) => void
  historyTierId: string | null
  onShowHistory: (tierId: string) => void
  onToggleActive: (tier: ClubTierRow, isActive: boolean) => void
  togglingActive?: boolean
}

/**
 * VeloxClub as the client's comparison sheet: one card per benefit, tiers as columns. Click any
 * value to change it (or "Edit all"); changed cells stay highlighted (old → new) until saved.
 */
export default function ClubTiersSheet({
  tiers,
  edits,
  onEditsChange,
  historyTierId,
  onShowHistory,
  onToggleActive,
  togglingActive,
}: ClubTiersSheetProps) {
  const [editAll, setEditAll] = useState(false)
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const changes = useMemo(() => collectChanges(tiers, edits), [tiers, edits])
  const errors = useMemo(() => collectErrors(tiers, edits), [tiers, edits])
  const changed = useMemo(() => new Map(changes.map((c) => [cellKey(c.tier.id, c.field.id), c])), [changes])
  const errorAt = useMemo(() => new Map(errors.map((e) => [cellKey(e.tier.id, e.field.id), e.message])), [errors])
  const changedTierCount = new Set(changes.map((c) => c.tier.id)).size

  // Leaving the page with unsaved cells loses them: let the browser ask first.
  useEffect(() => {
    if (changes.length === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changes.length])

  const setCell = (tierId: string, fieldId: string, raw: string | boolean) => {
    onEditsChange({ ...edits, [tierId]: { ...(edits[tierId] ?? {}), [fieldId]: raw } })
  }

  const setCells = (tierId: string, values: Record<string, string | boolean>) => {
    onEditsChange({ ...edits, [tierId]: { ...(edits[tierId] ?? {}), ...values } })
  }

  const revertCell = (tierId: string, fieldId: string) => {
    const tierEdits = { ...(edits[tierId] ?? {}) }
    delete tierEdits[fieldId]
    const next = { ...edits, [tierId]: tierEdits }
    if (Object.keys(tierEdits).length === 0) delete next[tierId]
    onEditsChange(next)
  }

  const discard = () => {
    onEditsChange({})
    setActiveCell(null)
    setShowErrors(false)
  }

  const openReview = () => {
    if (errors.length > 0) {
      setShowErrors(true)
      setEditAll(true)
      return
    }
    setReviewOpen(true)
  }

  const columns = `minmax(190px, 1.1fr) repeat(${tiers.length}, minmax(150px, 1fr))`
  const hasPending = changes.length > 0 || errors.length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All tiers</h2>
          <p className="text-sm text-gray-500">
            Click any value to change it. Changes stay highlighted until you save them all at once.
          </p>
        </div>
        <Button
          variant={editAll ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setEditAll((v) => !v)
            setActiveCell(null)
          }}
        >
          {editAll ? <Check className="mr-1.5 h-4 w-4" /> : <Pencil className="mr-1.5 h-4 w-4" />}
          {editAll ? 'Done editing' : 'Edit all'}
        </Button>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-max space-y-4">
          {/* Tier header cards — aligned with the columns below */}
          <div className="grid gap-3" style={{ gridTemplateColumns: columns }}>
            <div />
            {tiers.map((tier) => (
              <TierHeaderCard
                key={tier.id}
                tier={tier}
                changeCount={changes.filter((c) => c.tier.id === tier.id).length}
                historyOpen={historyTierId === tier.id}
                onShowHistory={() => onShowHistory(tier.id)}
                onToggleActive={(v) => onToggleActive(tier, v)}
                togglingActive={togglingActive}
              />
            ))}
          </div>

          {SHEET_GROUPS.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              tiers={tiers}
              columns={columns}
              edits={edits}
              changed={changed}
              errorAt={errorAt}
              showErrors={showErrors}
              editAll={editAll}
              activeCell={activeCell}
              onActivate={setActiveCell}
              onCell={setCell}
              onCells={setCells}
              onRevert={revertCell}
            />
          ))}
        </div>
      </div>

      {/* Sticky save bar */}
      {hasPending && (
        <div className="sticky bottom-4 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="min-w-0 text-sm">
              {changes.length > 0 && (
                <span className="font-medium text-gray-900">
                  {changes.length} unsaved change{changes.length === 1 ? '' : 's'} in {changedTierCount} tier
                  {changedTierCount === 1 ? '' : 's'}
                </span>
              )}
              {errors.length > 0 && (
                <span className={cn('flex items-center gap-1 text-red-600', changes.length > 0 && 'mt-0.5')}>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errors.length === 1
                    ? `Fix ${errors[0].tier.name} · ${errors[0].field.label}: ${errors[0].message}`
                    : `${errors.length} cells need fixing before you can save (shown in red)`}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={discard}>
                <Undo2 className="mr-1.5 h-4 w-4" /> Discard
              </Button>
              <Button variant="primary" size="sm" onClick={openReview}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      <ReviewDialog
        open={reviewOpen}
        tiers={tiers}
        changes={changes}
        onClose={() => setReviewOpen(false)}
        onSaved={(savedTierIds, savedParts) => {
          // Drop the edits that are now saved; anything that failed stays highlighted.
          const next: Edits = {}
          for (const [tierId, tierEdits] of Object.entries(edits)) {
            const parts = savedParts.get(tierId)
            const kept = Object.fromEntries(
              Object.entries(tierEdits).filter(([fieldId]) => {
                if (!parts) return true
                return fieldId === 'price' ? !parts.price : !parts.benefits
              })
            )
            if (Object.keys(kept).length > 0) next[tierId] = kept
          }
          onEditsChange(next)
          setActiveCell(null)
          if (savedTierIds.length > 0 && Object.keys(next).length === 0) setEditAll(false)
        }}
      />
    </div>
  )
}

// ── Tier header ─────────────────────────────────────────────────────────────

function TierHeaderCard({
  tier,
  changeCount,
  historyOpen,
  onShowHistory,
  onToggleActive,
  togglingActive,
}: {
  tier: ClubTierRow
  changeCount: number
  historyOpen: boolean
  onShowHistory: () => void
  onToggleActive: (isActive: boolean) => void
  togglingActive?: boolean
}) {
  const accent = accentFor(tier.slug)
  const free = isExplorer(tier)
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white shadow-sm transition',
        historyOpen ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200',
        !tier.isActive && 'opacity-70'
      )}
    >
      <div className={cn('h-1.5', accent.stripe)} />
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={cn('truncate text-base font-semibold', accent.text)}>{tier.name}</div>
            <div className="text-sm font-medium text-gray-900">
              {free ? 'Free' : `${formatUsd(tier.annualFeeCents / 100)} / year`}
            </div>
          </div>
          <Badge variant="neutral">v{tier.currentVersion ?? 1}</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3.5 w-3.5" />
          {tier.activeMembers} active member{tier.activeMembers === 1 ? '' : 's'}
        </div>
        {free && (
          <p className="rounded-md bg-gray-100 px-2 py-1 text-[11px] leading-snug text-gray-600">
            Free users · resets 1 Jan
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {free ? (
            <span className="text-[11px] text-gray-400">Always available</span>
          ) : (
            <Switch
              checked={tier.isActive}
              onChange={onToggleActive}
              disabled={togglingActive}
              label={tier.isActive ? 'Active' : 'Inactive'}
              className="text-xs text-gray-600"
            />
          )}
          <button
            type="button"
            onClick={onShowHistory}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition',
              historyOpen ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            )}
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
        </div>
        {changeCount > 0 && (
          <div className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
            {changeCount} unsaved change{changeCount === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Benefit card ────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: SheetGroup
  tiers: ClubTierRow[]
  columns: string
  edits: Edits
  changed: Map<string, CellChange>
  errorAt: Map<string, string>
  showErrors: boolean
  editAll: boolean
  activeCell: string | null
  onActivate: (key: string | null) => void
  onCell: (tierId: string, fieldId: string, raw: string | boolean) => void
  onCells: (tierId: string, values: Record<string, string | boolean>) => void
  onRevert: (tierId: string, fieldId: string) => void
}

function GroupCard({ group, tiers, columns, edits, changed, errorAt, showErrors, editAll, activeCell, onActivate, onCell, onCells, onRevert }: GroupCardProps) {
  const Icon = GROUP_ICONS[group.id] ?? Sparkles
  const groupChanged = tiers.some((t) => group.fields.some((fd) => changed.has(cellKey(t.id, fd.id))))

  /** The value a cell currently shows: the typed edit if there is one, else what's saved. */
  const current = (tier: ClubTierRow, field: SheetField) => {
    const raw = edits[tier.id]?.[field.id]
    if (raw === undefined || validate(field, raw)) return savedValue(tier, field)
    return parseEdit(field, raw)
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm transition',
        groupChanged ? 'border-amber-300' : 'border-gray-200'
      )}
      aria-label={group.title}
    >
      {/* Card header: benefit name + quick "None" per tier */}
      <div className="grid items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-3 py-2" style={{ gridTemplateColumns: columns }}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
        </div>
        {tiers.map((tier) => (
          <div key={tier.id} className="flex justify-end">
            {group.quota && (
              <button
                type="button"
                onClick={() => onCells(tier.id, noneEdits(group))}
                className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-400 transition hover:bg-white hover:text-gray-700 hover:shadow-sm"
                aria-label={`Set ${tier.name} ${group.title} to none`}
                title={`Set ${tier.name} ${group.title} to none (no free allowance, no discount)`}
              >
                Set none
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="divide-y divide-gray-100">
        {group.fields.map((field) => (
          <div key={field.id} className="grid items-stretch gap-3 px-3 py-1.5" style={{ gridTemplateColumns: columns }}>
            <div className="flex items-center text-sm text-gray-600">{field.label}</div>
            {tiers.map((tier) => {
              const key = cellKey(tier.id, field.id)
              const hidden = field.shownWhen ? !current(tier, fieldByPath(group, field.shownWhen)) : false
              return (
                <SheetCell
                  key={tier.id}
                  tier={tier}
                  field={field}
                  raw={edits[tier.id]?.[field.id]}
                  change={changed.get(key)}
                  error={errorAt.get(key)}
                  showError={showErrors}
                  hidden={hidden}
                  editing={editAll || activeCell === key}
                  focusOnOpen={!editAll && activeCell === key}
                  onActivate={() => onActivate(key)}
                  onDeactivate={() => onActivate(null)}
                  onChange={(raw) => onCell(tier.id, field.id, raw)}
                  onRevert={() => onRevert(tier.id, field.id)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

const fieldByPath = (group: SheetGroup, id: string): SheetField => group.fields.find((fd) => fd.id === id)!

// ── Cell ────────────────────────────────────────────────────────────────────

interface SheetCellProps {
  tier: ClubTierRow
  field: SheetField
  raw: string | boolean | undefined
  change?: CellChange
  error?: string
  showError: boolean
  hidden: boolean
  editing: boolean
  /** This cell was just opened on its own (not via "Edit all"): put the cursor in it. */
  focusOnOpen: boolean
  onActivate: () => void
  onDeactivate: () => void
  onChange: (raw: string | boolean) => void
  onRevert: () => void
}

const inputClass =
  'w-full rounded-md border bg-white px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2'

function SheetCell({ tier, field, raw, change, error, showError, hidden, editing, focusOnOpen, onActivate, onDeactivate, onChange, onRevert }: SheetCellProps) {
  const saved = savedValue(tier, field)
  const accent = accentFor(tier.slug)
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null)
  const value = raw ?? inputValue(field, saved)
  const invalid = Boolean(error)
  const cellLabel = `${tier.name} ${field.label}`

  useEffect(() => {
    if (focusOnOpen) inputRef.current?.focus({ preventScroll: true })
  }, [focusOnOpen])

  if (hidden) {
    return <div className={cn('flex items-center justify-end rounded-lg px-2 text-sm text-gray-300', accent.tint)}>—</div>
  }

  // Explorer is free and stays free: no input at all.
  if (field.kind === 'money' && isExplorer(tier)) {
    return (
      <div className={cn('flex items-center justify-end gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500', accent.tint)} title="Explorer is the free tier — its price can't change">
        <Lock className="h-3.5 w-3.5" /> Free
      </div>
    )
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onDeactivate()
    if (e.key === 'Escape') {
      onRevert()
      onDeactivate()
    }
  }

  const frame = cn(
    'group relative flex min-h-[2.5rem] flex-col justify-center rounded-lg px-2 py-1 text-sm transition',
    accent.tint,
    change && !invalid && 'bg-amber-50 ring-1 ring-amber-300',
    invalid && (showError || editing) && 'bg-red-50 ring-1 ring-red-300'
  )

  const oldNew = change && (
    <span className="flex items-center justify-end gap-1 text-[11px] text-amber-700">
      <s className="text-gray-400">{formatValue(field, change.from)}</s>
      <ArrowRight className="h-3 w-3" />
    </span>
  )

  // Toggles flip straight away — no edit mode needed.
  if (field.kind === 'toggle') {
    return (
      <div className={frame}>
        {oldNew}
        <div className="flex justify-end">
          <Switch checked={Boolean(value)} onChange={onChange} label={Boolean(value) ? 'Yes' : 'No'} className="text-xs text-gray-600" />
        </div>
      </div>
    )
  }

  if (!editing) {
    const shown = change ? change.to : saved
    const display = invalid ? String(raw) : formatValue(field, shown)
    const muted = !change && !invalid && (display === 'None' || display === 'No')
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(frame, 'items-end text-right hover:ring-2 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400')}
        aria-label={`${cellLabel}: ${display}. Click to change`}
      >
        {oldNew}
        <span className={cn('font-medium', muted ? 'text-gray-400' : 'text-gray-900', change && 'text-amber-900', invalid && 'text-red-700')}>
          {display}
        </span>
        <Pencil className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-300 opacity-0 transition group-hover:opacity-100" />
        {invalid && showError && <span className="text-[11px] text-red-600">{error}</span>}
      </button>
    )
  }

  const ringClass = invalid ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-200'

  let control
  if (field.kind === 'support') {
    const v = String(value)
    const legacy = !SUPPORT_OPTIONS.some((o) => o.value === v)
    control = (
      <select
        ref={inputRef}
        aria-label={cellLabel}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(inputClass, 'text-left', ringClass)}
      >
        {legacy && <option value={v} disabled>{formatValue(field, v)} (old)</option>}
        {SUPPORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  } else {
    const unlimited = field.kind === 'count' && String(value).trim() === '-1'
    const prefix = field.kind === 'money' ? '$' : field.kind === 'multiplier' ? '×' : null
    const suffix = field.kind === 'pct' ? '%' : field.kind === 'gb' ? 'GB' : null
    control = (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
          <input
            ref={inputRef}
            aria-label={cellLabel}
            aria-invalid={invalid}
            inputMode={field.kind === 'count' || field.kind === 'pct' || field.kind === 'familyMax' ? 'numeric' : 'decimal'}
            value={unlimited ? '∞' : String(value)}
            disabled={unlimited}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn(inputClass, ringClass, unlimited && 'bg-gray-50 text-gray-500')}
          />
          {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
        </div>
        {field.kind === 'count' && (
          <label className="flex cursor-pointer items-center justify-end gap-1.5 text-[11px] text-gray-500">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(e) => onChange(e.target.checked ? '-1' : saved === -1 ? '0' : String(saved))}
              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
            />
            Unlimited
          </label>
        )}
      </div>
    )
  }

  return (
    <div className={frame}>
      {oldNew}
      {control}
      {invalid && <span className="mt-0.5 text-right text-[11px] leading-tight text-red-600">{error}</span>}
      {change && !invalid && (
        <button type="button" onClick={onRevert} className="mt-0.5 self-end text-[11px] text-gray-400 hover:text-gray-700">
          Undo
        </button>
      )}
    </div>
  )
}

// ── Review & save ───────────────────────────────────────────────────────────

interface ReviewDialogProps {
  open: boolean
  tiers: ClubTierRow[]
  changes: CellChange[]
  onClose: () => void
  onSaved: (savedTierIds: string[], savedParts: Map<string, { price: boolean; benefits: boolean }>) => void
}

function ReviewDialog({ open, tiers, changes, onClose, onSaved }: ReviewDialogProps) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const plans = useMemo(() => planSaves(tiers, changes), [tiers, changes])

  const close = () => {
    if (saving) return
    setFailure(null)
    onClose()
  }

  async function save() {
    setFailure(null)
    const savedParts = new Map<string, { price: boolean; benefits: boolean }>()
    const savedTierIds: string[] = []
    const changeNote = note.trim() || undefined
    try {
      // One after another: if one fails, stop there so nothing after it is half-applied.
      for (const plan of plans) {
        const parts = { price: false, benefits: false }
        savedParts.set(plan.tier.id, parts)
        setSaving(plan.tier.name)
        try {
          if (plan.annualFeeCents !== undefined) {
            await vvClubService.updateTier(plan.tier.id, { annualFeeCents: plan.annualFeeCents })
            parts.price = true
          }
          if (plan.benefits) {
            await vvClubService.updateTierBenefits(plan.tier.id, plan.benefits, changeNote)
            parts.benefits = true
          }
          savedTierIds.push(plan.tier.id)
        } catch (err) {
          const already = savedTierIds.map((id) => tiers.find((t) => t.id === id)?.name).filter(Boolean)
          setFailure(
            `Couldn't save ${plan.tier.name}: ${apiErrorMessage(err, 'the request failed')}.` +
              (parts.price ? ` Its new price was saved; its benefits were not.` : '') +
              (already.length > 0 ? ` ${already.join(', ')} ${already.length === 1 ? 'was' : 'were'} saved.` : ' Nothing was saved.') +
              ' Unsaved cells are still highlighted.'
          )
          return
        }
      }
      showToast({ type: 'success', title: `VeloxClub updated (${savedTierIds.length} tier${savedTierIds.length === 1 ? '' : 's'})` })
      setNote('')
      onClose()
    } finally {
      // Re-sync tiers, the history panel and the Change Log with what actually saved — before
      // clearing the saved edits, so cells never flash their old value in between.
      await qc.invalidateQueries({ queryKey: ['vv-club'] })
      setSaving(null)
      onSaved(savedTierIds, savedParts)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Review changes" description="Check every change before it goes live." size="xl">
      <div className="space-y-4">
        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {plans.map((plan) => {
            const accent = accentFor(plan.tier.slug)
            return (
              <div key={plan.tier.id} className="overflow-hidden rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', accent.stripe)} />
                  <span className="text-sm font-semibold text-gray-900">{plan.tier.name}</span>
                  <span className="text-xs text-gray-500">
                    {plan.changes.length} change{plan.changes.length === 1 ? '' : 's'}
                    {plan.benefits ? ` · becomes v${(plan.tier.currentVersion ?? 1) + 1}` : ''}
                  </span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {plan.changes.map((c) => (
                    <li key={c.field.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-sm">
                      <span className="text-gray-700">
                        {plan.tier.name} — {c.field.changeLabel}
                      </span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-gray-400 line-through">{formatChangeValue(c.field, c.from)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-900">{formatChangeValue(c.field, c.to)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">{SAVE_NOTICE}</div>

        <div className="space-y-1">
          <label htmlFor="club-change-note" className="text-xs font-medium text-gray-600">
            Change note (optional — saved with every tier's new version)
          </label>
          <input
            id="club-change-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Client sheet 14 Oct 2026"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{failure}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={Boolean(saving)}>
            {failure ? 'Close' : 'Keep editing'}
          </Button>
          <Button variant="primary" onClick={save} loading={Boolean(saving)} disabled={plans.length === 0}>
            {saving ? `Saving ${saving}…` : failure ? 'Try again' : `Save ${changes.length} change${changes.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
