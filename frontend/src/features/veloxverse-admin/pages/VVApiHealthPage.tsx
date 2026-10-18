import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useApiLogStats } from '../hooks/useVVAudit'
import { lastHours } from '../audit'
import { AuditErrorState, AuditPageShell, AuditTime, selectClass } from '../components/audit/AuditUI'
import { ApiHealth } from '../components/vv-audit/ApiHealth'
import { ApiLogDrawer } from '../components/vv-audit/ApiLogDrawer'

const RANGES = [
  { key: '1h', hours: 1, label: '1 h' },
  { key: '24h', hours: 24, label: '24 h' },
  { key: '3d', hours: 72, label: '3 days' },
  { key: '7d', hours: 168, label: '7 days' },
] as const
const DEFAULT_RANGE = '24h'

const DIRECTIONS = [
  { value: '', label: 'All directions' },
  { value: 'inbound', label: 'Inbound (customer / CRM)' },
  { value: 'outbound', label: 'Supplier calls' },
  { value: 'webhook', label: 'Webhooks' },
]

/** API Health (§4.4): range and direction live in the URL (?range=3d&direction=outbound). */
export default function VVApiHealthPage() {
  const [params, setParams] = useSearchParams()
  const range = RANGES.find((r) => r.key === params.get('range')) ?? RANGES.find((r) => r.key === DEFAULT_RANGE)!
  const direction = DIRECTIONS.some((d) => d.value && d.value === params.get('direction')) ? params.get('direction')! : ''
  // "Now" is fixed per range choice so the query key is stable; Refresh moves it forward.
  const [nonce, setNonce] = useState(0)
  const span = useMemo(() => {
    void nonce
    return lastHours(range.hours)
  }, [range.hours, nonce])
  const stats = useApiLogStats({ ...span, direction: direction ? [direction] : undefined })

  const setParam = (key: string, value: string, fallback = '') =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value || value === fallback) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )

  return (
    <AuditPageShell title="API Health" subtitle="Our API, supplier calls and webhooks, from the API logs.">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time range" className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range.key === r.key}
              onClick={() => setParam('range', r.key, DEFAULT_RANGE)}
              className={cn(
                'min-h-11 rounded-full px-4 text-sm font-medium md:min-h-9 md:px-3 md:text-xs',
                range.key === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Last {r.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Direction"
          value={direction}
          onChange={(e) => setParam('direction', e.target.value)}
          className={cn(selectClass, 'h-11 w-full sm:w-56 md:h-10')}
        >
          {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setNonce((x) => x + 1)}
          disabled={stats.isFetching}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 md:min-h-9"
        >
          <RefreshCw className={cn('h-4 w-4', stats.isFetching && 'motion-safe:animate-spin')} aria-hidden="true" /> Refresh
        </button>
        {stats.data && (
          <span className="w-full text-xs text-gray-500 lg:ml-auto lg:w-auto">
            <AuditTime iso={stats.data.from} /> → <AuditTime iso={stats.data.to} />
          </span>
        )}
      </div>

      {stats.isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" label="Loading API health…" /></div>
      ) : stats.isError || !stats.data ? (
        <Card><AuditErrorState error={stats.error} onRetry={() => void stats.refetch()} /></Card>
      ) : (
        <div className={cn('transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
          <ApiHealth stats={stats.data} direction={direction || undefined} />
        </div>
      )}

      <ApiLogDrawer />
    </AuditPageShell>
  )
}
