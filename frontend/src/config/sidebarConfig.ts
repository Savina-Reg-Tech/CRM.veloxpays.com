import {
  LayoutDashboard,
  Users,
  UserRound,
  Settings,
  UserCircle,
  ContactRound,
  ShieldCheck,
  FormInput,
  // VeloxVerse section
  BarChart3,
  Smartphone,
  Armchair,
  Car,
  Tag,
  DollarSign,
  ScrollText,
  Headphones,
  Star,
  Crown,
  Gift,
  MailCheck,
  CreditCard,
  Undo2,
  Scale,
  Activity,
} from 'lucide-react'
import type { NavItem, UserRole } from '@/types'

// Core CRM pages shared by super admins and admins.
const CRM_ITEMS: NavItem[] = [
  { label: 'Dashboard',    path: '/dashboard/admin',               icon: LayoutDashboard },
  { label: 'Users',        path: '/dashboard/employees',           icon: Users },
  { label: 'Customers',    path: '/dashboard/customers',           icon: ContactRound },
  { label: 'Verification', path: '/dashboard/verification-review', icon: ShieldCheck },
  { label: 'Form Builder', path: '/dashboard/forms',               icon: FormInput },
  { label: 'Settings',     path: '/dashboard/settings',            icon: Settings },
]

// VeloxVerse admin pages, grouped by section: services first, audit logs last.
const VV_ITEMS: NavItem[] = [
  // Services
  { label: 'eSIM Orders',     path: '/dashboard/veloxverse/esim-orders',     icon: Smartphone,  section: 'VeloxVerse services' },
  { label: 'Lounge',          path: '/dashboard/veloxverse/lounge',          icon: Armchair,    section: 'VeloxVerse services' },
  { label: 'Assist',          path: '/dashboard/veloxverse/transfers',       icon: Car,         section: 'VeloxVerse services' },
  { label: 'Pick & Drop Emails', path: '/dashboard/veloxverse/pickdrop/emails', icon: MailCheck,   section: 'VeloxVerse services', badge: 'pickdropEmails' },
  // Customers
  { label: 'App Users',       path: '/dashboard/veloxverse/users',           icon: UserRound,   section: 'Customers' },
  { label: 'Support',         path: '/dashboard/veloxverse/support',         icon: Headphones,  section: 'Customers' },
  // Rewards & marketing
  { label: 'Promo Codes',     path: '/dashboard/veloxverse/promo-codes',     icon: Tag,         section: 'Rewards' },
  { label: 'Points',          path: '/dashboard/veloxverse/points',          icon: Star,        section: 'Rewards' },
  { label: 'Refer & Earn',    path: '/dashboard/veloxverse/refer-earn',      icon: Gift,        section: 'Rewards' },
  { label: 'Club',            path: '/dashboard/veloxverse/club',            icon: Crown,       section: 'Rewards' },
  // Business
  { label: 'Analytics',       path: '/dashboard/veloxverse/analytics',       icon: BarChart3,   section: 'Business' },
  { label: 'Pricing',         path: '/dashboard/veloxverse/pricing',         icon: DollarSign,  section: 'Business' },
  { label: 'Payments',        path: '/dashboard/veloxverse/payments',        icon: CreditCard,  section: 'Business' },
  { label: 'Refunds',         path: '/dashboard/veloxverse/refunds',         icon: Undo2,       section: 'Business' },
  { label: 'Reconciliation',  path: '/dashboard/veloxverse/reconciliation',  icon: Scale,       section: 'Business' },
  // Monitoring
  { label: 'System health',   path: '/dashboard/veloxverse/system-health',   icon: Activity,    section: 'Monitoring' },
  // Always last
  { label: 'Audit Logs',      path: '/dashboard/veloxverse/audit-logs',      icon: ScrollText,  section: 'Audit' },
]

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  super_admin: [...CRM_ITEMS, ...VV_ITEMS],
  admin: [...CRM_ITEMS, ...VV_ITEMS],

  employee: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Users', path: '/dashboard/employees', icon: Users },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  agent: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  affiliate: [
    { label: 'Verification', path: '/dashboard/verification', icon: ShieldCheck },
    { label: 'Customers', path: '/dashboard/customers', icon: ContactRound },
    { label: 'My Profile', path: '/dashboard/me', icon: UserCircle },
  ],
  // Customer support: read-only, masked VeloxVerse audit log only (its own tabs cover
  // Stuck customers / Errors / Trends / Alerts — NavLink prefix-matching would otherwise
  // highlight two entries at once).
  support: [
    { label: 'Audit Logs', path: '/dashboard/veloxverse/audit-logs', icon: ScrollText, section: 'VeloxVerse' },
  ],
}
