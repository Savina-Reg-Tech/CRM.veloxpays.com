import { describe, it, expect } from 'vitest'
import {
  COUNTRY_PRESETS,
  buildTree,
  countryFlag,
  countryNameMap,
  describeRule,
  diffChange,
  displayOptionsFor,
  draftCountriesError,
  draftFromRule,
  isDraftDirty,
  joinCountryNames,
  ruleInputFromDraft,
  ruleSummary,
} from './availability'
import type { AvailabilityChange, AvailabilityItem, AvailabilityRule } from './types'

const names = countryNameMap([
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'IE', name: 'Ireland' },
  { code: 'FR', name: 'France' },
])

function rule(p: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    serviceKey: 'x', mode: 'all_countries', countries: [], blockedDisplay: 'hidden', unknownCountryPolicy: 'allow',
    strictIpCheck: false, message: null, version: 1, updatedBy: null, updatedAt: null, ...p,
  }
}

function item(key: string, p: Partial<AvailabilityItem> = {}): AvailabilityItem {
  return { key, label: key, kind: 'service', group: 'G', parentKey: null, rule: rule({ serviceKey: key }), ...p }
}

const EIGHT = ['AU', 'NZ', 'GB', 'IN', 'US', 'CA', 'IE', 'FR']

describe('ruleSummary', () => {
  it('labels every mode', () => {
    expect(ruleSummary(rule())).toMatchObject({ label: 'Everyone', variant: 'success', chips: [], more: 0 })
    expect(ruleSummary(rule({ mode: 'disabled' }))).toMatchObject({ label: 'Off', variant: 'danger', chips: [] })
    expect(ruleSummary(rule({ mode: 'deny_list', countries: ['IN'] }))).toMatchObject({ label: 'All except', variant: 'warning', chips: ['IN'] })
  })

  it('shows up to 3 chips then "+N more"', () => {
    expect(ruleSummary(rule({ mode: 'allow_list', countries: [] }))).toMatchObject({ chips: [], more: 0 })
    expect(ruleSummary(rule({ mode: 'allow_list', countries: ['AU'] }))).toMatchObject({ label: 'Only in', chips: ['AU'], more: 0 })
    expect(ruleSummary(rule({ mode: 'allow_list', countries: ['AU', 'NZ', 'GB'] }))).toMatchObject({ chips: ['AU', 'NZ', 'GB'], more: 0 })
    expect(ruleSummary(rule({ mode: 'allow_list', countries: EIGHT }))).toMatchObject({ chips: ['AU', 'NZ', 'GB'], more: 5 })
  })
})

describe('describeRule', () => {
  const pd = item('velox-assist.pick-drop', { label: 'Pick & Drop', kind: 'sub-service', parentKey: 'velox-assist' })
  const base = { countries: [] as string[], blockedDisplay: 'hidden' as const, unknownCountryPolicy: 'allow' as const, strictIpCheck: false }

  it('covers each mode × display', () => {
    expect(describeRule(pd, { ...base, mode: 'all_countries' }, names)).toBe('Everyone can use Pick & Drop.')
    expect(describeRule(pd, { ...base, mode: 'allow_list', countries: ['AU', 'NZ'], blockedDisplay: 'coming-soon' }, names)).toContain(
      "Customers who live in or are currently in Australia and New Zealand can use Pick & Drop. Everyone else sees it as 'Coming soon'."
    )
    expect(describeRule(pd, { ...base, mode: 'allow_list', countries: ['AU'] }, names)).toContain("Everyone else won't see it.")
    expect(describeRule(pd, { ...base, mode: 'deny_list', countries: ['IN'] }, names)).toContain('Everyone can use Pick & Drop except customers who live in India and are in India right now. It is hidden from them.')
    expect(describeRule(pd, { ...base, mode: 'deny_list', countries: ['IN', 'GB'], blockedDisplay: 'register-interest' }, names)).toContain(
      "except customers who live in India and United Kingdom and are in one of those countries right now. They see it with 'Register interest'."
    )
    expect(describeRule(pd, { ...base, mode: 'disabled' }, names)).toBe('Pick & Drop is switched off for everyone and hidden.')
    expect(describeRule(pd, { ...base, mode: 'disabled', blockedDisplay: 'coming-soon' }, names)).toBe("Pick & Drop is switched off for everyone and shown as 'Coming soon'.")
  })

  it('mentions a parent that is off and children that follow', () => {
    const parent = item('velox-assist', { label: 'VeloxAssist', rule: rule({ mode: 'disabled' }) })
    expect(describeRule(pd, { ...base, mode: 'all_countries' }, names, { parent })).toContain(
      'VeloxAssist itself is off, so Pick & Drop stays off until VeloxAssist is on.'
    )
    const forms = [item('a', { kind: 'form' }), item('b', { kind: 'form' }), item('c', { kind: 'form' })]
    expect(describeRule(parent, { ...base, mode: 'disabled' }, names, { children: forms })).toContain('Its 3 forms follow this rule too.')
  })

  it('covers unknown country, strict check and "and N more"', () => {
    const text = describeRule(pd, { ...base, mode: 'allow_list', countries: EIGHT, unknownCountryPolicy: 'block', strictIpCheck: true }, names)
    expect(text).toContain('Australia, New Zealand, United Kingdom and 5 more')
    expect(text).toContain("Customers whose country we can't tell can't use it.")
    expect(text).toContain('Customers who live in and are currently in Australia, New Zealand, United Kingdom and 5 more can use Pick & Drop.')
    expect(
      describeRule(pd, { ...base, mode: 'deny_list', countries: ['IN'], blockedDisplay: 'not-available', strictIpCheck: true }, names)
    ).toContain("Everyone can use Pick & Drop except customers who live in or are currently in India. They see it as 'Not available in your region'.")
    expect(describeRule(pd, { ...base, mode: 'allow_list', countries: ['AU'] }, names)).toContain("Customers whose country we can't tell can still use it.")
  })
})

describe('joinCountryNames', () => {
  it('reads naturally', () => {
    expect(joinCountryNames(['AU'], names)).toBe('Australia')
    expect(joinCountryNames(['AU', 'NZ', 'GB'], names)).toBe('Australia, New Zealand and United Kingdom')
    expect(joinCountryNames(['ZZ'], names)).toBe('ZZ')
  })
})

describe('drafts', () => {
  it('only counts real changes as dirty, and sends [] countries for non-list modes', () => {
    const saved = rule({ mode: 'allow_list', countries: ['NZ', 'AU'], version: 3 })
    const draft = draftFromRule(saved)
    expect(isDraftDirty(draft, saved)).toBe(false)
    expect(isDraftDirty({ ...draft, reason: 'note' }, saved)).toBe(false)
    expect(isDraftDirty({ ...draft, countries: ['AU'] }, saved)).toBe(true)

    const body = ruleInputFromDraft({ ...draft, mode: 'disabled', message: '  ', reason: '' }, saved.version)
    expect(body).toEqual({
      mode: 'disabled', countries: [], blockedDisplay: 'hidden', unknownCountryPolicy: 'allow', strictIpCheck: false, message: null, expectedVersion: 3,
    })
    expect(ruleInputFromDraft({ ...draft, reason: ' ANZ first ' }, 3).reason).toBe('ANZ first')
  })

  it('needs a country for "Only these countries"', () => {
    expect(draftCountriesError({ ...draftFromRule(rule({ mode: 'allow_list' })) })).toMatch(/Pick at least one country/)
    expect(draftCountriesError({ ...draftFromRule(rule({ mode: 'allow_list', countries: ['AU'] })) })).toBeNull()
  })
})

describe('diffChange', () => {
  const change = (p: Partial<AvailabilityChange>): AvailabilityChange => ({
    id: '1', entity: 'rule', entityId: 'velox-assist.pick-drop', before: null, after: null, actorId: null, actorEmail: null,
    actorRole: null, reason: null, createdAt: '2026-10-28T08:00:00Z', ...p,
  })

  it('lists only changed fields, in labels', () => {
    const lines = diffChange(
      change({
        before: { mode: 'all_countries', countries: [], blockedDisplay: 'hidden', unknownCountryPolicy: 'allow', strictIpCheck: false, message: null },
        after: { mode: 'allow_list', countries: ['AU', 'NZ'], blockedDisplay: 'coming-soon', unknownCountryPolicy: 'allow', strictIpCheck: false, message: null },
      }),
      names
    )
    expect(lines).toEqual([
      { field: 'Who can use it', from: 'Everyone', to: 'Only in Australia, New Zealand' },
      { field: 'Others see', from: 'Hidden', to: 'Coming soon' },
    ])
  })

  it('reads a customer country change', () => {
    expect(diffChange(change({ entity: 'customer_country', before: { country: 'IN' }, after: { country: null } }), names)).toEqual([
      { field: 'Country', from: 'India', to: 'not set' },
    ])
  })
})

describe('buildTree', () => {
  it('keeps API order and puts children under their parent', () => {
    const items = [
      item('velox-lounge', { group: 'VeloxLounge' }),
      item('velox-lounge.fast-track', { group: 'VeloxLounge', parentKey: 'velox-lounge' }),
      item('velox-assist', { group: 'VeloxAssist' }),
      item('velox-assist.pick-drop', { group: 'VeloxAssist', parentKey: 'velox-assist' }),
      item('velox-lounge.dining', { group: 'VeloxLounge', parentKey: 'velox-lounge' }),
    ]
    const tree = buildTree(items)
    expect(tree.map((g) => g.group)).toEqual(['VeloxLounge', 'VeloxAssist'])
    expect(tree[0].nodes[0].children.map((c) => c.key)).toEqual(['velox-lounge.fast-track', 'velox-lounge.dining'])
    expect(tree[1].nodes[0].children.map((c) => c.key)).toEqual(['velox-assist.pick-drop'])
  })
})

describe('countries', () => {
  it('builds a flag from the code', () => {
    expect(countryFlag('AU')).toBe('🇦🇺')
    expect(countryFlag('x')).toBe('')
  })

  it('presets use valid ISO-2 codes only', () => {
    for (const p of COUNTRY_PRESETS) for (const c of p.codes) expect(c).toMatch(/^[A-Z]{2}$/)
    expect(COUNTRY_PRESETS.find((p) => p.label === 'European Union')?.codes).toHaveLength(27)
  })
})

describe("'Not available in your region'", () => {
  it('reads in the summary', () => {
    const pd = item('velox-assist.pick-drop', { label: 'Pick & Drop' })
    const base = { countries: ['AU'], unknownCountryPolicy: 'allow' as const, strictIpCheck: false }
    expect(describeRule(pd, { ...base, mode: 'allow_list', blockedDisplay: 'not-available' }, names)).toContain(
      "Everyone else sees it as 'Not available in your region'."
    )
    expect(describeRule(pd, { ...base, mode: 'disabled', blockedDisplay: 'not-available' }, names)).toBe(
      "Pick & Drop is switched off for everyone and shown as 'Not available in your region'."
    )
  })

  it('is only offered once VeloxVerse accepts it', () => {
    const older = displayOptionsFor(['hidden', 'coming-soon', 'register-interest']).map((o) => o.value)
    expect(older).not.toContain('not-available')
    expect(displayOptionsFor(['hidden', 'coming-soon', 'register-interest', 'not-available']).map((o) => o.value)).toContain('not-available')
  })
})
