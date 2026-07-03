import { useAuthStore } from '@/store/authStore'
import { SIDEBAR_CONFIG } from '@/config/sidebarConfig'
import SidebarNavItem from './SidebarNavItem'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isDesktopCollapsed: boolean
  isMobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({
  isDesktopCollapsed,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { user } = useAuthStore()
  const navItems = SIDEBAR_CONFIG[user?.role ?? 'employee'] ?? []
  const shouldCollapse = isDesktopCollapsed && !isMobileOpen

  const roleLabel = user?.role?.replace(/_/g, ' ') ?? ''

  return (
    <>
      <div
        onClick={onMobileClose}
        className={cn(
          'fixed inset-0 bg-gray-900/50 z-30 md:hidden transition-opacity',
          isMobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        )}
      />

      <aside
        className={cn(
          'bg-white border-r border-gray-200 flex flex-col h-full z-40 transition-all duration-200',
          'fixed inset-y-0 left-0 md:relative md:translate-x-0',
          isDesktopCollapsed ? 'md:w-20' : 'md:w-64',
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'h-16 flex items-center border-b border-gray-200 shrink-0',
            shouldCollapse ? 'px-4 justify-center' : 'px-6'
          )}
        >
          {shouldCollapse ? (
            <div className=" h-20 w-10  flex items-center justify-center  shrink-0">
              <img
                src="/fav.svg"
                alt="Veloxverse icon"
                className="h-12 w-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-20 w-full  px-3 flex items-center ">
              <img
                src="/logo.png"
                alt="Veloxverse logo"
                className="h-12 w-full max-w-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav
          className={cn(
            'flex-1 py-4 px-3 space-y-0.5 overflow-y-auto',
            shouldCollapse && 'md:px-2'
          )}
        >
          {!shouldCollapse && (
            <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Menu
            </p>
          )}
          {(() => {
            let vvHeaderShown = false
            return navItems.map((item) => {
              const isVV = item.path.startsWith('/dashboard/veloxverse/')
              const showHeader = isVV && !vvHeaderShown
              if (showHeader) vvHeaderShown = true
              return (
                <div key={item.path}>
                  {showHeader && !shouldCollapse && (
                    <p className="px-3 mt-5 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      VeloxVerse
                    </p>
                  )}
                  {showHeader && shouldCollapse && (
                    <div className="my-3 mx-2 border-t border-gray-200" />
                  )}
                  <SidebarNavItem
                    item={item}
                    collapsed={shouldCollapse}
                    onClick={onMobileClose}
                  />
                </div>
              )
            })
          })()}
        </nav>

        {/* User profile at bottom */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <div
            className={cn(
              'flex items-center px-1',
              shouldCollapse ? 'justify-center' : 'gap-3'
            )}
          >
            <Avatar name={user?.name ?? ''} size="sm" />
            {!shouldCollapse && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-400 capitalize truncate">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
