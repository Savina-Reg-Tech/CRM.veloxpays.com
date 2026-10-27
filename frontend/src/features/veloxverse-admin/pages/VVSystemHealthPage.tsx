import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useToast } from '@/app/providers/ToastProvider'
import { auditErrorText } from '../audit'
import { useVVSystemHealth } from '../hooks/useVVSupplierReports'
import { vvSupplierReportsService } from '../vvAdminService'
import { HEALTH_DOT, HEALTH_KIND_LABEL, HEALTH_STATUS_LABEL } from '../supplierReports'
import { formatDateTime, timeAgo } from '../utils'
import type { HealthComponent, HealthStatus, SystemHealth } from '../types'

const BANNER: Record<HealthStatus, { className: string; icon: typeof CheckCircle2; text: string }> = {
  ok: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2, text: 'Everything is working.' },
  degraded: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: AlertTriangle,
    text: 'VeloxVerse is up, but something below is having problems.',
  },
  down: {
    className: 'border-red-200 bg-red-50 text-red-800',
    icon: XCircle,
    text: 'VeloxVerse’s database is down — customers can’t book or pay.',
  },
}

function ComponentRow({ c }: { c: HealthComponent }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', HEALTH_DOT[c.status])} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {c.name} <span className="font-normal text-gray-500">· {HEALTH_STATUS_LABEL[c.status]}</span>
          </p>
          {c.message && <p className="text-xs text-gray-500">{c.message}</p>}
        </div>
      </div>
      <div className="shrink-0 pl-5 text-xs text-gray-400 sm:pl-0 sm:text-right">
        {c.callCount != null && (
          <p>
            {c.callCount.toLocaleString()} call{c.callCount === 1 ? '' : 's'}
            {!!c.failureCount && <span className="text-red-500"> · {c.failureCount.toLocaleString()} failed</span>}
            {c.latencyMs != null && ` · ${c.latencyMs.toLocaleString()} ms`}
          </p>
        )}
        {c.callCount == null && c.latencyMs != null && <p>{c.latencyMs.toLocaleString()} ms</p>}
        <p title={c.lastSuccessAt ? formatDateTime(c.lastSuccessAt) : undefined}>
          {c.lastSuccessAt ? `Last OK ${timeAgo(c.lastSuccessAt)}` : 'No success recorded'}
        </p>
      </div>
    </li>
  )
}

export default function VVSystemHealthPage() {
  const { data, isLoading, isError, isFetching } = useVVSystemHealth()
  const qc = useQueryClient()
  const [checking, setChecking] = useState(false)
  const { showToast } = useToast()

  // "Check now" asks VeloxVerse to skip its 30-second cache.
  const checkNow = async () => {
    setChecking(true)
    try {
      qc.setQueryData<SystemHealth>(['vv-health'], await vvSupplierReportsService.getHealth(true))
    } catch (err) {
      showToast({ type: 'error', title: 'Check failed', message: auditErrorText(err) })
    } finally {
      setChecking(false)
    }
  }

  const groups = new Map<string, HealthComponent[]>()
  for (const c of data?.components ?? []) groups.set(c.kind, [...(groups.get(c.kind) ?? []), c])
  const banner = data ? BANNER[data.status] : null

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System health</h1>
          <p className="text-sm text-gray-500">
            VeloxVerse, its suppliers, background jobs and email. Refreshes every minute; admins get an email if VeloxVerse stops
            answering.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void checkNow()} loading={checking || (isFetching && !isLoading)}>
          <RefreshCw className="h-4 w-4" /> Check now
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !data || !banner ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn&rsquo;t reach VeloxVerse at all — it may be down. Admins are emailed automatically if it stays down.
        </div>
      ) : (
        <>
          <div className={cn('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm', banner.className)}>
            <banner.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {banner.text} <span className="opacity-70">Checked {timeAgo(data.checkedAt)}.</span>
            </span>
          </div>

          {[...groups.entries()].map(([kind, components]) => (
            <Card key={kind} padding="none">
              <h2 className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {HEALTH_KIND_LABEL[kind] ?? kind}
              </h2>
              <ul className="divide-y divide-gray-50">
                {components.map((c) => (
                  <ComponentRow key={c.name} c={c} />
                ))}
              </ul>
            </Card>
          ))}

          <p className="text-xs text-gray-500">
            Suppliers are judged from VeloxVerse&rsquo;s own calls to them in the last {data.windowMinutes} minutes — this page never calls a
            supplier. Grey means &ldquo;not used recently&rdquo;, not a fault.
          </p>
        </>
      )}
    </div>
  )
}
