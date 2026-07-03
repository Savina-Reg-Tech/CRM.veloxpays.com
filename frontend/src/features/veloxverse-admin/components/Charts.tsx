interface Point {
  label: string
  value: number
}

const WIDTH = 600
const HEIGHT = 200
const PAD = { top: 10, right: 10, bottom: 22, left: 36 }

function niceMax(max: number): number {
  if (max <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  return Math.ceil(max / pow) * pow
}

/** A lightweight SVG line chart (no external dependency). */
export function LineChart({ points, valuePrefix = '' }: { points: Point[]; valuePrefix?: string }) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">No data for this period.</p>
  }
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...points.map((p) => p.value)))
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = PAD.left + i * stepX
    const y = PAD.top + innerH - (p.value / max) * innerH
    return { x, y }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD.top + innerH} L ${coords[0].x.toFixed(1)} ${PAD.top + innerH} Z`
  const labelEvery = Math.ceil(points.length / 6)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full text-indigo-600" role="img">
      {/* gridlines + y labels */}
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + innerH - t * innerH
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} className="stroke-gray-200" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">
              {valuePrefix}
              {Math.round(max * t)}
            </text>
          </g>
        )
      })}
      <path d={area} className="fill-indigo-600/15" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={i} x={PAD.left + i * stepX} y={HEIGHT - 6} textAnchor="middle" className="fill-gray-400 text-[9px]">
            {p.label.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  )
}

/** A lightweight SVG bar chart (no external dependency). */
export function BarChart({ points, valuePrefix = '' }: { points: Point[]; valuePrefix?: string }) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">No data for this period.</p>
  }
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...points.map((p) => p.value)))
  const slot = innerW / points.length
  const barW = Math.max(2, slot * 0.6)
  const labelEvery = Math.ceil(points.length / 6)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img">
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + innerH - t * innerH
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} className="stroke-gray-200" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">
              {valuePrefix}
              {Math.round(max * t)}
            </text>
          </g>
        )
      })}
      {points.map((p, i) => {
        const h = (p.value / max) * innerH
        const x = PAD.left + i * slot + (slot - barW) / 2
        const y = PAD.top + innerH - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={2} className="fill-indigo-600/70" />
            {i % labelEvery === 0 && (
              <text x={PAD.left + i * slot + slot / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-gray-400 text-[9px]">
                {p.label.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
