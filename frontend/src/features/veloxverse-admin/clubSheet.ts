/**
 * VeloxClub "All tiers" sheet — the rules behind the editor in components/ClubTiersSheet.tsx.
 *
 * The client manages VeloxClub as one comparison sheet: benefits as rows, tiers as columns. This
 * module knows every row (where its value lives in a tier, how to show it in plain words, how to
 * validate an edit) and turns a set of edited cells into the API calls VeloxVerse expects:
 *   PUT /admin/club/tiers/:id           { annualFeeCents }        — one per tier whose price changed
 *   PUT /admin/club/tiers/:id/benefits  { benefits, changeNote }  — the COMPLETE benefits object
 */
import type { ClubBenefits, ClubTierRow } from './types'

// ── Rows ────────────────────────────────────────────────────────────────────

/** `count`: whole number, -1 = unlimited · `pct`: 0–100 · `gb`: decimals · `money`: USD. */
export type FieldKind = 'money' | 'count' | 'familyMax' | 'pct' | 'gb' | 'toggle' | 'support' | 'multiplier'

/** Benefits with a "free allowance + discount" pair — the ones a quick "None" can clear. */
export type QuotaKey = 'lounge' | 'dining' | 'fast_track' | 'pick_drop' | 'meet_greet' | 'gym'

export interface SheetField {
  id: string
  kind: FieldKind
  /** Row label in the sheet. */
  label: string
  /** How the change reads in the confirm dialog: "Silver — Fast Track discount: 5% → 10%". */
  changeLabel: string
  /** Where the value lives: `price`, a top-level benefits key, or `group.key`. */
  path: string
  /** Only shown when this toggle (same tier) is on — e.g. Max family under Family included. */
  shownWhen?: string
}

export interface SheetGroup {
  id: string
  title: string
  /** The benefits key cleared by the group's "None" action, if it has one. */
  quota?: QuotaKey
  fields: SheetField[]
}

const f = (id: string, kind: FieldKind, label: string, changeLabel: string, extra: Partial<SheetField> = {}): SheetField => ({
  id,
  kind,
  label,
  changeLabel,
  path: id,
  ...extra,
})

export const SHEET_GROUPS: SheetGroup[] = [
  { id: 'price', title: 'Price', fields: [f('price', 'money', 'Yearly price (USD)', 'price')] },
  {
    id: 'lounge',
    title: 'Lounge',
    quota: 'lounge',
    fields: [
      f('lounge.visits', 'count', 'Free visits / year', 'Lounge free visits'),
      f('lounge.discount_pct', 'pct', 'Discount', 'Lounge discount'),
      f('lounge.family_included', 'toggle', 'Family included', 'Lounge family included'),
      f('lounge.max_family', 'familyMax', 'Max family', 'Lounge max family', { shownWhen: 'lounge.family_included' }),
    ],
  },
  {
    id: 'dining',
    title: 'Airport Dining',
    quota: 'dining',
    fields: [
      f('dining.visits', 'count', 'Free vouchers / year', 'Dining free vouchers'),
      f('dining.discount_pct', 'pct', 'Discount', 'Dining discount'),
    ],
  },
  {
    id: 'fast_track',
    title: 'Fast Track',
    quota: 'fast_track',
    fields: [
      f('fast_track.visits', 'count', 'Free visits / year', 'Fast Track free visits'),
      f('fast_track.discount_pct', 'pct', 'Discount', 'Fast Track discount'),
      f('fast_track.family_included', 'toggle', 'Family included', 'Fast Track family included'),
    ],
  },
  { id: 'esim', title: 'Travel eSIM', fields: [f('esim.gb', 'gb', 'Free data / year', 'eSIM free data')] },
  {
    id: 'pick_drop',
    title: 'Airport Pick & Drop',
    quota: 'pick_drop',
    fields: [
      f('pick_drop.rides', 'count', 'Free rides / year', 'Pick & Drop free rides'),
      f('pick_drop.discount_pct', 'pct', 'Discount', 'Pick & Drop discount'),
    ],
  },
  {
    id: 'meet_greet',
    title: 'Meet & Greet',
    quota: 'meet_greet',
    fields: [f('meet_greet.visits', 'count', 'Free per year', 'Meet & Greet free per year')],
  },
  { id: 'gym', title: 'Gym', quota: 'gym', fields: [f('gym.visits', 'count', 'Free visits / year', 'Gym free visits')] },
  {
    id: 'perks',
    title: 'Perks',
    fields: [
      f('support_level', 'support', 'Customer support', 'customer support'),
      f('dedicated_manager', 'toggle', 'Dedicated manager', 'dedicated manager'),
      f('point_multiplier', 'multiplier', 'Points multiplier', 'points multiplier'),
    ],
  },
]

export const SHEET_FIELDS: SheetField[] = SHEET_GROUPS.flatMap((g) => g.fields)
const FIELD_BY_ID = new Map(SHEET_FIELDS.map((fd) => [fd.id, fd]))
export const fieldById = (id: string): SheetField | undefined => FIELD_BY_ID.get(id)

// ── Support level ───────────────────────────────────────────────────────────

/** Offered in the dropdown. `dedicated` is the client's wording (VeloxVerse 16 Oct 2026). */
export const SUPPORT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'priority', label: 'Priority' },
  { value: 'dedicated', label: 'Dedicated' },
] as const

/** Older versions may still hold these; shown, never offered. */
const LEGACY_SUPPORT_LABELS: Record<string, string> = { vip: 'VIP Dedicated', '24_7_vip': '24/7 VIP' }

export function supportLabel(value: unknown): string {
  const v = String(value ?? 'standard')
  return SUPPORT_OPTIONS.find((o) => o.value === v)?.label ?? LEGACY_SUPPORT_LABELS[v] ?? v
}

// ── Values ──────────────────────────────────────────────────────────────────

export type CellValue = number | boolean | string

export const isExplorer = (tier: Pick<ClubTierRow, 'slug'>): boolean => tier.slug === 'explorer'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Gym used to be on/off (`{ type: 'boolean', enabled }`); it's visits per year now. */
export function gymVisits(gym: unknown): number {
  const g = (gym ?? {}) as { type?: string; enabled?: boolean; visits?: number }
  if (g.type === 'boolean') return g.enabled ? 1 : 0
  return num(g.visits)
}

/** The tier's current, saved value for a row. */
export function savedValue(tier: ClubTierRow, field: SheetField): CellValue {
  if (field.path === 'price') return tier.annualFeeCents / 100
  const b = (tier.benefits ?? {}) as Record<string, unknown>
  if (field.path === 'gym.visits') return gymVisits(b.gym)
  const [group, key] = field.path.split('.')
  if (!key) {
    if (field.kind === 'toggle') return Boolean(b[group])
    if (field.kind === 'support') return String(b[group] ?? 'standard')
    return num(b[group] ?? (field.kind === 'multiplier' ? 1 : 0))
  }
  const v = ((b[group] ?? {}) as Record<string, unknown>)[key]
  return field.kind === 'toggle' ? Boolean(v) : num(v)
}

/** Plain-language value as the customer sees it. */
export function formatValue(field: SheetField, value: CellValue): string {
  switch (field.kind) {
    case 'money':
      return formatUsd(num(value))
    case 'count': {
      const n = num(value)
      if (n === -1) return 'Unlimited'
      if (n === 0) return 'None'
      return `${n} / year`
    }
    case 'familyMax':
      return num(value) === 0 ? 'None' : `Up to ${num(value)}`
    case 'pct':
      return num(value) === 0 ? 'None' : `${num(value)}% off`
    case 'gb':
      return num(value) === 0 ? 'None' : `${formatGb(num(value))} / year`
    case 'toggle':
      return value ? 'Yes' : 'No'
    case 'support':
      return supportLabel(value)
    case 'multiplier':
      return `×${num(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  }
}

/** Shorter wording for the confirm dialog ("5% → 10%", "2 / year → Unlimited"). */
export function formatChangeValue(field: SheetField, value: CellValue): string {
  if (field.kind === 'pct') return `${num(value)}%`
  if (field.kind === 'gb') return formatGb(num(value))
  if (field.kind === 'count' && num(value) === 0) return 'none'
  return formatValue(field, value)
}

/** "$499", "$499.50". */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`
}

export function formatGb(gb: number): string {
  return `${Number(gb.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 })} GB`
}

// ── Editing ─────────────────────────────────────────────────────────────────

/** What the admin typed: strings for numbers (so "0." can be typed), booleans for toggles. */
export type Edits = Record<string, Record<string, string | boolean>>

/** An edit as the input shows it. */
export function inputValue(field: SheetField, value: CellValue): string | boolean {
  if (field.kind === 'toggle') return Boolean(value)
  return String(value)
}

const WHOLE = /^-?\d+$/
const DECIMAL = /^\d+(\.\d+)?$/

/** Error message for a typed value, or null when it's fine. Same rules VeloxVerse enforces. */
export function validate(field: SheetField, raw: string | boolean): string | null {
  if (field.kind === 'toggle' || field.kind === 'support') return null
  const s = String(raw).trim()
  if (s === '') return 'Enter a value'
  switch (field.kind) {
    case 'money':
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return 'Enter a price like 499 or 499.99'
      return null
    case 'count':
      if (!WHOLE.test(s) || Number(s) < -1) return 'Whole number (0 = none), or tick Unlimited'
      return null
    case 'familyMax':
      if (!WHOLE.test(s) || Number(s) < 0) return 'Whole number, 0 or more'
      return null
    case 'pct':
      if (!WHOLE.test(s) || Number(s) < 0 || Number(s) > 100) return 'Whole number from 0 to 100'
      return null
    case 'gb':
      if (!/^\d+(\.\d{1,3})?$/.test(s)) return 'GB, 0 or more, up to 3 decimals (e.g. 0.5)'
      return null
    case 'multiplier':
      if (!DECIMAL.test(s) || Number(s) > 100) return 'Number from 0 to 100 (e.g. 1.5)'
      return null
  }
}

/** The typed value as the API value. Only call after `validate` passed. */
export function parseEdit(field: SheetField, raw: string | boolean): CellValue {
  if (field.kind === 'toggle') return Boolean(raw)
  if (field.kind === 'support') return String(raw)
  return Number(String(raw).trim())
}

export interface CellChange {
  tier: ClubTierRow
  field: SheetField
  from: CellValue
  to: CellValue
}

/** Every edited cell whose (valid) value differs from what's saved — in sheet order. */
export function collectChanges(tiers: ClubTierRow[], edits: Edits): CellChange[] {
  const out: CellChange[] = []
  for (const tier of tiers) {
    const tierEdits = edits[tier.id]
    if (!tierEdits) continue
    for (const field of SHEET_FIELDS) {
      if (!(field.id in tierEdits)) continue
      if (field.kind === 'money' && isExplorer(tier)) continue
      const raw = tierEdits[field.id]
      if (validate(field, raw)) continue
      const to = parseEdit(field, raw)
      const from = savedValue(tier, field)
      if (to !== from) out.push({ tier, field, from, to })
    }
  }
  return out
}

export interface CellError {
  tier: ClubTierRow
  field: SheetField
  message: string
}

/** Edited cells that can't be saved, so Save can be blocked with a reason per cell. */
export function collectErrors(tiers: ClubTierRow[], edits: Edits): CellError[] {
  const out: CellError[] = []
  for (const tier of tiers) {
    const tierEdits = edits[tier.id] ?? {}
    for (const field of SHEET_FIELDS) {
      if (!(field.id in tierEdits)) continue
      const message = validate(field, tierEdits[field.id])
      if (message) out.push({ tier, field, message })
    }
  }
  return out
}

/** Edits for a "None" on one benefit: free allowance and discount to 0 (family off). */
export function noneEdits(group: SheetGroup): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const field of group.fields) {
    if (field.kind === 'count' || field.kind === 'pct' || field.kind === 'familyMax') out[field.id] = '0'
    if (field.kind === 'toggle') out[field.id] = false
  }
  return out
}

// ── Saving ──────────────────────────────────────────────────────────────────

const QUOTA_DEFAULTS: Record<QuotaKey, Record<string, unknown>> = {
  lounge: { type: 'quota', visits: 0, discount_pct: 0, family_included: false, max_family: 0 },
  dining: { type: 'quota', visits: 0, discount_pct: 0 },
  fast_track: { type: 'quota', visits: 0, discount_pct: 0, family_included: false },
  pick_drop: { type: 'quota', rides: 0, discount_pct: 0 },
  meet_greet: { type: 'quota', visits: 0, discount_pct: 0 },
  gym: { type: 'quota', visits: 0, discount_pct: 0 },
}

/**
 * The complete benefits object for a tier with these changes applied. Starts from the tier's
 * current benefits (keeping any extra keys inside quota objects), fills keys an older version
 * may lack, converts an on/off gym to visits, and passes credit_cashback_max_cents and
 * bank_bonus_bdt through untouched — they aren't edited here.
 */
export function buildBenefits(tier: ClubTierRow, changes: CellChange[]): ClubBenefits {
  const current = structuredClone((tier.benefits ?? {}) as Record<string, unknown>)
  const next: Record<string, unknown> = { ...current }

  for (const key of Object.keys(QUOTA_DEFAULTS) as QuotaKey[]) {
    const existing = (current[key] ?? {}) as Record<string, unknown>
    next[key] = { ...QUOTA_DEFAULTS[key], ...existing, type: 'quota' }
  }
  // Gym: always the quota shape. An old on/off version keeps its meaning (on = 1 visit).
  const gym = next.gym as Record<string, unknown>
  next.gym = { ...gym, type: 'quota', visits: gymVisits(current.gym), discount_pct: num(gym.discount_pct) }
  delete (next.gym as Record<string, unknown>).enabled

  next.esim = { ...((current.esim ?? {}) as Record<string, unknown>), type: 'data_grant', gb: num((current.esim as { gb?: unknown })?.gb) }
  next.support_level = current.support_level ?? 'standard'
  next.dedicated_manager = Boolean(current.dedicated_manager)
  next.credit_cashback_max_cents = num(current.credit_cashback_max_cents)
  next.bank_bonus_bdt = num(current.bank_bonus_bdt)
  next.point_multiplier = current.point_multiplier === undefined ? 1 : num(current.point_multiplier)

  for (const change of changes) {
    if (change.tier.id !== tier.id || change.field.path === 'price') continue
    const [group, key] = change.field.path.split('.')
    if (key) (next[group] as Record<string, unknown>)[key] = change.to
    else next[group] = change.to
  }
  return next as ClubBenefits
}

export interface TierSave {
  tier: ClubTierRow
  /** New yearly price in USD cents, when it changed (never for Explorer). */
  annualFeeCents?: number
  /** The complete benefits object, when any benefit changed. */
  benefits?: ClubBenefits
  changes: CellChange[]
}

/** One entry per tier with something to save, in tier order. */
export function planSaves(tiers: ClubTierRow[], changes: CellChange[]): TierSave[] {
  const plans: TierSave[] = []
  for (const tier of tiers) {
    const mine = changes.filter((c) => c.tier.id === tier.id)
    if (mine.length === 0) continue
    const price = mine.find((c) => c.field.path === 'price')
    const benefitChanges = mine.filter((c) => c.field.path !== 'price')
    plans.push({
      tier,
      changes: mine,
      ...(price && !isExplorer(tier) ? { annualFeeCents: Math.round(Number(price.to) * 100) } : {}),
      ...(benefitChanges.length > 0 ? { benefits: buildBenefits(tier, benefitChanges) } : {}),
    })
  }
  return plans
}
