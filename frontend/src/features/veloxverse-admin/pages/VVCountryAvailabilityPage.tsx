import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { countryNameMap } from '../availability'
import { useVVAvailability } from '../hooks/useVVAvailability'
import { AuditErrorState } from '../components/audit/AuditUI'
import ServicesTab, { type ServicesFilters } from '../components/availability/ServicesTab'
import PreviewTab from '../components/availability/PreviewTab'
import HistoryTab from '../components/availability/HistoryTab'
import EditRulePanel from '../components/availability/EditRulePanel'

type TabKey = 'services' | 'preview' | 'history'
const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: 'services', label: 'Services', short: 'Services' },
  { key: 'preview', label: 'Preview a country', short: 'Preview' },
  { key: 'history', label: 'Change history', short: 'History' },
]
const DEFAULT_PREVIEW_COUNTRY = 'AU'

/**
 * Country Availability — which VeloxVerse services, sub-services and forms customers in each
 * country can use. Everything shareable (tab, search, group, open rule, preview country) lives in
 * the query string, e.g. ?rule=velox-assist.pick-drop opens that rule straight away.
 */
export default function VVCountryAvailabilityPage() {
  const overview = useVVAvailability()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    document.title = 'Country Availability'
  }, [])

  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'services') as TabKey
  const filters: ServicesFilters = {
    q: params.get('q') ?? '',
    group: params.get('group') ?? '',
    restricted: params.get('restricted') === '1',
  }
  // ?country=unknown previews a visitor whose country can't be told; no param = Australia.
  const rawCountry = params.get('country')
  const previewCountry = rawCountry === null ? DEFAULT_PREVIEW_COUNTRY : rawCountry === 'unknown' ? '' : rawCountry.toUpperCase()
  const ruleKey = params.get('rule')

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )

  const names = useMemo(() => countryNameMap(overview.data?.countries), [overview.data?.countries])
  const editing = ruleKey ? overview.data?.items.find((i) => i.key === ruleKey) : undefined
  const openRule = (key: string) => update({ rule: key })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Country Availability</h1>
        <p className="mt-1 text-sm text-gray-500">Choose which VeloxVerse services customers in each country can use.</p>
      </div>

      {overview.data &&
        (overview.data.enforced ? (
          <p className="flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Live — new purchases follow a saved rule within about a minute; customers&apos; screens update within a few minutes.</span>
          </p>
        ) : (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">Rules are saved but not live yet.</span> VeloxVerse&apos;s master switch is off, so every service is
              available in every country. Ask the VeloxVerse team to switch it on.
            </p>
          </div>
        ))}

      <Tabs defaultValue="services" value={tab} onChange={(t) => update({ tab: t === 'services' ? null : t })}>
        <TabsList className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {overview.isError ? (
          <Card className="mt-4">
            <AuditErrorState error={overview.error} onRetry={() => overview.refetch()} />
          </Card>
        ) : overview.isLoading || !overview.data ? (
          <div className="space-y-4 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="services">
              <ServicesTab
                overview={overview.data}
                names={names}
                filters={filters}
                onFiltersChange={(p) =>
                  update({
                    ...(p.q !== undefined ? { q: p.q } : {}),
                    ...(p.group !== undefined ? { group: p.group } : {}),
                    ...(p.restricted !== undefined ? { restricted: p.restricted ? '1' : null } : {}),
                  })
                }
                onEdit={openRule}
              />
            </TabsContent>
            <TabsContent value="preview">
              <PreviewTab
                overview={overview.data}
                names={names}
                country={previewCountry}
                onCountryChange={(c) => update({ country: c === DEFAULT_PREVIEW_COUNTRY ? null : c || 'unknown' })}
                onOpen={openRule}
              />
            </TabsContent>
            <TabsContent value="history">
              <HistoryTab overview={overview.data} names={names} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {editing && overview.data && (
        <EditRulePanel key={editing.key} item={editing} overview={overview.data} names={names} onClose={() => update({ rule: null })} />
      )}
    </div>
  )
}
