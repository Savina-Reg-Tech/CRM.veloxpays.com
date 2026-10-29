import type { LucideIcon } from 'lucide-react'
import { Sparkles, Menu, PanelLeft, ShieldCheck, ClipboardList, Bell, BookOpen } from 'lucide-react'
import { canAccess } from '@/config/routeAccess'
import { SIDEBAR_CONFIG } from '@/config/sidebarConfig'
import type { UserRole } from '@/types'
import { navTarget } from './targets'

export interface TourStep {
  id: string
  /** `data-tour` id to spotlight; none = a centred card. */
  target?: string
  /** Only for roles that can open this page (canAccess). */
  page?: string
  icon: LucideIcon
  /** Sidebar group, shown above the step counter. */
  section?: string
  title: string
  body: string
}

/**
 * One line per sidebar page, used for that page's tour step. Every page in SIDEBAR_CONFIG needs
 * an entry (tourSteps test). Longer how-tos live in the Quick Guide (guideTopics.ts).
 */
export const NAV_TOUR_COPY: Record<string, string> = {
  '/dashboard/admin': 'Your home page: team numbers, VeloxVerse activity and top spenders at a glance.',
  '/dashboard/employees': 'Your team. Add staff, pick their role, reset a password or deactivate someone.',
  '/dashboard/customers': 'Customer records: search, add, view, edit or delete. VeloxVerse accounts open their App User page.',
  '/dashboard/verification-review': 'Review staff documents and activate their accounts once everything is approved.',
  '/dashboard/forms': 'Build lead-capture forms, embed them on a website, and read submissions and leads.',
  '/dashboard/settings': 'Check every provider connection (eSIM, DragonPass, VeloxAssist, Mint, email) and open email templates.',
  '/dashboard/veloxverse/esim-orders': 'Every eSIM order. Open one to suspend, cancel or refund it.',
  '/dashboard/veloxverse/lounge': 'Lounge, dining, fast track, fitness bookings and memberships.',
  '/dashboard/veloxverse/transfers': 'Pick & Drop rides (ViaTovia) and Meet & Greet requests. View, link or cancel a booking.',
  '/dashboard/veloxverse/pickdrop/emails': 'Turn ViaTovia emails into customer emails: review the draft, then send or discard. The red number is what needs action.',
  '/dashboard/veloxverse/users': 'VeloxVerse accounts and guests: spending, bookings, block, role and Country (current residency).',
  '/dashboard/veloxverse/support': 'Customer support tickets: find a case, reply and resolve.',
  '/dashboard/veloxverse/promo-codes': 'Create discount codes and see who used them.',
  '/dashboard/veloxverse/points': 'How customers earn and redeem points, and their balances.',
  '/dashboard/veloxverse/refer-earn': 'Referrals, top referrers and referral codes.',
  '/dashboard/veloxverse/club': 'VeloxClub: membership prices by country, members and Club promo codes.',
  '/dashboard/veloxverse/analytics': 'Revenue, growth and customer spending across all services.',
  '/dashboard/veloxverse/pricing': 'The prices customers see. New rules start as drafts until you publish them.',
  '/dashboard/veloxverse/payments': 'Every payment with full details, filters and CSV export.',
  '/dashboard/veloxverse/refunds': 'Every refund. "Failed" and "Stuck" show the ones that need attention.',
  '/dashboard/veloxverse/reconciliation': 'Our bookings compared with the supplier\'s: mismatches, missing bookings and margin.',
  '/dashboard/veloxverse/country-availability': 'Which services each country can use, with a preview and change history.',
  '/dashboard/veloxverse/system-health': 'Is VeloxVerse and every supplier working right now? Refreshes every minute.',
  '/dashboard/veloxverse/audit-logs': 'Start here for any complaint: search a support reference, email or order and follow what happened. Tabs cover API logs, stuck customers, errors, trends and alerts.',
  '/dashboard/verification': 'Upload your documents here. Until you are verified, this is the only page you can use.',
  '/dashboard/me': 'Your own dashboard and an overview of your work.',
}

const INTRO: TourStep[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to Velox CRM',
    body: 'A quick walk through every page you can use. Use Next (or the → key), skip at any time, and find the details again in the Quick Guide.',
  },
  {
    id: 'menu-button',
    target: 'menu-button',
    icon: Menu,
    title: 'Open the menu',
    body: 'Tap here to open the menu with every page you can use.',
  },
  {
    id: 'sidebar',
    target: 'sidebar',
    icon: PanelLeft,
    title: 'Your menu',
    body: 'Every page you can use is here, grouped by area. You only see the pages your role allows. Let\'s go through them.',
  },
]

const OUTRO: TourStep[] = [
  {
    id: 'verification-alerts',
    target: 'verification-alerts',
    icon: ShieldCheck,
    title: 'Pending verifications',
    body: 'How many staff documents are waiting for review. Click to open them.',
  },
  {
    id: 'approvals-button',
    target: 'approvals-button',
    icon: ClipboardList,
    title: 'Approvals',
    body: 'Operational requests waiting for sign-off. Click to open Approvals.',
  },
  {
    id: 'notifications',
    target: 'notifications',
    icon: Bell,
    title: 'Notifications',
    body: 'Updates for you land here. A number shows how many are unread.',
  },
  {
    id: 'user-menu',
    target: 'user-menu',
    icon: BookOpen,
    title: 'Quick Guide',
    body: 'Open your name here for the Quick Guide — short how-tos for every page, with search — or to replay this tour. Sign out lives here too.',
  },
]

/**
 * The steps `role` may see, in order: intro, one step per page in the role's sidebar, then the
 * header. Steps whose target isn't on screen (e.g. the sidebar on a phone, or header buttons the
 * role doesn't have) are dropped when the tour starts.
 */
export function tourStepsForRole(role: UserRole): TourStep[] {
  const pages: TourStep[] = (SIDEBAR_CONFIG[role] ?? []).map((item) => ({
    id: navTarget(item.path),
    target: navTarget(item.path),
    page: item.path,
    icon: item.icon,
    section: item.section,
    title: item.label,
    body: NAV_TOUR_COPY[item.path] ?? '',
  }))
  return [...INTRO, ...pages, ...OUTRO].filter((step) => !step.page || canAccess(role, step.page))
}
