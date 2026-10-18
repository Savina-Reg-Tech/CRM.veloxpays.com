// API Logs tab: every request, supplier call and webhook VeloxVerse recorded. Filters, range and
// the open log (?log=<id>) all live in the URL. Lists never carry bodies — the drawer fetches them.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, HelpCircle, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { useApiLogStats, useApiLogs, useExportApiLogs, useVVAuditMeta } from '../hooks/useVVAudit'
import { auditErrorText, fromLocalInput, lastHours, toLocalInput } from '../audit'
import type { ApiLogFilters } from '../auditTypes'
import { AuditEmpty, AuditErrorState, AuditPageShell, MaskedNote, selectClass, useAuditViewer } from '../components/audit/AuditUI'
import { ApiLogList } from '../components/vv-audit/ApiLogList'
import { ApiLogDrawer } from '../components/vv-audit/ApiLogDrawer'
import {
  ActiveFilterChips,
  ApiLogFilterPanel,
  ApiLogFilterSheet,
  FiltersButton,
  OverflowMenu,
  QuickFilterChips,
  apiLogFiltersFromParams,
  clearAllPatch,
  countPanelFilters,
  hasAnyFilter,
  type ParamPatch,
} from '../components/vv-audit/ApiLogFilters'
import { useIsDesktop, useIsTablet } from '../components/vv-audit/useMediaQuery'

const PRESETS = [
  { key: '1h', label: 'Last 1 h', hours: 1 },
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '3d', label: 'Last 3 days', hours: 72 },
  { key: '7d', label: 'Last 7 days', hours: 168 },
] as const

const ATTENTION_OUTCOMES = 'unknown,timeout'
/** Spec §5.10: the ref search box waits 300 ms after typing stops. */
const SEARCH_DEBOUNCE_MS = 300

function RefSearch({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft.trim() === value) return
    const t = setTimeout(() => onChange(draft.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Booking no., payment id, DragonPass order, Mint ref, request id…"
        aria-label="Search API logs by reference"
        className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-11 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:h-10 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            onChange('')
          }}
          aria-label="Clear search"
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

const dateInputClass =
  'h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 md:h-10 md:w-[12.5rem] md:flex-none sm:text-sm'

function DateRangeInputs({
  from,
  to,
  min,
  onChange,
  className,
}: {
  from?: string
  to?: string
  min: string
  onChange: (next: { from?: string; to?: string }) => void
  className?: string
}) {
  return (
    <div className={cn('min-w-0 items-center gap-1.5 text-sm text-gray-500', className)}>
      <input
        type="datetime-local"
        aria-label="From"
        min={min}
        value={toLocalInput(from)}
        onChange={(e) => onChange({ from: fromLocalInput(e.target.value), to })}
        className={dateInputClass}
      />
      <span aria-hidden="true">–</span>
      <input
        type="datetime-local"
        aria-label="To"
        min={min}
        value={toLocalInput(to)}
        onChange={(e) => onChange({ from, to: fromLocalInput(e.target.value) })}
        className={dateInputClass}
      />
    </div>
  )
}

export default function VVApiLogsPage() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()
  const { isAdmin } = useAuditViewer()
  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()
  const meta = useVVAuditMeta()
  const exportMut = useExportApiLogs()
  const retentionDays = meta.data?.apiLogs?.retentionDays ?? 7
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Presets are "last N hours" from this moment — fixed on mount (and when a preset is picked) so
  // the query key doesn't change every render.
  const [anchor, setAnchor] = useState(() => Date.now())

  // Only touches the given keys, so an open drawer (?log=<id>) survives filter changes.
  const patch = (next: ParamPatch) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(next)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true }
    )

  const fromParam = params.get('from') ?? undefined
  const toParam = params.get('to') ?? undefined
  const rangeKey = fromParam || toParam ? 'custom' : PRESETS.some((p) => p.key === params.get('range')) ? params.get('range')! : '24h'
  const range = useMemo(() => {
    if (rangeKey === 'custom') return { from: fromParam, to: toParam }
    return lastHours(PRESETS.find((p) => p.key === rangeKey)?.hours ?? 24, new Date(anchor))
  }, [rangeKey, fromParam, toParam, anchor])

  const paramKey = params.toString()
  const filters: ApiLogFilters = useMemo(
    () => ({ ...apiLogFiltersFromParams(new URLSearchParams(paramKey)), from: range.from, to: range.to }),
    [paramKey, range]
  )

  const query = useApiLogs(filters)
  const logs = useMemo(() => query.data?.pages.flatMap((p) => p.logs) ?? [], [query.data])
  const stats = useApiLogStats({ from: range.from, to: range.to })
  const attention = (stats.data?.byOutcome.unknown ?? 0) + (stats.data?.byOutcome.timeout ?? 0)
  const attentionOn = params.get('outcome') === ATTENTION_OUTCOMES

  const pickPreset = (key: string) => {
    if (key === 'custom') return patch({ range: undefined, from: range.from, to: range.to })
    setAnchor(Date.now())
    patch({ range: key === '24h' ? undefined : key, from: undefined, to: undefined })
  }
  const setCustomRange = (next: { from?: string; to?: string }) => patch({ range: undefined, from: next.from, to: next.to })
  const minLocal = toLocalInput(new Date(Date.now() - retentionDays * 86_400_000).toISOString())

  const doExport = async () => {
    if (exportMut.isPending) return
    try {
      const res = await exportMut.mutateAsync(filters)
      showToast(
        res.truncated
          ? { type: 'success', title: 'Export downloaded', message: `First 10,000 rows exported — narrow the filters. (${res.filename})` }
          : { type: 'success', title: 'Export downloaded', message: `${res.rows.toLocaleString()} rows · ${res.filename}` }
      )
    } catch (err) {
      showToast({ type: 'error', title: 'Export failed', message: auditErrorText(err) })
    }
  }

  const panelCount = countPanelFilters(params)
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
  }

  const attentionChip = stats.data && (
    <button
      type="button"
      onClick={() => patch({ outcome: attentionOn ? undefined : ATTENTION_OUTCOMES })}
      aria-pressed={attentionOn}
      title="Calls with an unknown outcome or no answer in time — click to show only these"
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-inset md:min-h-8 md:text-xs',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        attentionOn
          ? 'bg-violet-700 text-white ring-violet-700'
          : attention > 0
            ? 'bg-violet-50 text-violet-800 ring-violet-300 hover:bg-violet-100'
            : 'bg-gray-50 text-gray-600 ring-gray-200 hover:bg-gray-100'
      )}
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Needs attention: {attention.toLocaleString()}
    </button>
  )

  const exportLabel = (
    <>
      <Download className="h-4 w-4" aria-hidden="true" /> {exportMut.isPending ? 'Exporting…' : 'Export CSV'}
    </>
  )

  const ref = filters.ref
  const isEmpty = !query.isLoading && !query.isError && logs.length === 0

  return (
    <AuditPageShell
      title={
        <span className="flex flex-wrap items-center gap-2">
          API Logs
          {attentionChip}
        </span>
      }
      subtitle={`Every request, supplier call and webhook — kept ${retentionDays} days`}
    >
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <RefSearch value={params.get('ref') ?? ''} onChange={(v) => patch({ ref: v || undefined })} className="w-full md:w-auto md:min-w-[16rem] md:flex-1" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              aria-label="Date range"
              value={rangeKey}
              onChange={(e) => pickPreset(e.target.value)}
              className={cn(selectClass, 'h-11 min-w-0 flex-1 md:h-10 md:w-auto md:flex-none')}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
              <option value="custom">Custom range</option>
            </select>
            <DateRangeInputs from={range.from} to={range.to} min={minLocal} onChange={setCustomRange} className="hidden md:flex" />
            <FiltersButton count={panelCount} expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} />
            {isAdmin && (
              <OverflowMenu
                className="md:hidden"
                items={[{ key: 'export', label: exportLabel, onSelect: () => void doExport(), disabled: exportMut.isPending }]}
              />
            )}
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => void doExport()} loading={exportMut.isPending} className="hidden h-10 md:inline-flex lg:ml-auto">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>

        {/* Phones: the custom range gets its own row. */}
        {rangeKey === 'custom' && <DateRangeInputs from={range.from} to={range.to} min={minLocal} onChange={setCustomRange} className="flex md:hidden" />}

        <QuickFilterChips params={params} onPatch={patch} />

        {filtersOpen && isTablet && (
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <ApiLogFilterPanel params={params} onPatch={patch} />
          </div>
        )}

        <ActiveFilterChips params={params} onPatch={patch} onClearAll={() => patch(clearAllPatch())} />
        <MaskedNote />
      </Card>

      <ApiLogFilterSheet open={filtersOpen && !isTablet} onClose={() => setFiltersOpen(false)} params={params} onApply={patch} />

      <div className={cn(isDesktop && 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm')}>
        {query.isError ? (
          <AuditErrorState error={query.error} onRetry={() => void query.refetch()} retentionDays={retentionDays} />
        ) : isEmpty ? (
          ref ? (
            <AuditEmpty
              title={`Nothing found for '${ref}' in the last ${retentionDays} days`}
              text="Logs older than that are deleted."
            />
          ) : (
            <AuditEmpty
              title="No API calls match these filters in this range."
              text={hasAnyFilter(params) ? 'Try removing a filter or widening the date range.' : 'Try a wider date range.'}
            />
          )
        ) : (
          <>
            <ApiLogList
              logs={logs}
              loading={query.isLoading}
              onEndReached={isDesktop && query.hasNextPage && !query.isFetchingNextPage ? loadMore : undefined}
            />
            {!query.isLoading && (
              <div
                className={cn(
                  'flex flex-col gap-2 py-3 text-xs text-gray-500',
                  isDesktop && 'border-t border-gray-100 px-4'
                )}
              >
                {query.hasNextPage ? (
                  <Button variant="outline" onClick={loadMore} loading={query.isFetchingNextPage} className="min-h-11 w-full">
                    Load more
                  </Button>
                ) : null}
                <p className="text-center" aria-live="polite">
                  {logs.length.toLocaleString()} call{logs.length === 1 ? '' : 's'} shown{query.hasNextPage ? '' : ' · end of results'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <ApiLogDrawer />
    </AuditPageShell>
  )
}
