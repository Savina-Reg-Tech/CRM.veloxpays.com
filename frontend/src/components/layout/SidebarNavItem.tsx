import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types'

interface Props {
  item: NavItem
  collapsed?: boolean
  onClick?: () => void
}

export default function SidebarNavItem({ item, collapsed = false, onClick }: Props) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
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
        </>
      )}
    </NavLink>
  )
}
