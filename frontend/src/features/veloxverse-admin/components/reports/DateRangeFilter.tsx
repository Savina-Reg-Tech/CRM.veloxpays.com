import { CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, isReversedRange, type RangePreset, type ReportRange } from '../../reportRange'

const controlClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors sm:text-sm'

/**
 * "Created" date filter for a VeloxVerse admin list: a preset (Today, Last 7 days, This month…) or
 * two custom day pickers. Turn the value into query params with `rangeParams`.
 */
export default function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: ReportRange
  onChange: (next: ReportRange) => void
  className?: string
}) {
  const reversed = isReversedRange(value)
  return (
    <div className={cn('flex w-full flex-wrap items-center gap-2 sm:w-auto', className)}>
      <div className="relative w-full sm:w-auto">
        <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <select
          aria-label="Date range"
          value={value.preset}
          onChange={(e) => onChange({ ...value, preset: e.target.value as RangePreset })}
          className={cn(controlClass, 'w-full pl-8 sm:w-auto')}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {value.preset === 'custom' && (
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <input
            type="date"
            aria-label="From date"
            value={value.customFrom ?? ''}
            max={value.customTo || undefined}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value || undefined })}
            className={cn(controlClass, 'min-w-0 flex-1 px-2 sm:w-40 sm:flex-none')}
          />
          <span aria-hidden="true" className="text-gray-400">
            –
          </span>
          <input
            type="date"
            aria-label="To date"
            value={value.customTo ?? ''}
            min={value.customFrom || undefined}
            onChange={(e) => onChange({ ...value, customTo: e.target.value || undefined })}
            className={cn(controlClass, 'min-w-0 flex-1 px-2 sm:w-40 sm:flex-none', reversed && 'border-red-300')}
          />
        </div>
      )}
      {reversed && <p className="w-full text-xs text-red-600">The end date is before the start date.</p>}
    </div>
  )
}
