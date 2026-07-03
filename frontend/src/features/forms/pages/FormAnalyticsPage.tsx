import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, AlertCircle } from 'lucide-react'
import { useFormAnalytics, useForm } from '../hooks/useForms'
import type { DailyCount } from '../types'

// ── Build a full 30-day range, filling missing days with count=0 ──
function buildFullRange(sparse: DailyCount[]): DailyCount[] {
  const dataMap = new Map(sparse.map((d) => [d.day, d.count]))
  const result: DailyCount[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const day = date.toISOString().slice(0, 10)   // "YYYY-MM-DD"
    result.push({ day, count: dataMap.get(day) ?? 0 })
  }
  return result
}

function StatCard({ label, value, color = 'text-indigo-600' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// Friendly day label: show "Jun 9", "Jun 15", etc.
function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

export default function FormAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const formId = parseInt(id!, 10)
  const navigate = useNavigate()

  const { data: form } = useForm(formId)
  const { data: analytics, isLoading, isError, refetch } = useFormAnalytics(formId)

  // Always show a full 30-day range — days with no submissions get count=0
  const daily = buildFullRange(analytics?.daily ?? [])
  const maxCount = Math.max(...daily.map((d) => d.count), 1)
  const totalInRange = daily.reduce((s, d) => s + d.count, 0)

  // Label ticks: show every 5th day
  const tickIndices = new Set([0, 5, 10, 15, 20, 25, 29])

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/forms')}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500">{form?.name ?? '—'}</p>
        </div>
      </div>

      {/* Summary cards */}
      {form && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Submissions" value={form.total_submissions} />
          <StatCard label="Total Leads"       value={form.total_leads} color="text-purple-600" />
          <StatCard label="Last 30 Days"      value={totalInRange} color="text-blue-600" />
          <StatCard label="Status"            value={form.status} color={form.status === 'published' ? 'text-emerald-600' : 'text-amber-600'} />
        </div>
      )}

      {/* Daily chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-800">Submissions — Last 30 Days</h3>
          </div>
          {totalInRange > 0 && (
            <span className="text-xs text-gray-400">{totalInRange} total in range</span>
          )}
        </div>

        {isLoading ? (
          <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin mr-2" />
            Loading…
          </div>
        ) : isError ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2 text-red-500 text-sm">
            <AlertCircle size={20} />
            <span>Failed to load analytics</span>
            <button onClick={() => refetch()} className="text-xs text-indigo-500 underline">Retry</button>
          </div>
        ) : (
          <>
            {/* Chart — pixel heights so bars always render correctly */}
            {(() => {
              const CHART_H = 160  // px — matches the rendered area
              return (
                <div className="relative" style={{ height: CHART_H + 24 }}>
                  {/* Horizontal guide lines + Y labels */}
                  {[1, 0.5, 0].map((frac) => {
                    const top = Math.round((1 - frac) * CHART_H)
                    return (
                      <div
                        key={frac}
                        className="absolute left-0 right-0 flex items-center gap-2 pointer-events-none"
                        style={{ top }}
                      >
                        <span className="text-[10px] text-gray-400 w-6 text-right shrink-0">
                          {Math.round(frac * maxCount)}
                        </span>
                        <div className="flex-1 border-t border-dashed border-gray-100" />
                      </div>
                    )
                  })}

                  {/* Bar columns */}
                  <div className="absolute left-8 right-0 bottom-6 top-0 flex items-end gap-0.5">
                    {daily.map((d, i) => {
                      const hasData = d.count > 0
                      const barH = hasData
                        ? Math.max(Math.round((d.count / maxCount) * CHART_H), 6)
                        : 2
                      return (
                        <div key={d.day} className="flex-1 relative flex flex-col justify-end" style={{ height: CHART_H }}>
                          {/* Tooltip */}
                          {hasData && (
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 group">
                            </div>
                          )}
                          {/* Bar */}
                          <div
                            title={hasData ? `${d.count} on ${fmtDay(d.day)}` : undefined}
                            className={`w-full rounded-t-sm transition-colors cursor-default ${
                              hasData ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-100'
                            }`}
                            style={{ height: barH }}
                          />
                          {/* X-axis label every 5 days */}
                          {tickIndices.has(i) && (
                            <span
                              className="absolute text-[9px] text-gray-400 whitespace-nowrap"
                              style={{ top: CHART_H + 4, left: '50%', transform: 'translateX(-50%)' }}
                            >
                              {fmtDay(d.day)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {totalInRange === 0 && (
              <p className="mt-2 text-center text-xs text-gray-400">
                No submissions in the last 30 days. Publish your form and share it to start collecting.
              </p>
            )}
          </>
        )}
      </div>

      {/* Global submission breakdown */}
      {analytics?.globalStats && Object.keys(analytics.globalStats).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">All-Form Submission Breakdown</h3>
          <div className="divide-y divide-gray-100">
            {Object.entries(analytics.globalStats).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-sm font-semibold text-gray-800">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
