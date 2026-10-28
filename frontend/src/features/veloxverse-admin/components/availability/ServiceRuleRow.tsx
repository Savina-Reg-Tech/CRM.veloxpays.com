import { Pencil } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { displayShort, kindLabel, type CountryNames } from '../../availability'
import type { AvailabilityItem } from '../../types'
import { formatWhen, MiniChip, RuleBadge } from './AvailabilityUI'

interface Props {
  item: AvailabilityItem
  parent: AvailabilityItem | null
  names: CountryNames
  onEdit: (key: string) => void
}

/**
 * One item. Below `lg` a stacked card with a full-width Edit button; from `lg` a grid row
 * (Name · Who can use it · Others see · Edit). Children are indented with a thin left line.
 */
export default function ServiceRuleRow({ item, parent, names, onEdit }: Props) {
  const { rule } = item
  const isChild = Boolean(parent)
  const parentOff = parent?.rule.mode === 'disabled'
  const open = () => onEdit(item.key)

  return (
    <div className={cn(isChild && 'ml-3 border-l-2 border-gray-200 pl-4 sm:ml-5')}>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open()
          }
        }}
        aria-label={`Edit rule for ${item.label}`}
        className={cn(
          'grid cursor-pointer gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-gray-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          'lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-center'
        )}
      >
        {/* Name */}
        <div className="min-w-0">
          <p className={cn('break-words text-sm text-gray-900', !isChild && 'font-semibold')}>{item.label}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            <span>{kindLabel(item.kind, parent?.label)}</span>
            <code className="truncate font-mono text-[11px] text-gray-400">{item.key}</code>
          </p>
        </div>

        {/* Who can use it */}
        <div className="min-w-0 space-y-1.5">
          <RuleBadge rule={rule} names={names} />
          <div className="flex flex-wrap gap-1">
            {parentOff && <MiniChip>Off because {parent!.label} is off</MiniChip>}
            {rule.mode !== 'all_countries' && rule.unknownCountryPolicy === 'block' && <MiniChip>Blocks unknown country</MiniChip>}
            {rule.mode !== 'all_countries' && rule.strictIpCheck && <MiniChip>Must live there and be there</MiniChip>}
            {rule.message && <MiniChip>Custom message</MiniChip>}
          </div>
        </div>

        {/* Others see + last change */}
        <div className="min-w-0 text-xs text-gray-500">
          {rule.mode !== 'all_countries' && (
            <p>
              <span className="lg:hidden">Others see: </span>
              {displayShort(rule.blockedDisplay)}
            </p>
          )}
          <p className="text-gray-400">Changed {formatWhen(rule.updatedAt, true)}</p>
        </div>

        {/* Action */}
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] w-full lg:min-h-0 lg:w-auto"
          onClick={(e) => {
            e.stopPropagation()
            open()
          }}
          aria-label={`Edit ${item.label}`}
        >
          <Pencil size={14} aria-hidden="true" />
          Edit
        </Button>
      </div>
    </div>
  )
}
