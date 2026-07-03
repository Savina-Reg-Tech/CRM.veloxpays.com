import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isMobileSidebarOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileSidebarOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMobileSidebarOpen])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        isDesktopCollapsed={isDesktopCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktopSidebar={() =>
            setIsDesktopCollapsed((collapsed) => !collapsed)
          }
          onToggleMobileSidebar={() =>
            setIsMobileSidebarOpen((open) => !open)
          }
        />

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
