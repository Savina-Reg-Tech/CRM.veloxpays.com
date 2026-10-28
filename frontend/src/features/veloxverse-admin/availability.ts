import type { BadgeVariant } from '@/components/ui/Badge'
import type {
  AvailabilityChange,
  AvailabilityCountry,
  AvailabilityItem,
  AvailabilityItemKind,
  AvailabilityMode,
  AvailabilityRule,
  AvailabilityRuleInput,
  BlockedDisplay,
  UnknownCountryPolicy,
} from './types'

/**
 * Country availability — plain-language helpers for the CRM page. Admins never see API values
 * (allow_list, velox-assist.pick-drop) as the main text; everything goes through these labels.
 */

// ── Labels ───────────────────────────────────────────────────────────
export const MODE_OPTIONS: { value: AvailabilityMode; label: string; hint: string }[] = [
  { value: 'all_countries', label: 'Everyone', hint: 'Available in every country.' },
  { value: 'allow_list', label: 'Only these countries', hint: 'Only customers from the countries you pick.' },
  { value: 'deny_list', label: 'Everyone except these countries', hint: 'Available everywhere apart from the countries you pick.' },
  { value: 'disabled', label: 'No one (switch it off)', hint: 'Hidden or shown as coming soon everywhere.' },
]

export const DISPLAY_OPTIONS: { value: BlockedDisplay; label: string; short: string; hint: string }[] = [
  { value: 'hidden', label: 'Hide it', short: 'Hidden', hint: 'It disappears from their app.' },
  { value: 'coming-soon', label: "Show 'Coming soon'", short: 'Coming soon', hint: "They see it greyed out with a 'Soon' badge." },
  { value: 'register-interest', label: "Show 'Register interest'", short: 'Register interest', hint: "Like 'Coming soon', with a button to contact support." },
  {
    value: 'not-available',
    label: "Show 'Not available in your region'",
    short: 'Not available in region',
    hint: "They see it greyed out with a 'Not available' badge — it isn't presented as coming later.",
  },
]

/** Only the choices this VeloxVerse accepts (its `blockedDisplays`) — a newer one appears once VeloxVerse ships it. */
export function displayOptionsFor(accepted: BlockedDisplay[] | undefined) {
  return accepted?.length ? DISPLAY_OPTIONS.filter((o) => accepted.includes(o.value)) : DISPLAY_OPTIONS
}

export const UNKNOWN_OPTIONS: { value: UnknownCountryPolicy; label: string }[] = [
  { value: 'allow', label: 'Let them use it (recommended)' },
  { value: 'block', label: "Don't let them use it" },
]

export const MESSAGE_MAX = 300
export const REASON_MAX = 500
export const DEFAULT_BLOCKED_MESSAGE = 'This service is not available in your country yet.'

export function displayShort(display: BlockedDisplay): string {
  return DISPLAY_OPTIONS.find((o) => o.value === display)?.short ?? display
}

export function usesCountries(mode: AvailabilityMode): boolean {
  return mode === 'allow_list' || mode === 'deny_list'
}

export function isRestricted(rule: Pick<AvailabilityRule, 'mode'>): boolean {
  return rule.mode !== 'all_countries'
}

export function kindLabel(kind: AvailabilityItemKind, parentLabel?: string): string {
  if (kind === 'service') return 'Service'
  if (kind === 'form') return 'Form'
  return parentLabel ? `Part of ${parentLabel}` : 'Part of a service'
}

// ── Countries ────────────────────────────────────────────────────────
/** 🇦🇺 from "AU". Always shown next to the code — flags don't render on every Windows machine. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

/** Quick-add groups in the country picker. They only ever add countries. */
export const COUNTRY_PRESETS: { label: string; codes: string[] }[] = [
  { label: 'Australia & New Zealand', codes: ['AU', 'NZ'] },
  { label: 'UK & Ireland', codes: ['GB', 'IE'] },
  {
    label: 'European Union',
    codes: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
  },
  { label: 'South Asia', codes: ['IN', 'BD', 'PK', 'LK', 'NP'] },
  { label: 'USA & Canada', codes: ['US', 'CA'] },
]

export type CountryNames = Map<string, string>

export function countryNameMap(countries: AvailabilityCountry[] | undefined): CountryNames {
  return new Map((countries ?? []).map((c) => [c.code, c.name]))
}

export function countryName(code: string, names: CountryNames): string {
  return names.get(code) ?? code
}

/** "Australia", "Australia and New Zealand", "A, B and C", "A, B, C and 4 more". */
export function joinCountryNames(codes: string[], names: CountryNames, max = 3): string {
  const list = codes.map((c) => countryName(c, names))
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length <= max) return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
  return `${list.slice(0, max).join(', ')} and ${list.length - max} more`
}

// ── Row summary (badge + chips) ──────────────────────────────────────
export interface RuleSummary {
  label: string
  variant: BadgeVariant
  /** First few country codes to show as chips. */
  chips: string[]
  /** How many more countries beyond the chips. */
  more: number
}

const MODE_BADGE: Record<AvailabilityMode, { label: string; variant: BadgeVariant }> = {
  all_countries: { label: 'Everyone', variant: 'success' },
  allow_list: { label: 'Only in', variant: 'info' },
  deny_list: { label: 'All except', variant: 'warning' },
  disabled: { label: 'Off', variant: 'danger' },
}

export function ruleSummary(rule: Pick<AvailabilityRule, 'mode' | 'countries'>, maxChips = 3): RuleSummary {
  const { label, variant } = MODE_BADGE[rule.mode] ?? { label: rule.mode, variant: 'neutral' as const }
  const codes = usesCountries(rule.mode) ? rule.countries : []
  return { label, variant, chips: codes.slice(0, maxChips), more: Math.max(0, codes.length - maxChips) }
}

/** Short words for history / toasts: "Everyone", "Only in Australia, New Zealand", "Off". */
export function ruleWords(rule: Pick<AvailabilityRule, 'mode' | 'countries'>, names: CountryNames, max = 5): string {
  const list = (rule.countries ?? []).map((c) => countryName(c, names))
  const shown = list.length > max ? `${list.slice(0, max).join(', ')} +${list.length - max} more` : list.join(', ')
  switch (rule.mode) {
    case 'all_countries':
      return 'Everyone'
    case 'allow_list':
      return `Only in ${shown || '(no countries)'}`
    case 'deny_list':
      return `All except ${shown || '(no countries)'}`
    case 'disabled':
      return 'Off'
    default:
      return String(rule.mode)
  }
}

// ── The one-sentence effect shown before saving ──────────────────────
export function describeRule(
  item: Pick<AvailabilityItem, 'label'>,
  input: Pick<AvailabilityRuleInput, 'mode' | 'countries' | 'blockedDisplay' | 'unknownCountryPolicy' | 'strictIpCheck'>,
  names: CountryNames,
  opts: { parent?: AvailabilityItem | null; children?: AvailabilityItem[] } = {}
): string {
  const name = item.label
  const where = joinCountryNames(input.countries, names)
  const parts: string[] = []

  // A customer gets in when EITHER where they live (account country) OR where they are right now
  // is allowed; with strictIpCheck on, BOTH must be allowed.
  const both = input.strictIpCheck
  const othersSee: Record<BlockedDisplay, string> = {
    hidden: "won't see it",
    'coming-soon': "sees it as 'Coming soon'",
    'register-interest': "sees it with 'Register interest'",
    'not-available': "sees it as 'Not available in your region'",
  }
  const theySee: Record<BlockedDisplay, string> = {
    hidden: 'It is hidden from them.',
    'coming-soon': "They see it as 'Coming soon'.",
    'register-interest': "They see it with 'Register interest'.",
    'not-available': "They see it as 'Not available in your region'.",
  }
  const offAnd: Record<BlockedDisplay, string> = {
    hidden: 'hidden',
    'coming-soon': "shown as 'Coming soon'",
    'register-interest': "shown with 'Register interest'",
    'not-available': "shown as 'Not available in your region'",
  }

  switch (input.mode) {
    case 'all_countries':
      parts.push(`Everyone can use ${name}.`)
      break
    case 'allow_list':
      parts.push(
        where
          ? `Customers who live in ${both ? 'and' : 'or'} are currently in ${where} can use ${name}. Everyone else ${othersSee[input.blockedDisplay]}.`
          : `No countries are picked yet, so no one could use ${name}.`
      )
      break
    case 'deny_list': {
      // Blocked only when neither country is allowed — or, strict, when either one isn't.
      const who = both
        ? `who live in or are currently in ${where}`
        : input.countries.length === 1
          ? `who live in ${where} and are in ${where} right now`
          : `who live in ${where} and are in one of those countries right now`
      parts.push(
        where
          ? `Everyone can use ${name} except customers ${who}. ${theySee[input.blockedDisplay]}`
          : `Everyone can use ${name} (no countries are excluded yet).`
      )
      break
    }
    case 'disabled':
      parts.push(`${name} is switched off for everyone and ${offAnd[input.blockedDisplay]}.`)
      break
  }

  if (opts.parent && opts.parent.rule.mode === 'disabled' && input.mode !== 'disabled') {
    parts.push(`${opts.parent.label} itself is off, so ${name} stays off until ${opts.parent.label} is on.`)
  }

  const children = opts.children ?? []
  if (children.length > 0 && input.mode !== 'all_countries') {
    if (children.length === 1) {
      parts.push(`Its ${children[0].kind === 'form' ? 'form' : 'part'} ${children[0].label} follows this rule too.`)
    } else {
      const allForms = children.every((c) => c.kind === 'form')
      const allParts = children.every((c) => c.kind !== 'form')
      const noun = allForms ? 'forms' : allParts ? 'parts' : 'parts and forms'
      parts.push(`Its ${children.length} ${noun} follow this rule too.`)
    }
  }

  if (usesCountries(input.mode)) {
    parts.push(
      input.unknownCountryPolicy === 'allow'
        ? "Customers whose country we can't tell can still use it."
        : "Customers whose country we can't tell can't use it."
    )
  }

  return parts.join(' ')
}

// ── Editing ──────────────────────────────────────────────────────────
export type RuleDraft = Required<Pick<AvailabilityRuleInput, 'mode' | 'countries' | 'blockedDisplay' | 'unknownCountryPolicy' | 'strictIpCheck'>> & {
  message: string
  reason: string
}

export function draftFromRule(rule: AvailabilityRule): RuleDraft {
  return {
    mode: rule.mode,
    countries: [...(rule.countries ?? [])].sort(),
    blockedDisplay: rule.blockedDisplay,
    unknownCountryPolicy: rule.unknownCountryPolicy,
    strictIpCheck: rule.strictIpCheck,
    message: rule.message ?? '',
    reason: '',
  }
}

/** True when the draft would change the saved rule (the reason alone doesn't count). */
export function isDraftDirty(draft: RuleDraft, rule: AvailabilityRule): boolean {
  const saved = draftFromRule(rule)
  const countries = usesCountries(draft.mode) ? [...draft.countries].sort() : []
  const savedCountries = usesCountries(saved.mode) ? saved.countries : []
  return (
    draft.mode !== saved.mode ||
    countries.join(',') !== savedCountries.join(',') ||
    draft.blockedDisplay !== saved.blockedDisplay ||
    draft.unknownCountryPolicy !== saved.unknownCountryPolicy ||
    draft.strictIpCheck !== saved.strictIpCheck ||
    draft.message.trim() !== saved.message.trim()
  )
}

/** Inline problem for the countries step, or null. */
export function draftCountriesError(draft: RuleDraft): string | null {
  if (draft.mode === 'allow_list' && draft.countries.length === 0) {
    return "Pick at least one country, or choose 'No one' to switch it off."
  }
  if (draft.mode === 'deny_list' && draft.countries.length === 0) {
    return "Pick at least one country to exclude, or choose 'Everyone'."
  }
  return null
}

/** The PUT body: countries only for the two list modes, empty message → null, empty reason omitted. */
export function ruleInputFromDraft(draft: RuleDraft, version: number): AvailabilityRuleInput {
  const reason = draft.reason.trim()
  return {
    mode: draft.mode,
    countries: usesCountries(draft.mode) ? [...draft.countries].sort() : [],
    blockedDisplay: draft.blockedDisplay,
    unknownCountryPolicy: draft.unknownCountryPolicy,
    strictIpCheck: draft.strictIpCheck,
    message: draft.message.trim() || null,
    expectedVersion: version,
    ...(reason ? { reason } : {}),
  }
}

// ── Tree ─────────────────────────────────────────────────────────────
export interface AvailabilityNode {
  item: AvailabilityItem
  children: AvailabilityItem[]
}

export interface AvailabilityGroup {
  group: string
  nodes: AvailabilityNode[]
}

/** Groups in API order; within each, parents first with their children underneath. */
export function buildTree(items: AvailabilityItem[]): AvailabilityGroup[] {
  const keys = new Set(items.map((i) => i.key))
  const childrenOf = new Map<string, AvailabilityItem[]>()
  for (const item of items) {
    if (item.parentKey && keys.has(item.parentKey)) {
      childrenOf.set(item.parentKey, [...(childrenOf.get(item.parentKey) ?? []), item])
    }
  }
  const groups: AvailabilityGroup[] = []
  for (const item of items) {
    if (item.parentKey && keys.has(item.parentKey)) continue
    let g = groups.find((x) => x.group === item.group)
    if (!g) groups.push((g = { group: item.group, nodes: [] }))
    g.nodes.push({ item, children: childrenOf.get(item.key) ?? [] })
  }
  return groups
}

// ── Change history ───────────────────────────────────────────────────
export interface ChangeLine {
  field: string
  from: string
  to: string
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function asRule(v: Record<string, unknown> | null): Pick<AvailabilityRule, 'mode' | 'countries'> | null {
  if (!v || typeof v.mode !== 'string') return null
  return { mode: v.mode as AvailabilityMode, countries: Array.isArray(v.countries) ? (v.countries as string[]) : [] }
}

/** Only the fields that changed, in admin words. */
export function diffChange(change: AvailabilityChange, names: CountryNames): ChangeLine[] {
  const before = change.before ?? {}
  const after = change.after ?? {}
  const lines: ChangeLine[] = []

  if (change.entity === 'customer_country') {
    const from = str(before.country)
    const to = str(after.country)
    if (from !== to) {
      lines.push({
        field: 'Country',
        from: from ? countryName(from, names) : 'not set',
        to: to ? countryName(to, names) : 'not set',
      })
    }
    return lines
  }

  const b = asRule(change.before)
  const a = asRule(change.after)
  const sameCountries = [...(b?.countries ?? [])].sort().join(',') === [...(a?.countries ?? [])].sort().join(',')
  if (a && (b?.mode !== a.mode || !sameCountries)) {
    lines.push({ field: 'Who can use it', from: b ? ruleWords(b, names) : '—', to: ruleWords(a, names) })
  }
  if (before.blockedDisplay !== after.blockedDisplay && str(after.blockedDisplay)) {
    lines.push({
      field: 'Others see',
      from: str(before.blockedDisplay) ? displayShort(before.blockedDisplay as BlockedDisplay) : '—',
      to: displayShort(after.blockedDisplay as BlockedDisplay),
    })
  }
  if (before.unknownCountryPolicy !== after.unknownCountryPolicy && str(after.unknownCountryPolicy)) {
    const word = (v: unknown) => (v === 'block' ? "Don't let them use it" : v === 'allow' ? 'Let them use it' : '—')
    lines.push({ field: 'Country unknown', from: word(before.unknownCountryPolicy), to: word(after.unknownCountryPolicy) })
  }
  if (Boolean(before.strictIpCheck) !== Boolean(after.strictIpCheck)) {
    lines.push({ field: 'Only if they live there and are there', from: before.strictIpCheck ? 'On' : 'Off', to: after.strictIpCheck ? 'On' : 'Off' })
  }
  if ((str(before.message) ?? '') !== (str(after.message) ?? '')) {
    lines.push({ field: 'Message', from: str(before.message) ?? '(default)', to: str(after.message) ?? '(default)' })
  }
  return lines
}

export function changeSourceWords(change: AvailabilityChange): string | null {
  if (change.entity !== 'customer_country') return null
  const src = change.after?.countrySource
  return src === 'admin' ? 'set by admin' : src === 'customer' ? 'set by customer' : null
}
