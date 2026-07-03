import {
  LayoutDashboard,
  Users,
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
  Headphones,
  Globe,
  Star,
  Crown,
} from 'lucide-react'
import type { NavItem, UserRole } from '@/types'

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard',     path: '/dashboard/admin',               icon: LayoutDashboard },
    { label: 'Users',         path: '/dashboard/employees',           icon: Users },
    { label: 'Customers',     path: '/dashboard/customers',           icon: ContactRound },
    { label: 'Verification',  path: '/dashboard/verification-review', icon: ShieldCheck },
    { label: 'Form Builder',  path: '/dashboard/forms',               icon: FormInput },
    { label: 'Settings',      path: '/dashboard/settings',            icon: Settings },
    // ── VeloxVerse ──
    { label: 'VV Analytics',   path: '/dashboard/veloxverse/analytics',    icon: BarChart3 },
    { label: 'VV eSIM Orders', path: '/dashboard/veloxverse/esim-orders',  icon: Smartphone },
    { label: 'VV Lounge',      path: '/dashboard/veloxverse/lounge',       icon: Armchair },
    { label: 'VV Transfers',   path: '/dashboard/veloxverse/transfers',    icon: Car },
    { label: 'VV Promo Codes', path: '/dashboard/veloxverse/promo-codes',  icon: Tag },
    { label: 'VV Pricing',     path: '/dashboard/veloxverse/pricing',      icon: DollarSign },
    { label: 'VV Users',       path: '/dashboard/veloxverse/users',        icon: Users },
    { label: 'VV Support',     path: '/dashboard/veloxverse/support',      icon: Headphones },
    { label: 'VV Settings',    path: '/dashboard/veloxverse/settings',     icon: Globe },
    { label: 'VV Points',      path: '/dashboard/veloxverse/points',       icon: Star },
    { label: 'VV Club',        path: '/dashboard/veloxverse/club',         icon: Crown },
  ],

  admin: [
    { label: 'Dashboard',     path: '/dashboard/admin',               icon: LayoutDashboard },
    { label: 'Users',         path: '/dashboard/employees',           icon: Users },
    { label: 'Customers',     path: '/dashboard/customers',           icon: ContactRound },
    { label: 'Verification',  path: '/dashboard/verification-review', icon: ShieldCheck },
    { label: 'Form Builder',  path: '/dashboard/forms',               icon: FormInput },
    { label: 'Settings',      path: '/dashboard/settings',            icon: Settings },
    // ── VeloxVerse ──
    { label: 'VV Analytics',   path: '/dashboard/veloxverse/analytics',    icon: BarChart3 },
    { label: 'VV eSIM Orders', path: '/dashboard/veloxverse/esim-orders',  icon: Smartphone },
    { label: 'VV Lounge',      path: '/dashboard/veloxverse/lounge',       icon: Armchair },
    { label: 'VV Transfers',   path: '/dashboard/veloxverse/transfers',    icon: Car },
    { label: 'VV Promo Codes', path: '/dashboard/veloxverse/promo-codes',  icon: Tag },
    { label: 'VV Pricing',     path: '/dashboard/veloxverse/pricing',      icon: DollarSign },
    { label: 'VV Users',       path: '/dashboard/veloxverse/users',        icon: Users },
    { label: 'VV Support',     path: '/dashboard/veloxverse/support',      icon: Headphones },
    { label: 'VV Settings',    path: '/dashboard/veloxverse/settings',     icon: Globe },
    { label: 'VV Points',      path: '/dashboard/veloxverse/points',       icon: Star },
    { label: 'VV Club',        path: '/dashboard/veloxverse/club',         icon: Crown },
  ],

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
}
