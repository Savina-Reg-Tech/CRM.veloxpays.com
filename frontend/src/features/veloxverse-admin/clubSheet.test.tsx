import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
const put = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: vi.fn(), delete: vi.fn() },
}))

// The modal's focus trap needs real layout to find focusable elements; jsdom has none.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  FocusTrap: ({ children }: { children: React.ReactNode }) => children,
}))

import ToastProvider from '@/app/providers/ToastProvider'
import VVClubPage from './pages/VVClubPage'
import {
  SHEET_FIELDS,
  buildBenefits,
  collectChanges,
  collectErrors,
  fieldById,
  formatValue,
  gymVisits,
  planSaves,
  savedValue,
  supportLabel,
  validate,
} from './clubSheet'
import type { ClubBenefits, ClubTierRow } from './types'

// ── fixtures ────────────────────────────────────────────────────────────────

const benefits = (over: Partial<Record<string, unknown>> = {}): ClubBenefits => ({
  lounge: { type: 'quota', visits: 0, discount_pct: 5, family_included: false, max_family: 0 },
  dining: { type: 'quota', visits: 0, discount_pct: 5 },
  fast_track: { type: 'quota', visits: 0, discount_pct: 5, family_included: false },
  esim: { type: 'data_grant', gb: 0 },
  pick_drop: { type: 'quota', rides: 0, discount_pct: 5 },
  meet_greet: { type: 'quota', visits: 0, discount_pct: 0 },
  gym: { type: 'boolean', enabled: false },
  support_level: 'standard',
  dedicated_manager: false,
  credit_cashback_max_cents: 35000,
  bank_bonus_bdt: 30,
  point_multiplier: 1,
  ...over,
})

const tier = (slug: string, name: string, feeCents: number, sortOrder: number, over: Partial<ClubBenefits> = {}): ClubTierRow => ({
  id: `t-${slug}`,
  slug,
  name,
  annualFeeCents: feeCents,
  sortOrder,
  philosophy: null,
  isPurchasable: slug !== 'explorer',
  isActive: true,
  color: null,
  icon: null,
  currentVersion: 1,
  benefits: benefits(over),
  activeMembers: slug === 'explorer' ? 0 : 3,
})

const makeTiers = (): ClubTierRow[] => [
  tier('explorer', 'Explorer', 0, 0),
  tier('silver', 'Silver', 9900, 1),
  tier('gold', 'Gold', 19900, 2, { gym: { type: 'boolean', enabled: true } }),
  tier('platinum', 'Platinum', 34900, 3, { support_level: 'vip' }),
  tier('elite', 'Elite', 49900, 4, { meet_greet: { type: 'quota', visits: 2, discount_pct: 0 } }),
]
const field = (id: string) => fieldById(id)!

// ── pure rules ──────────────────────────────────────────────────────────────

describe('sheet values', () => {
  it('reads gym visits from both the new and the old on/off shape', () => {
    expect(gymVisits({ type: 'quota', visits: 4 })).toBe(4)
    expect(gymVisits({ type: 'boolean', enabled: true })).toBe(1)
    expect(gymVisits({ type: 'boolean', enabled: false })).toBe(0)
  })

  it('shows plain-language values', () => {
    expect(formatValue(field('lounge.visits'), -1)).toBe('Unlimited')
    expect(formatValue(field('lounge.visits'), 2)).toBe('2 / year')
    expect(formatValue(field('lounge.visits'), 0)).toBe('None')
    expect(formatValue(field('dining.discount_pct'), 10)).toBe('10% off')
    expect(formatValue(field('esim.gb'), 0.5)).toBe('0.5 GB / year')
    expect(formatValue(field('price'), 499).replace(/\s/g, ' ')).toBe('AUD 499.00')
    expect(field('price').label).toBe('Yearly price (AUD)')
    expect(formatValue(field('point_multiplier'), 1.5)).toBe('×1.5')
  })

  it('labels support levels, including old ones', () => {
    expect(supportLabel('dedicated')).toBe('Dedicated')
    expect(supportLabel('vip')).toBe('VIP Dedicated')
    expect(supportLabel('24_7_vip')).toBe('24/7 VIP')
  })
})

describe('validate', () => {
  it.each([
    ['lounge.visits', '-1', true],
    ['lounge.visits', '3', true],
    ['lounge.visits', '-2', false],
    ['lounge.visits', '1.5', false],
    ['dining.discount_pct', '100', true],
    ['dining.discount_pct', '120', false],
    ['dining.discount_pct', '7.5', false],
    ['esim.gb', '0.5', true],
    ['esim.gb', '0.125', true],
    ['esim.gb', '0.1234', false],
    ['esim.gb', '-1', false],
    ['point_multiplier', '1.5', true],
    ['point_multiplier', '101', false],
    ['price', '499.99', true],
    ['price', '499.999', false],
    ['lounge.max_family', '-1', false],
    ['lounge.visits', '', false],
  ])('%s = %j → ok: %s', (id, raw, ok) => {
    expect(validate(field(id), raw) === null).toBe(ok)
  })
})

describe('saving', () => {
  it('keeps unrelated keys, converts an old gym, and passes cashback/bank bonus through', () => {
    const gold = makeTiers()[2]
    const changes = collectChanges([gold], { [gold.id]: { 'dining.discount_pct': '10' } })
    const out = buildBenefits(gold, changes) as Record<string, Record<string, unknown>> & ClubBenefits
    expect(out.dining).toEqual({ type: 'quota', visits: 0, discount_pct: 10 })
    expect(out.gym).toEqual({ type: 'quota', visits: 1, discount_pct: 0 })
    expect(out.credit_cashback_max_cents).toBe(35000)
    expect(out.bank_bonus_bdt).toBe(30)
    expect(out.lounge).toMatchObject({ family_included: false, max_family: 0 })
  })

  it('sends a price PUT only for a changed price and never for Explorer', () => {
    const tiers = makeTiers()
    const changes = collectChanges(tiers, {
      't-explorer': { price: '10' },
      't-platinum': { price: '499' },
    })
    expect(changes).toHaveLength(1)
    const [plan] = planSaves(tiers, changes)
    expect(plan.tier.slug).toBe('platinum')
    expect(plan.annualFeeCents).toBe(49900)
    expect(plan.benefits).toBeUndefined()
  })

  it('ignores edits that equal what is saved, and reports invalid cells', () => {
    const tiers = makeTiers()
    const edits = { 't-silver': { 'fast_track.discount_pct': '5', 'lounge.discount_pct': '120' } }
    expect(collectChanges(tiers, edits)).toHaveLength(0)
    expect(collectErrors(tiers, edits).map((e) => `${e.tier.name}:${e.field.id}`)).toEqual(['Silver:lounge.discount_pct'])
  })

  it('every sheet row reads a value from every tier', () => {
    for (const t of makeTiers()) for (const fd of SHEET_FIELDS) expect(savedValue(t, fd)).not.toBeUndefined()
  })
})

// ── the screen (spec §5 checks) ─────────────────────────────────────────────

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <VVClubPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

let serverTiers: ClubTierRow[]
const benefitPuts = () => put.mock.calls.filter(([url]) => String(url).endsWith('/benefits'))
const pricePuts = () => put.mock.calls.filter(([url]) => !String(url).endsWith('/benefits'))

/** The editable cell for a tier + row (sheet rows are labelled "<Tier> <Row>"). */
const cell = (tierName: string, rowLabel: string, group: string) =>
  within(screen.getByRole('region', { name: group })).getByRole('button', { name: new RegExp(`^${tierName} ${rowLabel}:`) })

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function typeInto(user: ReturnType<typeof userEvent.setup>, tierName: string, rowLabel: string, group: string, value: string) {
  await user.click(cell(tierName, escapeRe(rowLabel), group))
  const input = within(screen.getByRole('region', { name: group })).getByRole('textbox', { name: `${tierName} ${rowLabel}` })
  await user.clear(input)
  await user.type(input, value)
  await user.keyboard('{Enter}')
}

beforeEach(() => {
  get.mockReset()
  put.mockReset()
  serverTiers = makeTiers()
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/admin/club/tiers')) return { data: { success: true, data: structuredClone(serverTiers) } }
    return { data: { success: true, data: [] } }
  })
  put.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    const id = url.split('/tiers/')[1].split('/')[0]
    const t = serverTiers.find((x) => x.id === id)!
    if (url.endsWith('/benefits')) {
      t.benefits = body.benefits as ClubBenefits
      t.currentVersion = (t.currentVersion ?? 1) + 1
    } else if (typeof body.annualFeeCents === 'number') {
      t.annualFeeCents = body.annualFeeCents
    }
    return { data: { success: true, data: {} } }
  })
})

describe('VeloxClub "All tiers" sheet', () => {
  it('saves a Silver discount and a Platinum price in one go, listing exactly those 2 changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Fast Track' })

    await typeInto(user, 'Silver', 'Discount', 'Fast Track', '10')
    await typeInto(user, 'Platinum', 'Yearly price (AUD)', 'Price', '499')
    expect(screen.getByText('2 unsaved changes in 2 tiers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Silver — Fast Track discount')).toBeInTheDocument()
    expect(within(dialog).getByText('Platinum — price')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    expect(within(dialog).getByText(/Paid members keep the benefits they bought/)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/Change note/), 'Client sheet')
    await user.click(within(dialog).getByRole('button', { name: 'Save 2 changes' }))

    await screen.findByText('VeloxClub updated (2 tiers)')
    expect(pricePuts()).toEqual([['/vv-admin/admin/club/tiers/t-platinum', { annualFeeCents: 49900, changeNote: 'Client sheet' }]])
    expect(benefitPuts()).toHaveLength(1)
    const [url, body] = benefitPuts()[0]
    expect(url).toBe('/vv-admin/admin/club/tiers/t-silver/benefits')
    expect(body.changeNote).toBe('Client sheet')
    expect(body.benefits.fast_track.discount_pct).toBe(10)
    expect(serverTiers[1].currentVersion).toBe(2)
    await waitFor(() => expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument())
  })

  it("never offers an input for Explorer's price, but saves Explorer benefits (0.5 GB eSIM, not rounded)", async () => {
    const user = userEvent.setup()
    renderPage()
    const price = await screen.findByRole('region', { name: 'Price' })
    expect(within(price).queryByRole('button', { name: /^Explorer Yearly price/ })).toBeNull()
    expect(within(price).getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Free users · resets 1 Jan')).toBeInTheDocument()

    await typeInto(user, 'Explorer', 'Free data / year', 'Travel eSIM', '0.5')
    await typeInto(user, 'Platinum', 'Free visits / year', 'Gym', '2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Save 2 changes/ }))
    await screen.findByText('VeloxClub updated (2 tiers)')

    const byTier = Object.fromEntries(benefitPuts().map(([u, b]) => [u.split('/tiers/')[1].split('/')[0], b.benefits]))
    expect(byTier['t-explorer'].esim).toEqual({ type: 'data_grant', gb: 0.5 })
    expect(byTier['t-platinum'].gym).toEqual({ type: 'quota', visits: 2, discount_pct: 0 })
    expect(pricePuts()).toHaveLength(0)
  })

  it('saves Unlimited as -1 and shows it as "Unlimited"', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Meet & Greet' })
    await user.click(cell('Elite', 'Free per year', 'Meet & Greet'))
    await user.click(within(screen.getByRole('region', { name: 'Meet & Greet' })).getByRole('checkbox', { name: 'Unlimited' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Unlimited')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save 1 change' }))
    await screen.findByText('VeloxClub updated (1 tier)')
    expect(benefitPuts()[0][1].benefits.meet_greet.visits).toBe(-1)
    await waitFor(() => expect(cell('Elite', 'Free per year', 'Meet & Greet')).toHaveTextContent('Unlimited'))
  })

  it('blocks saving 120% and says which cell is wrong', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Lounge' })
    await typeInto(user, 'Gold', 'Discount', 'Lounge', '120')
    expect(screen.getByText('Fix Gold · Discount: Whole number from 0 to 100')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })

  it('stops at a failed tier, names it, keeps its cells and re-syncs the screen', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Airport Dining' })
    await typeInto(user, 'Explorer', 'Discount', 'Airport Dining', '10')
    await typeInto(user, 'Elite', 'Free vouchers / year', 'Airport Dining', '2')

    put.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url.includes('t-elite')) throw { response: { data: { message: 'VeloxVerse is offline' } } }
      serverTiers[0].benefits = body.benefits as ClubBenefits
      return { data: { success: true, data: {} } }
    })
    const tierLoadsBefore = get.mock.calls.filter(([u]) => u.endsWith('/admin/club/tiers')).length

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save 2 changes' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't save Elite: VeloxVerse is offline.")
    expect(alert).toHaveTextContent('Explorer was saved.')
    await waitFor(() =>
      expect(get.mock.calls.filter(([u]) => u.endsWith('/admin/club/tiers')).length).toBeGreaterThan(tierLoadsBefore)
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByText('1 unsaved change in 1 tier')).toBeInTheDocument()
    expect(cell('Elite', 'Free vouchers / year', 'Airport Dining')).toHaveTextContent('2 / year')
  })

  it('shows old support levels by name but only offers the current ones', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Perks' })
    expect(cell('Platinum', 'Customer support', 'Perks')).toHaveTextContent('VIP Dedicated')
    await user.click(cell('Platinum', 'Customer support', 'Perks'))
    const select = within(screen.getByRole('region', { name: 'Perks' })).getByRole('combobox', { name: 'Platinum Customer support' })
    const enabled = within(select).getAllByRole('option').filter((o) => !(o as HTMLOptionElement).disabled).map((o) => o.textContent)
    expect(enabled).toEqual(['Standard', 'Priority', 'Dedicated'])
  })

  it('shows the tier price in AUD, with its fixed prices underneath', async () => {
    serverTiers[4].homeCurrency = 'AUD'
    serverTiers[4].pricesByCurrency = { USD: 32900, GBP: 25900 }
    renderPage()
    expect(await screen.findByText('AUD 499.00 / year')).toBeInTheDocument()
    expect(screen.getByText('Also: GBP 259.00 · USD 329.00')).toBeInTheDocument()
    expect(screen.getAllByText(/^Also:/)).toHaveLength(1)
    expect(cell('Elite', 'Yearly price \\(AUD\\)', 'Price')).toHaveTextContent('AUD 499.00')
  })

  it('"Set none" clears a benefit for one tier', async () => {
    const user = userEvent.setup()
    renderPage()
    const pd = await screen.findByRole('region', { name: 'Airport Pick & Drop' })
    await user.click(within(pd).getByRole('button', { name: 'Set Silver Airport Pick & Drop to none' }))
    // Silver had 5% off and no free rides: only the discount actually changes.
    expect(screen.getByText('1 unsaved change in 1 tier')).toBeInTheDocument()
    expect(cell('Silver', 'Discount', 'Airport Pick & Drop')).toHaveTextContent('None')
  })
})
