import type { LucideIcon } from 'lucide-react'
import type { VVAdminUser } from '@/features/veloxverse-admin/types'

// ── Auth ─────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'employee' | 'agent' | 'affiliate'

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'expired'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  account_status?: AccountStatus
  verification_deadline?: string | null
}

// Login response: backend sets the JWT as an httpOnly cookie and only
// returns the user profile in the body.
export interface AuthResponse {
  user: User
}

// ── Navigation ───────────────────────────────────────────────────
export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

// ── Employees ────────────────────────────────────────────────────
export interface Employee {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface CreateEmployeePayload {
  name: string
  email: string
  password: string
  role: UserRole
}

// ── Password reset (admin-initiated) ──────────────────────────────
export interface ResetPasswordResult {
  id: number
  name: string
  email: string
  role: UserRole
  /** Present only when the caller didn't supply a password — shown once. */
  generatedPassword?: string
}

// ── Services (master catalog) ────────────────────────────────────
export const SERVICE_CODES = [
  'FLIGHTS',
  'LOUNGE',
  'ASSIST',
  'ESIM',
  'EGIFT',
  'MTO',
] as const
export type ServiceCode = (typeof SERVICE_CODES)[number]

export interface ServiceCatalogItem {
  id: number
  code: ServiceCode
  name: string
  description: string | null
  vendor: string | null
  is_enabled: boolean
  created_at: string
}

// ── Customers (end-customer personal info) ───────────────────────
export const CUSTOMER_SOURCES = ['manual', 'veloxpays-sync'] as const
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number]

// Mirrors backend customerService.CUSTOMER_STATUSES — keep in sync.
export const CUSTOMER_STATUSES = [
  'active',
  'inactive',
  'pending',
  'verified',
  'suspended',
  'archived',
] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export interface CustomerServiceAssignment {
  id: number
  service_id: number
  code: ServiceCode
  name: string
  vendor: string | null
  status: string
  enabled_at: string
  source: CustomerSource
  notes: string | null
  created_at: string
  modified_at: string
}

export interface CustomerServiceAssignmentInput {
  code: ServiceCode
  status?: string
  source?: CustomerSource
  notes?: string | null
}

export interface Customer {
  id: number
  first_name: string
  middle_name: string | null
  last_name: string
  dob: string | null
  email: string
  phone: string | null
  address_line1: string | null
  city: string | null
  country: string | null
  status: string
  source: CustomerSource
  source_ref: string | null
  created_by: number | null
  created_at: string
  modified_at: string
  deleted_at: string | null
  added_by_name?: string | null
  added_by_email?: string | null
  added_by_role?: UserRole | null
  services: CustomerServiceAssignment[]
}

export interface CustomerPayload {
  first_name: string
  middle_name?: string | null
  last_name: string
  dob?: string | null
  email: string
  phone?: string | null
  address_line1?: string | null
  city?: string | null
  country?: string | null
  status: string
  source: CustomerSource
  source_ref?: string | null
  services?: CustomerServiceAssignmentInput[]
}

// ── Approvals (workflow) ───────────────────────────────────────────
// Mirrors backend approvalService.APPROVAL_KINDS / APPROVAL_STATUSES.
export const APPROVAL_KINDS = ['user_onboarding', 'generic', 'document_verification'] as const
export type ApprovalRequestKind = (typeof APPROVAL_KINDS)[number]

export const APPROVAL_STATUSES = [
  'pending',
  'in_review',
  'approved',
  'completed',
  'rejected',
  'cancelled',
] as const
export type ApprovalRequestStatus = (typeof APPROVAL_STATUSES)[number]

export const TERMINAL_APPROVAL_STATUSES: readonly ApprovalRequestStatus[] = [
  'completed',
  'rejected',
  'cancelled',
] as const

export function isTerminalApprovalStatus(status: ApprovalRequestStatus): boolean {
  return (TERMINAL_APPROVAL_STATUSES as readonly string[]).includes(status)
}

export interface ApprovalRequest {
  id: number
  kind: ApprovalRequestKind
  status: ApprovalRequestStatus
  title: string
  body: Record<string, unknown> | null
  requester_id: number
  subject_user_id: number | null
  assigned_to_id: number | null
  decided_by_id: number | null
  decision_note: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  subject_user_role?: UserRole | null
  subject_user_role_snapshot?: UserRole | null
  subject_user_current_role?: UserRole | null
  requester_name?: string | null
  requester_email?: string | null
}

export interface ApprovalAction {
  id: number
  request_id: number
  actor_id: number
  from_status: ApprovalRequestStatus | null
  to_status: ApprovalRequestStatus
  note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor_name: string
  actor_email: string
  actor_role: UserRole
}

export interface ApprovalRequestDetail extends ApprovalRequest {
  actions: ApprovalAction[]
}

export interface CreateApprovalRequestPayload {
  kind: ApprovalRequestKind
  title: string
  body?: Record<string, unknown> | null
  subject_user_id?: number | null
  assigned_to_id?: number | null
}

// ── Verification (KYC documents) ─────────────────────────────────
// Mirrors backend verificationService.DOCUMENT_STATUSES / VERIFICATION_STATUSES.
export const DOCUMENT_STATUSES = ['pending', 'in_review', 'approved', 'rejected'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const VERIFICATION_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'activated',
  'suspended',
  'expired',
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export interface VerificationDocument {
  id: number
  user_id: number
  doc_type: string
  approval_request_id: number
  file_name: string
  original_file_name: string
  storage_path: string
  file_url: string | null
  mime_type: string
  file_size: number
  uploaded_at: string
  archived_at: string | null
  custom_label: string | null
  status: DocumentStatus
  review_note: string | null
  reviewed_by: number | null
  reviewed_at: string | null
}

/** A row in the per-document progress table (includes "not_uploaded"). */
export interface VerificationDocRow {
  doc_type: string
  label: string
  required: boolean
  status: DocumentStatus | 'not_uploaded'
  review_note: string | null
  document_id: number | null
  custom_label?: string | null
}

export interface VerificationProgress {
  role: UserRole
  uploaded: number
  total_docs: number
  custom_count: number
  required_total: number
  required_approved: number
  documents_uploaded_label: string
  can_activate: boolean
  overall_status: VerificationStatus
  documents: VerificationDocRow[]
}

export interface VerificationSubject {
  id: number
  name: string
  email: string
  role: UserRole
  account_status: AccountStatus
  verification_deadline: string | null
  created_at: string
  docs_uploaded: number
  docs_approved: number
  required_total: number
  total_expected: number
  can_activate: boolean
  verification_status: VerificationStatus
}

export interface VerificationTimelineEntry {
  id: number
  request_id: number
  actor_id: number
  from_status: string | null
  to_status: string
  note: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  actor_role: string | null
  created_at: string
  actor_name: string
  actor_email: string
  doc_type: string
  document_id: number
  custom_label?: string | null
}

export interface VerificationDetail {
  user: {
    id: number
    name: string
    email: string
    role: UserRole
    account_status: AccountStatus
    verification_deadline: string | null
  }
  progress: VerificationProgress
  documents: VerificationDocument[]
  timeline: VerificationTimelineEntry[]
}

export interface VerificationMeta {
  document_statuses: DocumentStatus[]
  verification_statuses: VerificationStatus[]
  required_documents: { required: string[]; optional: string[] }
}

// ── Notifications ─────────────────────────────────────────────────
export interface AppNotification {
  id: number
  user_id: number
  event: string
  title: string
  body: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

// ── Velox eSIM platform (proxied via CRM backend) ─────────────────
export type VeloxEsimPlanType = 'country_specific' | 'regional'

export interface VeloxEsimPurchase {
  orderId: string | null
  orderNo: string | null
  planCode: string | null
  planName: string | null
  planType: VeloxEsimPlanType | string | null
  countryCode: string | null
  region: string | null
  amountPaid: number
  currency: string
  status: string | null
  purchasedAt: string | null
}

export interface VeloxEsimCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  country: string | null
  countryCode?: string | null
  isActive: boolean
  registeredAt: string | null
  totalOrders: number
  totalSpent: number
  lastPurchaseAt: string | null
  purchases: VeloxEsimPurchase[]
}

export interface VeloxEsimPagination {
  total: number
  page: number
  limit: number
  pages: number
}

export interface VeloxEsimCustomerList {
  customers: VeloxEsimCustomer[]
  pagination: VeloxEsimPagination
}

export interface VeloxEsimIntegrationHealth {
  configured: boolean
  reachable: boolean
  veloxApiUrl?: string
  message: string
}

// ── Unified customer table (multi-source) ────────────────────────
/** Identifies which connected service a customer row originates from.
 * Add new literal values here when integrating additional services. */
export type CustomerSourceId = 'crm' | 'velox-esim' | 'veloxverse'

/**
 * Discriminated union for the unified customer table.
 * The `_key` field is a globally unique row key (e.g. "crm-42", "esim-clx…").
 */
export type UnifiedCustomerRow =
  | { _source: 'crm'; _key: string; data: Customer }
  | { _source: 'velox-esim'; _key: string; data: VeloxEsimCustomer }
  | { _source: 'veloxverse'; _key: string; data: VVAdminUser }

// ── API responses ────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

/** Standard envelope for paginated list endpoints. */
export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Aggregate user counts used by the dashboard cards. */
export interface UserStats {
  total: number
  active: number
  inactive: number
}
