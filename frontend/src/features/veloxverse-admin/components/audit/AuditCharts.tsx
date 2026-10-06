import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Hand-rolled SVG charts for the audit dashboards (no chart library in this repo). Categorical
// hues follow the validated reference palette in fixed order — a series keeps its slot by
// identity (e.g. supplier order from /meta), never by rank. Severity uses VeloxVerse's own
// severity colours and is always shown with its text label.
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

const W = 640
const H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 40 }

function niceMax(max: number): number {
  if (max <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const n = max / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export interface Series {
  key: string
  label: string
  colour: string
  values: number[]
}

function Legend({ series }: { series: Array<Pick<Series, 'key' | 'label' | 'colour'>> }) {
  if (series.length < 2) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // Positioned as a % of the chart width so it tracks the responsive SVG.
  const pct = (x / W) * 100
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-[8rem] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
      style={pct > 60 ? { right: `${100 - pct + 1}%` } : { left: `${pct + 1}%` }}
    >
      {children}
    </div>
  )
}

function Axes({ max, labels, unit }: { max: number; labels: string[]; unit: string }) {
  const innerH = H - PAD.top - PAD.bottom
  const innerW = W - PAD.left - PAD.right
  const ticks = [0, 0.5, 1]
  const every = Math.max(1, Math.ceil(labels.length / 8))
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0
  return (
    <>
      {ticks.map((t) => {
        const y = PAD.top + innerH - t * innerH
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#eef0f3" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6b7280">
              {Math.round(max * t).toLocaleString()}{unit}
            </text>
          </g>
        )
      })}
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={i} x={PAD.left + i * stepX} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
            {shortDay(l)}
          </text>
        ) : null
      )}
    </>
  )
}

/** Change over time, one y-axis, crosshair + tooltip on hover. */
export function LineChart({ days, series, unit = '' }: { days: string[]; series: Series[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!days.length) return <p className="py-10 text-center text-sm text-gray-400">No data for this period.</p>
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)))
  const stepX = days.length > 1 ? innerW / (days.length - 1) : 0
  const x = (i: number) => PAD.left + (days.length > 1 ? i * stepX : innerW / 2)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(', ')}>
          <Axes max={max} labels={days} unit={unit} />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#9ca3af" strokeDasharray="3 3" />}
          {series.map((s) => (
            <g key={s.key}>
              <polyline fill="none" stroke={s.colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
              {(days.length === 1 || hover !== null) &&
                s.values.map((v, i) =>
                  hover === i || days.length === 1 ? <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.colour} stroke="#fff" strokeWidth="2" /> : null
                )}
            </g>
          ))}
          {days.map((_, i) => (
            <rect
              key={i}
              x={x(i) - (stepX || innerW) / 2}
              y={PAD.top}
              width={stepX || innerW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && (
          <Tooltip x={x(hover)}>
            <p className="mb-1 font-semibold text-gray-900">{shortDay(days[hover])} (UTC)</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-gray-700">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.colour }} />{s.label}</span>
                <span className="font-medium tabular-nums">{(s.values[hover] ?? 0).toLocaleString()}{unit}</span>
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      <Legend series={series} />
    </div>
  )
}

/** Daily stacked bars (e.g. errors by severity), 2px surface gap between segments. */
export function StackedBars({ days, series }: { days: string[]; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!days.length) return <p className="py-10 text-center text-sm text-gray-400">No data for this period.</p>
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const totals = days.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0))
  const max = niceMax(Math.max(0, ...totals))
  const slot = innerW / days.length
  const barW = Math.max(2, Math.min(28, slot - 4))

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Stacked daily bars">
          {[0, 0.5, 1].map((t) => {
            const yy = PAD.top + innerH - t * innerH
            return (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={yy} y2={yy} stroke="#eef0f3" />
                <text x={PAD.left - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(max * t).toLocaleString()}</text>
              </g>
            )
          })}
          {days.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2
            let base = PAD.top + innerH
            return (
              <g key={d} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill={hover === i ? '#f5f6f8' : 'transparent'} />
                {series.map((s) => {
                  const v = s.values[i] ?? 0
                  if (!v) return null
                  const h = Math.max(1, (v / max) * innerH - 2)
                  base -= h + 2
                  return <rect key={s.key} x={cx - barW / 2} y={base + 2} width={barW} height={h} rx="2" fill={s.colour} />
                })}
                {(i % Math.max(1, Math.ceil(days.length / 8)) === 0 || i === days.length - 1) && (
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">{shortDay(d)}</text>
                )}
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <Tooltip x={PAD.left + slot * hover + slot / 2}>
            <p className="mb-1 font-semibold text-gray-900">{shortDay(days[hover])} (UTC) · {totals[hover].toLocaleString()}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-gray-700">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.colour }} />{s.label}</span>
                <span className="font-medium tabular-nums">{(s.values[hover] ?? 0).toLocaleString()}</span>
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      <Legend series={series} />
    </div>
  )
}

/** Ranked horizontal bars — a magnitude comparison; each row is clickable (opens filtered list). */
export function BarList({
  items,
  colour = CATEGORICAL[0],
  onSelect,
  empty = 'No data',
}: {
  items: Array<{ key: string; label: string; value: number; colour?: string }>
  colour?: string
  onSelect?: (key: string) => void
  empty?: string
}) {
  if (!items.length) return <p className="py-4 text-sm text-gray-400">{empty}</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const body = (
          <>
            <span className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-gray-700">{i.label}</span>
              <span className="font-semibold tabular-nums text-gray-900">{i.value.toLocaleString()}</span>
            </span>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-100">
              <span className="block h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.colour ?? colour }} />
            </span>
          </>
        )
        return (
          <li key={i.key}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(i.key)} title={`${i.label}: ${i.value} — open these events`} className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-gray-50">
                {body}
              </button>
            ) : (
              <div className="px-1.5 py-1">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Part-to-whole as one segmented bar with a labelled legend (clearer than a donut). */
export function SegmentBar({
  segments,
  onSelect,
}: {
  segments: Array<{ key: string; label: string; value: number; colour: string }>
  onSelect?: (key: string) => void
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (!total) return <p className="py-4 text-sm text-gray-400">No errors</p>
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        {segments.filter((s) => s.value > 0).map((s) => (
          <button
            key={s.key}
            type="button"
            title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
            onClick={() => onSelect?.(s.key)}
            className="h-full first:rounded-l-full last:rounded-r-full hover:opacity-80"
            style={{ width: `${(s.value / total) * 100}%`, background: s.colour }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {segments.map((s) => (
          <li key={s.key}>
            <button type="button" onClick={() => onSelect?.(s.key)} disabled={!s.value} className={cn('w-full rounded-lg border border-gray-100 px-2.5 py-1.5 text-left', s.value ? 'hover:border-indigo-200' : 'opacity-50')}>
              <span className="flex items-center gap-1.5 text-xs capitalize text-gray-600"><span className="h-2 w-2 rounded-full" style={{ background: s.colour }} />{s.label}</span>
              <span className="text-base font-bold tabular-nums text-gray-900">{s.value.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Conversion funnel: bar per step (journeys), % from checkout as a direct label. */
export function Funnel({ steps }: { steps: Array<{ step: string; label: string; journeys: number; events: number; conversion: number | null }> }) {
  if (!steps.length) return <p className="py-4 text-sm text-gray-400">No funnel data</p>
  const max = Math.max(...steps.map((s) => Math.max(s.journeys, s.events)), 1)
  return (
    <ol className="space-y-2">
      {steps.map((s) => {
        const value = s.step === 'search' ? s.events : s.journeys
        return (
          <li key={s.step}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-700">{s.label}</span>
              <span className="tabular-nums text-gray-900">
                <span className="font-semibold">{value.toLocaleString()}</span>
                <span className="text-gray-500">{s.step === 'search' ? ' searches' : ' journeys'}</span>
                {s.conversion !== null && <span className="ml-2 font-semibold text-indigo-700">{s.conversion}%</span>}
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: s.step === 'search' ? '#9ca3af' : CATEGORICAL[0] }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
