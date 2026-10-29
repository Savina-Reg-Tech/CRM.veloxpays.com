import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types'
import { usePickdropBadge } from '@/features/veloxverse-admin/hooks/usePickdropEmails'
import { navTarget } from '@/features/onboarding/targets'

interface Props {
  item: NavItem
  collapsed?: boolean
  onClick?: () => void
}

/** Open Pick & Drop drafts + unmatched ViaTovia emails. Mounted only for roles that see the entry. */
function PickdropEmailsBadge({ collapsed }: { collapsed: boolean }) {
  const { total } = usePickdropBadge()
  if (!total) return null
  const text = total > 99 ? '99+' : String(total)
  return collapsed ? (
    <span
      className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
      aria-label={`${total} need action`}
    >
      {text}
    </span>
  ) : (
    <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white" aria-label={`${total} need action`}>
      {text}
    </span>
  )
}

export default function SidebarNavItem({ item, collapsed = false, onClick }: Props) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      data-tour={navTarget(item.path)}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-indigo-50 text-indigo-600 shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={cn(
              'shrink-0',
              isActive ? 'text-indigo-600' : 'text-gray-400'
            )}
          />
          {!collapsed && item.label}
          {item.badge === 'pickdropEmails' && <PickdropEmailsBadge collapsed={collapsed} />}
        </>
      )}
    </NavLink>
  )
}
