import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import { useBridgeStatusStore } from '@/store/bridgeStatusStore'

export default function AppLayout() {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  // Set when VeloxVerse refuses the CRM's connection — see store/bridgeStatusStore.ts.
  const bridgeRejected = useBridgeStatusStore((st) => st.rejectedMessage)

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
          {bridgeRejected && (
            <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">{bridgeRejected}</p>
              <p className="mt-0.5 text-red-700">
                VeloxVerse data (users, points, analytics, bookings) can&apos;t be loaded until this is fixed. Your
                CRM session is fine — there is no need to sign in again.
              </p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
