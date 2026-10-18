import { useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowRight, Globe2, Home, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Skeleton from '@/components/ui/Skeleton'
import Pagination from '@/components/ui/Pagination'
import { cn } from '@/lib/utils'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVClubPriceHistory,
  useVVClubPriceLists,
  useVVRemoveClubPriceList,
  useVVSetClubPriceList,
} from '../hooks/useVVClub'
import { formatCentsIn } from '../loungeUtils'
import { apiErrorMessage, formatDateTime } from '../utils'
import {
  addableCountries,
  countriesTitle,
  isValidPrice,
  majorAmount,
  sharedCurrencyNote,
  todayValueLine,
} from '../clubPrices'
import type { ClubHomePrice, ClubPriceCountry, ClubPriceList, ClubPriceLists } from '../types'

const HISTORY_LIMIT = 30

/**
 * VeloxClub "Prices by country": the AUD home price plus one fixed price list per currency.
 * Every figure (today's AUD value, drift) comes from VeloxVerse — nothing is converted here.
 */
export default function ClubPricesPanel({ onEditHomePrices }: { onEditHomePrices: () => void }) {
  const { data, isLoading, error } = useVVClubPriceLists()
  const removeList = useVVRemoveClubPriceList()
  const { showToast } = useToast()

  /** The editor: `currency` is null while a country is still being picked. */
  const [editor, setEditor] = useState<{ currency: string | null; picking: boolean } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  function confirmRemove() {
    if (!removing) return
    const currency = removing
    removeList.mutate(
      { currency },
      {
        onSuccess: () => {
          showToast({ title: `${currency} prices removed`, type: 'success' })
          setRemoving(null)
        },
        onError: (e) => {
          showToast({ title: apiErrorMessage(e, `Couldn't remove the ${currency} prices`), type: 'error' })
          setRemoving(null)
        },
      }
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>{apiErrorMessage(error, error instanceof Error ? error.message : 'Could not load prices')}</span>
      </div>
    )
  }
  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  }

  const home = data.homeCurrency

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Prices by country</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Home currency: {home}. A price set here is shown and charged exactly as typed. Currencies with no prices use
            the {home} price converted at today&apos;s rate.
          </p>
        </div>
        <Button variant="primary" size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => setEditor({ currency: null, picking: true })}>
          <Plus className="mr-1.5 h-4 w-4" /> Add country
        </Button>
      </div>

      {/* AUD home prices — edited in the Tiers sheet */}
      <PriceCard
        title={`Australia (home) · ${home}`}
        icon={<Home className="h-4 w-4" />}
        actions={
          <Button variant="outline" size="sm" onClick={onEditHomePrices}>
            Change in Tiers editor <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        }
      >
        <TierGrid>
          {data.homePrices.map((t) => (
            <TierPrice key={t.tierId} name={t.name} inactive={!t.isActive}>
              <div className="font-semibold text-gray-900 tabular-nums">{formatCentsIn(t.priceCents, home)}</div>
            </TierPrice>
          ))}
        </TierGrid>
      </PriceCard>

      {data.priceLists.length === 0 && (
        <Card padding="sm" className="text-center text-sm text-gray-500">
          No fixed prices yet. Every currency sees the {home} price converted at today&apos;s rate.
        </Card>
      )}

      {data.priceLists.map((list) => (
        <PriceListCard
          key={list.currency}
          list={list}
          lists={data}
          onEdit={() => setEditor({ currency: list.currency, picking: false })}
          onRemove={() => setRemoving(list.currency)}
        />
      ))}

      <PriceHistory />

      {editor && (
        <PriceListEditor
          lists={data}
          initialCurrency={editor.currency}
          picking={editor.picking}
          onClose={() => setEditor(null)}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={`Remove ${removing ?? ''} prices`}
        message={`Customers paying in ${removing ?? ''} will see the ${home} price converted at today's rate. Continue?`}
        confirmLabel="Remove"
        danger
        loading={removeList.isPending}
      />
    </div>
  )
}

// ── Layout pieces ───────────────────────────────────────────────────────────

function PriceCard({ title, icon, subtitle, actions, children }: {
  title: string
  icon: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  )
}

/** One cell per tier: 1 column on a phone, 2 on small screens, up to 4 on wide ones. */
function TierGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">{children}</div>
}

function TierPrice({ name, inactive, children }: { name: string; inactive?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm', inactive && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="truncate font-medium">{name}</span>
        {inactive && <span className="shrink-0 text-[11px]">Inactive</span>}
      </div>
      {children}
    </div>
  )
}

function PriceListCard({ list, lists, onEdit, onRemove }: {
  list: ClubPriceList
  lists: ClubPriceLists
  onEdit: () => void
  onRemove: () => void
}) {
  const missing = list.tiers.filter((t) => t.priceCents === null).map((t) => t.name)
  const title = `${countriesTitle(list.countries)} · ${list.currency}`
  return (
    <PriceCard
      title={title}
      icon={<Globe2 className="h-4 w-4" />}
      subtitle={
        <>
          {list.countries.length > 2 && (
            <p className="text-xs text-gray-500" title={list.countries.map((c) => c.name).join(', ')}>
              {list.countries.length} countries pay in {list.currency}
            </p>
          )}
          {!list.complete && (
            <Badge variant="danger" className="mt-1">Incomplete{missing.length ? ` — missing ${missing.join(', ')}` : ''}</Badge>
          )}
        </>
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${list.currency} prices`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onRemove} aria-label={`Remove ${list.currency} prices`}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-red-500" /> Remove
          </Button>
        </>
      }
    >
      <TierGrid>
        {list.tiers.map((t) => (
          <TierPrice key={t.tierId} name={t.name}>
            <div className="font-semibold text-gray-900 tabular-nums">
              {t.priceCents === null ? <span className="text-red-600">Not set</span> : formatCentsIn(t.priceCents, list.currency)}
            </div>
            {t.priceCents !== null && (
              <div className="text-[11px] leading-snug text-gray-500">
                {list.fxAvailable ? todayValueLine(t, lists.homeCurrency) : `Today's ${lists.homeCurrency} value unavailable`}
              </div>
            )}
            {t.driftWarning && (
              <Badge variant="warning" className="mt-1 whitespace-normal text-[11px]">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Drifted more than {lists.driftWarnPct}% from the {lists.homeCurrency} price
              </Badge>
            )}
          </TierPrice>
        ))}
      </TierGrid>
    </PriceCard>
  )
}

// ── Add / edit ──────────────────────────────────────────────────────────────

function PriceListEditor({ lists, initialCurrency, picking, onClose }: {
  lists: ClubPriceLists
  initialCurrency: string | null
  picking: boolean
  onClose: () => void
}) {
  const setList = useVVSetClubPriceList()
  const { showToast } = useToast()
  const [country, setCountry] = useState<ClubPriceCountry | null>(null)
  const [search, setSearch] = useState('')
  const currency = initialCurrency ?? country?.currency ?? null
  const existing = lists.priceLists.find((l) => l.currency === currency)

  const [values, setValues] = useState<Record<string, string>>(() => initialValues(lists.homePrices, existing))
  const [note, setNote] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const options = useMemo(() => addableCountries(lists), [lists])
  const q = search.trim().toLowerCase()
  const shown = q
    ? options.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.currency.toLowerCase().includes(q))
    : options
  const sharedNote = country ? sharedCurrencyNote(country, lists.countries) : null

  const allValid = lists.homePrices.length > 0 && lists.homePrices.every((t) => isValidPrice(values[t.slug] ?? ''))

  function save() {
    if (!currency || !allValid) return
    setFailure(null)
    const prices = Object.fromEntries(lists.homePrices.map((t) => [t.slug, Math.round(Number(values[t.slug]) * 100)]))
    setList.mutate(
      { currency, prices, changeNote: note.trim() || undefined },
      {
        onSuccess: () => {
          showToast({ title: `${currency} prices saved`, type: 'success' })
          onClose()
        },
        onError: (e) => setFailure(apiErrorMessage(e, `Couldn't save the ${currency} prices`)),
      }
    )
  }

  const title = picking ? 'Add country' : `Edit ${currency} prices`

  return (
    <Modal open onClose={() => !setList.isPending && onClose()} title={title} size="xl"
      description={currency ? `Customers paying in ${currency} see and pay exactly these prices.` : 'Pick the country to price.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setList.isPending}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={setList.isPending} disabled={!currency || !allValid}>
            Save{currency ? ` ${currency} prices` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {picking && (
          <div className="space-y-2">
            <Input
              aria-label="Search countries"
              placeholder="Search country or currency…"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div role="listbox" aria-label="Countries" className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {shown.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-gray-400">No country to add</p>
              ) : (
                shown.map((c) => {
                  const selected = country?.code === c.code
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setCountry(c)
                        const list = lists.priceLists.find((l) => l.currency === c.currency)
                        setValues(initialValues(lists.homePrices, list))
                        setFailure(null)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0',
                        selected ? 'bg-indigo-50 font-medium text-indigo-700' : 'hover:bg-gray-50'
                      )}
                    >
                      {c.name} ({c.currency})
                    </button>
                  )
                })
              )}
            </div>
            {sharedNote && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{sharedNote}</p>}
          </div>
        )}

        {currency && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lists.homePrices.map((t) => {
                const raw = values[t.slug] ?? ''
                const bad = raw.trim() !== '' && !isValidPrice(raw)
                return (
                  <div key={t.tierId} className="space-y-1">
                    <label htmlFor={`price-${t.slug}`} className="flex items-baseline justify-between gap-2 text-sm font-medium text-gray-700">
                      {t.name}
                      <span className="text-xs font-normal text-gray-400">{lists.homeCurrency} price: {majorAmount(t.priceCents)}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-medium text-gray-500">{currency}</span>
                      <input
                        id={`price-${t.slug}`}
                        inputMode="decimal"
                        aria-invalid={bad}
                        value={raw}
                        placeholder="0.00"
                        onChange={(e) => setValues((v) => ({ ...v, [t.slug]: e.target.value }))}
                        className={cn(
                          'w-full rounded-lg border bg-white px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2',
                          bad ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-100'
                        )}
                      />
                    </div>
                    {bad && <p className="text-xs text-red-600">At least {currency} 1.00, up to 2 decimals</p>}
                  </div>
                )
              })}
            </div>
            <Input label="Change note (optional)" id="club-price-note" placeholder="e.g. UK launch" value={note} onChange={(e) => setNote(e.target.value)} />
            {!allValid && <p className="text-xs text-gray-500">Enter a price of at least {currency} 1.00 for every tier to save.</p>}
          </div>
        )}

        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{failure}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

function initialValues(homePrices: ClubHomePrice[], list: ClubPriceList | undefined): Record<string, string> {
  return Object.fromEntries(
    homePrices.map((t) => {
      const cents = list?.tiers.find((x) => x.slug === t.slug)?.priceCents
      return [t.slug, cents == null ? '' : (cents / 100).toFixed(2)]
    })
  )
}

// ── History ─────────────────────────────────────────────────────────────────

function PriceHistory() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useVVClubPriceHistory(page, HISTORY_LIMIT)

  return (
    <Card padding="none">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Price history</h3>
      </div>
      {error ? (
        <p className="px-4 py-6 text-sm text-red-600">{apiErrorMessage(error, 'Could not load the price history')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Old</th>
                <th className="px-4 py-3 text-right font-medium">New</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Changed by</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
                ))
              ) : !data?.changes.length ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No price changes yet</td></tr>
              ) : (
                data.changes.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(c.changedAt)}</td>
                    <td className="px-4 py-3">{c.tier}</td>
                    <td className="px-4 py-3 font-medium">{c.currency}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-500">
                      {c.oldPriceCents === null ? <Badge variant="info">Added</Badge> : formatCentsIn(c.oldPriceCents, c.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">
                      {c.newPriceCents === null ? <Badge variant="neutral">Removed</Badge> : formatCentsIn(c.newPriceCents, c.currency)}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-gray-600" title={c.changeNote ?? undefined}>{c.changeNote ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{c.changedBy ? `${c.changedBy.name} (${c.changedBy.email})` : 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {data?.pagination && (
        <div className="border-t px-4 py-3">
          <Pagination page={data.pagination.page} pageSize={data.pagination.limit || HISTORY_LIMIT} total={data.pagination.total} onPageChange={setPage} />
        </div>
      )}
    </Card>
  )
}
