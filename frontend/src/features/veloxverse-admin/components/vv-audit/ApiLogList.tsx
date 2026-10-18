// API-log list: table ≥ lg, cards below. Opens the drawer via ?log=<id> (mount <ApiLogDrawer />
// once on the page). Works standalone — e.g. API Health's "Needs attention now". Never bodies.
import type { ApiLogSummary } from '../../auditTypes'
import { useOpenApiLog } from './ApiBits'
import { ApiLogCardSkeleton, ApiLogCards } from './ApiLogCard'
import { ApiLogTable, ApiLogTableSkeleton } from './ApiLogTable'
import { useIsDesktop } from './useMediaQuery'

export interface ApiLogListProps {
  logs: ApiLogSummary[]
  /** Shows layout-matched skeletons. */
  loading?: boolean
  /** Hide the Customer / Refs / Flags columns (compact embeds). */
  compact?: boolean
  /** Force a layout (tests, embeds); default picks table ≥ lg, cards below. */
  layout?: 'auto' | 'table' | 'cards'
  /** Table only: called when the last row scrolls into view (infinite scroll on lg+). */
  onEndReached?: () => void
  /** Table only: classes for its scroll container (default max-h-[75vh]). */
  scrollClassName?: string
  /** Number of skeleton rows / cards while loading. */
  skeletonCount?: number
}

export function ApiLogList({ logs, loading = false, compact = false, layout = 'auto', onEndReached, scrollClassName, skeletonCount }: ApiLogListProps) {
  const isDesktop = useIsDesktop()
  const open = useOpenApiLog()
  const asTable = layout === 'table' || (layout === 'auto' && isDesktop)

  if (loading && !logs.length) {
    return asTable ? <ApiLogTableSkeleton rows={skeletonCount ?? 8} compact={compact} /> : <ApiLogCardSkeleton count={skeletonCount ?? 6} />
  }
  return asTable ? (
    <ApiLogTable logs={logs} onOpen={open} compact={compact} onEndReached={onEndReached} scrollClassName={scrollClassName} />
  ) : (
    <ApiLogCards logs={logs} onOpen={open} />
  )
}
