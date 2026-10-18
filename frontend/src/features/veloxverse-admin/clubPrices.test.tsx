import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
const put = vi.fn()
const del = vi.fn()
vi.mock('@/lib/axios', () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    put: (...a: unknown[]) => put(...a),
    post: vi.fn(),
    delete: (...a: unknown[]) => del(...a),
  },
}))

// The modal's focus trap needs real layout to find focusable elements; jsdom has none.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  FocusTrap: ({ children }: { children: React.ReactNode }) => children,
}))

import ToastProvider from '@/app/providers/ToastProvider'
import ClubPricesPanel from './components/ClubPricesPanel'
import VVClubPage from './pages/VVClubPage'
import { addableCountries, isValidPrice, sharedCurrencyNote, todayValueLine } from './clubPrices'
import type { ClubPriceHistoryPage, ClubPriceLists, ClubPromoRow } from './types'

// ── fixtures ────────────────────────────────────────────────────────────────

const country = (code: string, name: string, currency: string) => ({ code, name, currency })

const EUR_COUNTRIES = [
  country('AT', 'Austria', 'EUR'), country('BE', 'Belgium', 'EUR'), country('FI', 'Finland', 'EUR'),
  country('FR', 'France', 'EUR'), country('DE', 'Germany', 'EUR'), country('GR', 'Greece', 'EUR'),
  country('IE', 'Ireland', 'EUR'), country('IT', 'Italy', 'EUR'), country('NL', 'Netherlands', 'EUR'),
  country('ES', 'Spain', 'EUR'),
]

const homePrices = [
  { tierId: 't-silver', slug: 'silver', name: 'Silver', isActive: true, priceCents: 9900 },
  { tierId: 't-gold', slug: 'gold', name: 'Gold', isActive: true, priceCents: 19900 },
  { tierId: 't-platinum', slug: 'platinum', name: 'Platinum', isActive: true, priceCents: 34900 },
  { tierId: 't-elite', slug: 'elite', name: 'Elite', isActive: true, priceCents: 49900 },
]

const gbpTier = (slug: string, name: string, priceCents: number, homePriceCents: number, audValueCents: number, driftPct: number, driftWarning = false) => ({
  tierId: `t-${slug}`, slug, name, priceCents, homePriceCents, audValueCents, driftPct, driftWarning,
})

const makeLists = (): ClubPriceLists => ({
  homeCurrency: 'AUD',
  driftWarnPct: 12,
  currencies: ['USD', 'GBP', 'EUR', 'NZD', 'INR', 'BDT', 'CAD'],
  countries: [
    country('AU', 'Australia', 'AUD'),
    country('GB', 'United Kingdom', 'GBP'),
    country('US', 'United States', 'USD'),
    country('JP', 'Japan', 'JPY'),
    ...EUR_COUNTRIES,
  ],
  homePrices,
  priceLists: [
    {
      currency: 'GBP',
      countries: [country('GB', 'United Kingdom', 'GBP')],
      complete: true,
      fxAvailable: true,
      tiers: [
        gbpTier('silver', 'Silver', 4900, 9900, 9800, -1.0),
        gbpTier('gold', 'Gold', 14900, 19900, 29800, 49.7, true),
        gbpTier('platinum', 'Platinum', 19900, 34900, 39800, 14.0, true),
        gbpTier('elite', 'Elite', 25900, 49900, 51800, 3.8),
      ],
    },
  ],
})

let lists: ClubPriceLists
let history: ClubPriceHistoryPage

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <ClubPricesPanel onEditHomePrices={() => {}} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  get.mockReset()
  put.mockReset()
  del.mockReset()
  lists = makeLists()
  history = { changes: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 1 } }
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/admin/club/prices')) return { data: { success: true, data: structuredClone(lists) } }
    if (url.endsWith('/admin/club/prices/history')) return { data: { success: true, data: structuredClone(history) } }
    return { data: { success: true, data: [] } }
  })
  put.mockImplementation(async () => ({ data: { success: true, data: structuredClone(lists) } }))
  del.mockImplementation(async () => ({ data: { success: true, data: { ...structuredClone(lists), priceLists: [] } } }))
})

// ── pure rules ──────────────────────────────────────────────────────────────

describe('price rules', () => {
  it('only offers countries whose currency can get a new list', () => {
    const names = addableCountries(makeLists()).map((c) => c.name)
    expect(names).toContain('Germany')
    expect(names).toContain('United States')
    expect(names).not.toContain('Australia') // home currency
    expect(names).not.toContain('United Kingdom') // GBP already has a list
    expect(names).not.toContain('Japan') // JPY can't have a list
  })

  it('names the countries that share a currency', () => {
    const lists = makeLists()
    const de = lists.countries.find((c) => c.code === 'DE')!
    expect(sharedCurrencyNote(de, lists.countries)).toBe('Germany, Austria and 8 more share EUR — they will use this price list too.')
    expect(sharedCurrencyNote(lists.countries.find((c) => c.code === 'US')!, lists.countries)).toBeNull()
  })

  it('reads today’s AUD value and drift', () => {
    expect(todayValueLine({ audValueCents: 51800, driftPct: 3.8 }, 'AUD').replace(/\s/g, ' ')).toBe('≈ AUD 518.00 today (+3.8%)')
    expect(todayValueLine({ audValueCents: 9800, driftPct: -1 }, 'AUD').replace(/\s/g, ' ')).toBe('≈ AUD 98.00 today (-1.0%)')
    expect(todayValueLine({ audValueCents: null, driftPct: null }, 'AUD')).toBe("Today's AUD value unavailable")
  })

  it.each([['259', true], ['1', true], ['0.99', false], ['259.999', false], ['', false], ['abc', false]])('%j valid: %s', (raw, ok) => {
    expect(isValidPrice(raw)).toBe(ok)
  })
})

// ── the panel ───────────────────────────────────────────────────────────────

describe('Prices by country', () => {
  it('shows the AUD home row first, then the GBP list with today’s value and drift badges', async () => {
    renderPanel()
    const home = await screen.findByRole('region', { name: 'Australia (home) · AUD' })
    expect(within(home).getByText('AUD 499.00')).toBeInTheDocument()

    const gbp = screen.getByRole('region', { name: 'United Kingdom · GBP' })
    expect(within(gbp).getByText('GBP 259.00')).toBeInTheDocument()
    expect(within(gbp).getByText('≈ AUD 518.00 today (+3.8%)')).toBeInTheDocument()
    // Two tiers drifted; the % comes from driftWarnPct, not a hard-coded 10.
    expect(within(gbp).getAllByText('Drifted more than 12% from the AUD price')).toHaveLength(2)
    expect(screen.getByText(/Home currency: AUD\. A price set here is shown and charged exactly as typed\./)).toBeInTheDocument()
  })

  it('says when today’s AUD value is unavailable', async () => {
    lists.priceLists[0].fxAvailable = false
    renderPanel()
    const gbp = await screen.findByRole('region', { name: 'United Kingdom · GBP' })
    expect(within(gbp).getAllByText("Today's AUD value unavailable")).toHaveLength(4)
    expect(within(gbp).queryByText(/today \(/)).toBeNull()
  })

  it('Add country hides AUD and taken currencies; Germany picks EUR and warns about shared countries', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Add country' }))
    const dialog = await screen.findByRole('dialog')
    const options = within(dialog).getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Germany (EUR)')
    expect(options).not.toContain('Australia (AUD)')
    expect(options).not.toContain('United Kingdom (GBP)')

    await user.type(within(dialog).getByRole('textbox', { name: 'Search countries' }), 'germ')
    expect(within(dialog).getAllByRole('option')).toHaveLength(1)
    await user.click(within(dialog).getByRole('option', { name: 'Germany (EUR)' }))
    expect(within(dialog).getByText('Germany, Austria and 8 more share EUR — they will use this price list too.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save EUR prices' })).toBeDisabled()
    expect(within(dialog).getByText('AUD price: 499.00')).toBeInTheDocument()
  })

  it('keeps Save disabled until every tier has at least 1.00, then sends cents by slug', async () => {
    const user = userEvent.setup()
    lists.priceLists = []
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Add country' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('option', { name: 'United Kingdom (GBP)' }))
    const save = within(dialog).getByRole('button', { name: 'Save GBP prices' })

    await user.type(within(dialog).getByLabelText(/^Silver/), '49')
    await user.type(within(dialog).getByLabelText(/^Gold/), '149')
    await user.type(within(dialog).getByLabelText(/^Platinum/), '0.5')
    await user.type(within(dialog).getByLabelText(/^Elite/), '259')
    expect(save).toBeDisabled()
    await user.clear(within(dialog).getByLabelText(/^Platinum/))
    await user.type(within(dialog).getByLabelText(/^Platinum/), '199')
    await user.type(within(dialog).getByLabelText('Change note (optional)'), 'UK launch')
    expect(save).toBeEnabled()

    await user.click(save)
    await screen.findByText('GBP prices saved')
    expect(put).toHaveBeenCalledWith('/vv-admin/admin/club/prices/GBP', {
      prices: { silver: 4900, gold: 14900, platinum: 19900, elite: 25900 },
      changeNote: 'UK launch',
    })
  })

  it("shows VeloxVerse's error as-is", async () => {
    const user = userEvent.setup()
    put.mockRejectedValue({ response: { status: 400, data: { message: 'Set a GBP price for every tier. Missing: Silver.' } } })
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Edit GBP prices' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/^Elite/)).toHaveValue('259.00')
    await user.click(within(dialog).getByRole('button', { name: 'Save GBP prices' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Set a GBP price for every tier. Missing: Silver.')
  })

  it('asks before removing a list, then calls DELETE', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Remove GBP prices' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Customers paying in GBP will see the AUD price converted at today's rate. Continue?")).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/vv-admin/admin/club/prices/GBP', { data: { changeNote: undefined } }))
    await screen.findByText('GBP prices removed')
  })

  it('history shows "Added" and "Removed" for missing old / new prices', async () => {
    const base = { tier: 'Elite', tierSlug: 'elite', currency: 'GBP', changeNote: null, changedAt: '2026-10-18T09:00:00Z', changedBy: null }
    history = {
      changes: [
        { ...base, id: 'h1', oldPriceCents: null, newPriceCents: 25900, changeNote: 'UK launch' },
        { ...base, id: 'h2', oldPriceCents: 25900, newPriceCents: null },
      ],
      pagination: { page: 1, limit: 30, total: 2, totalPages: 1 },
    }
    renderPanel()
    const added = (await screen.findByText('UK launch')).closest('tr')!
    expect(within(added).getByText('Added')).toBeInTheDocument()
    expect(within(added).getByText('GBP 259.00')).toBeInTheDocument()
    const removed = screen.getByText('Removed').closest('tr')!
    expect(within(removed).getByText('GBP 259.00')).toBeInTheDocument()
  })
})

// ── promo codes ─────────────────────────────────────────────────────────────

describe('Club promo codes', () => {
  it('formats fixed and max discounts in AUD', async () => {
    const promo = (over: Partial<ClubPromoRow>): ClubPromoRow => ({
      id: 'p', code: 'X', discountType: 'FIXED', discountValue: 5000, maxDiscountCents: null, applicableTiers: [],
      maxUses: null, currentUses: 0, maxUsesPerUser: 1, firstPurchaseOnly: false, isActive: true,
      startsAt: null, expiresAt: null, createdAt: '2026-10-01T00:00:00Z', ...over,
    })
    get.mockImplementation(async (url: string) => {
      if (url.endsWith('/admin/club/promos')) {
        return { data: { success: true, data: [
          promo({ id: 'p1', code: 'FIFTY' }),
          promo({ id: 'p2', code: 'HALF', discountType: 'PERCENTAGE', discountValue: 5000, maxDiscountCents: 10000 }),
        ] } }
      }
      return { data: { success: true, data: [] } }
    })
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>
            <VVClubPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('button', { name: /Promo Codes/ }))
    expect((await screen.findByText('FIFTY')).closest('tr')).toHaveTextContent('AUD 50.00')
    expect(screen.getByText('HALF').closest('tr')).toHaveTextContent('50% (max AUD 100.00)')
  })
})
