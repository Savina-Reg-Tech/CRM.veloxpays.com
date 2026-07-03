import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronDown, Bell, BellRing, ClipboardList, ShieldCheck, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/features/auth/authService'
import { canViewApprovalQueues } from '@/config/roles'
import { usePendingApprovalsCount } from '@/features/approvals/hooks/useApprovals'
import { usePendingVerificationCount } from '@/features/verification/hooks/useVerification'
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks/useNotifications'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface HeaderProps {
  isDesktopCollapsed: boolean
  onToggleDesktopSidebar: () => void
  onToggleMobileSidebar: () => void
}

export default function Header({
  isDesktopCollapsed,
  onToggleDesktopSidebar,
  onToggleMobileSidebar,
}: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const isModerator = canViewApprovalQueues(user?.role)
  const { data: pendingCount = 0 } = usePendingApprovalsCount(isModerator)
  const { data: pendingVerifCount = 0 } = usePendingVerificationCount(isModerator)
  const { data: unreadCount = 0 } = useUnreadCount(!!user)
  const { data: notifications = [] } = useNotifications(notifOpen)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await authService.logout()
    clearAuth()
    navigate('/login', { replace: true })
  }

  const bellLabel =
    isModerator && pendingCount > 0
      ? `${pendingCount} approval${pendingCount === 1 ? '' : 's'} need review`
      : 'Approvals'

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
      {/* Left: Greeting */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleDesktopSidebar}
          className="hidden md:inline-flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isDesktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <h1 className="text-sm font-semibold text-gray-900">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-xs text-gray-400 capitalize hidden sm:block">
          {user?.role?.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* In-app notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            title="Notifications"
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.read_at && markRead.mutate(n.id)}
                        className={cn(
                          'block w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                          !n.read_at && 'bg-indigo-50/40'
                        )}
                      >
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>}
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {isModerator && (
          <button
            type="button"
            onClick={() => navigate('/dashboard/verification-review?status=pending')}
            aria-label={
              pendingVerifCount > 0
                ? `${pendingVerifCount} verification${pendingVerifCount === 1 ? '' : 's'} pending`
                : 'Verification'
            }
            title={
              pendingVerifCount > 0
                ? `${pendingVerifCount} verification${pendingVerifCount === 1 ? '' : 's'} pending`
                : 'Verification'
            }
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ShieldCheck size={18} />
            {pendingVerifCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white leading-none">
                {pendingVerifCount > 99 ? '99+' : pendingVerifCount}
              </span>
            )}
          </button>
        )}

        {isModerator && (
          <button
            type="button"
            onClick={() => navigate('/dashboard/approvals')}
            aria-label={bellLabel}
            title={bellLabel}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ClipboardList size={18} />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white leading-none">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        )}

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Avatar name={user?.name ?? ''} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-700 leading-none">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-gray-400 transition-transform',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
