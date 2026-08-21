// ═══════════════════════════════════════════════════════════════════
// VeloxVerse Admin Types
// Ported from VeloxVerse frontend/src/types/*.types.ts
// ═══════════════════════════════════════════════════════════════════

// ── Analytics ───────────────────────────────────────────────────────
export interface AnalyticsOverview {
  totalRevenueUsd: number
  totalOrders: number
  activeUsers: number
  activeEsims: number
  esimRevenueUsd: number
  esimOrders: number
  loungeRevenueUsd: number
  loungeBookings: number
  benefitRevenueUsd: number
  benefitBookings: number
  totalWalletTopUpsUsd: number
}

export interface TimeSeriesPoint {
  date: string
  amount?: number
  count?: number
}

export interface RevenueSeries {
  period: string
  points: { date: string; amount: number }[]
}

export interface GrowthSeries {
  period: string
  points: { date: string; count: number }[]
}

export interface PopularPackage {
  packageCode: string
  packageName: string
  count: number
  revenueUsd: number
}

export type ActivityDirection = 'credit' | 'debit'
export type ActivityType = 'ESIM' | 'LOUNGE' | 'BENEFIT' | 'TRANSFER' | 'REFUND'

export interface RecentActivity {
  orderNo: string
  type: ActivityType
  description: string
  amountUsd: number
  direction?: ActivityDirection
  status: string
  createdAt: string
  customer: { name: string; email: string } | null
}

export interface OrderStats {
  total: number
  byStatus: Record<string, number>
}

export interface CustomerSpending {
  userId: string
  name: string
  email: string
  totalSpendUsd: number
  esimSpendUsd: number
  loungeSpendUsd: number
  benefitSpendUsd: number
  travelSpendUsd: number
  orderCount: number
}

// ── eSIM Orders ─────────────────────────────────────────────────────
export interface VVPagination {
  page: number
  totalPages: number
  total: number
  limit: number
}

export interface AdminOrderRow {
  orderNo: string
  userId?: string
  packageCode?: string
  packageName?: string
  quantity: number
  status: string
  costUsd: number | null
  sellingPriceUsd: number | null
  profitUsd?: number | null
  iccid?: string
  esimStatus?: string
  smdpStatus?: string
  paymentMethod?: string
  invoiceNo?: string | null
  createdAt: string
}

// Matches VeloxVerse's adminOrderService.buildAdminOrderDetail (presentOrder() base +
// admin-only/live-provider fields). There is NO `customer` field on this object — only
// `userId` — so the CRM enriches the "Customer" card via a separate vvUsersService.get(userId)
// call rather than assuming the eSIM endpoint returns customer info.
export interface AdminOrderDetail {
  orderNo: string
  status: string
  packageCode?: string
  packageName?: string
  locationCode?: string
  quantity: number
  currency?: string
  userId?: string
  esimTranNo?: string
  providerOrderNo?: string
  invoiceNo?: string | null
  iccid: string
  imsi?: string
  eid?: string
  msisdn?: string
  activationCode?: string
  shortUrl?: string
  apn?: string
  pin?: string
  qrCodeUrl?: string
  smdpStatus?: string
  esimStatus?: string
  smsStatus?: string
  activatedAt?: string
  profileExpiresAt?: string
  costUsd: number | null
  sellingPriceUsd: number | null
  profitUsd?: number | null
  paymentMethod: string
  totalVolume?: number
  remainingVolumeGB?: number | null
  totalDuration?: number
  durationUnit?: string
  createdAt: string
  packages: { code: string | null; name: string | null; location: string | null; volume: number | null; duration: number | null }[]
}

// ── Lounge ───────────────────────────────────────────────────────────
export type LoungeVisitStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface LoungeVisit {
  id: string
  orderId?: string
  loungeName: string
  airportCode: string
  visitDate: string
  guestCount: number
  status: LoungeVisitStatus
  totalCost: number
  createdAt: string
}

export interface AdminLoungeMembership {
  id: string
  userId: string
  tier: string
  visitsRemaining: number
  status: string
  validTo: string
  createdAt: string
  user: { name: string; email: string }
}

export interface LoungeStats {
  totalRevenueCents: number
  activeMemberships: number
  upcomingVisits: number
  cancelledVisits: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface LoungeVisitDetail {
  id: string
  orderId?: string
  loungeName: string
  airportCode: string
  visitDate: string
  guestCount: number
  status: LoungeVisitStatus
  totalCost: number
  createdAt: string
  customer: { name: string; email: string } | null
  pricePerVisitCents: number | null
  pricePerGuestCents: number | null
  isRefundable: boolean
  surgeApplied: boolean
  refundableCents: number
  breakdown: {
    baseCents: number
    marginCents: number
    surgeCents: number
    promoDiscountCents: number
    refundFeeCents: number
    totalCents: number
    currency: string
  }
  cancelledAt: string | null
  cancelledBy: string | null
  bookedAt: string | null
}

// ── Transfers ───────────────────────────────────────────────────────
export type TransferBookingStatus = 'PENDING' | 'CONFIRMED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'

export interface AdminTransferBooking {
  orderNo: string
  reservationNo?: string
  customerName: string
  customerEmail: string
  pickupLocation: string
  dropoffLocation: string
  flightArrival?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleSegment?: string
  amountCents: number
  currency: string
  status: TransferBookingStatus
  createdAt: string
}

// ── Promo Codes ─────────────────────────────────────────────────────
export type PromoDiscountType = 'FIXED' | 'PERCENTAGE'

export interface PromoCode {
  id: string
  code: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseCents?: number
  maxDiscountCents?: number
  applicableServices: string[]
  maxUses?: number
  maxUsesPerUser?: number
  usageCount: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
}

export interface PromoCodeStats {
  usageCount: number
  uniqueUsers: number
  totalDiscountCents: number
}

export interface CreatePromoCodeInput {
  code: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseCents?: number
  maxDiscountCents?: number
  applicableServices: string[]
  maxUses?: number
  maxUsesPerUser?: number
  expiresAt?: string
}

// ── Pricing Rules ───────────────────────────────────────────────────
export type VVServiceType = 'ALL' | 'LOUNGE' | 'DINING' | 'FAST_TRACK' | 'FITNESS' | 'TRANSFER' | 'FLIGHT' | 'HOTEL' | 'CAR_RENTAL' | 'ESIM'
export type VVRuleType = 'PROFIT_MARGIN' | 'SURGE_PRICING' | 'REFUND_PROTECTION'
export type VVRuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface PricingRule {
  id: string
  serviceType: VVServiceType
  ruleType: VVRuleType
  config: Record<string, unknown>
  currency: string
  isActive: boolean
  priority: number
  status: VVRuleStatus
  effectiveFrom?: string
  effectiveTo?: string
  createdById?: string
  createdByEmail?: string
  updatedById?: string
  updatedByEmail?: string
  createdAt: string
  updatedAt: string
}

export interface PricingAuditEntry {
  id: string
  ruleId: string
  action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGE' | 'DELETED'
  oldConfig?: Record<string, unknown>
  newConfig?: Record<string, unknown>
  oldStatus?: string
  newStatus?: string
  changedById?: string
  changedByEmail?: string
  changeReason?: string
  createdAt: string
}

// ── Users ───────────────────────────────────────────────────────────
export type VVUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'GUEST'

export interface VVAdminUser {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  email: string
  role: VVUserRole
  isActive: boolean
  isVerified: boolean
  createdAt: string
  guestExpiresAt?: string | null
}

export interface VVAdminUsersPage {
  users: VVAdminUser[]
  pagination: VVPagination
}

export interface VVAdminUserDetail {
  user: VVAdminUser
  wallet: { balance: number; balanceCents: number; currency: string; lastUpdated: string }
  orders: { orderNo: string; packageName: string; status: string; sellingPrice: number }[]
  devices: { id: string; name: string; brand?: string; model?: string; deviceType: string; esimCompatible?: boolean }[]
}

// ── Support ─────────────────────────────────────────────────────────
export type VVSupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type VVSupportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type VVSupportCategory = 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'ESIM' | 'OTHER'

export interface VVSupportTicket {
  id: string
  caseId: string
  subject: string
  category: VVSupportCategory
  priority: VVSupportPriority
  status: VVSupportStatus
  userId: string
  customer: { name: string; email: string }
  messages: VVSupportMessage[]
  createdAt: string
  updatedAt: string
}

export interface VVSupportMessage {
  id: string
  ticketId: string
  senderId: string
  senderRole: 'USER' | 'ADMIN'
  message: string
  createdAt: string
}

export interface VVSupportStatistics {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
}

export interface VVAdminTicketFilters {
  status?: VVSupportStatus
  priority?: VVSupportPriority
  category?: VVSupportCategory
}

export interface VVAdminSearchResult {
  id: string
  caseId: string
  type: 'TICKET' | 'ESIM' | 'LOUNGE' | 'BENEFIT'
  subject: string
  status: string
}

// ── Points System ──────────────────────────────────────────────────

export type PointsTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT' | 'REFERRAL'
export type PointsServiceType = 'LOUNGE' | 'ESIM' | 'FLIGHT' | 'HOTEL' | 'TRANSFER' | 'INSURANCE' | 'MONEY_TRANSFER' | 'TUITION' | 'UTILITY' | 'REFERRAL'

export interface PointsConfigRow {
  id: string
  serviceType: PointsServiceType
  pointsPerDollar: number
  isActive: boolean
  description: string | null
  version: number
  updatedBy?: string | null
  updatedAt: string
}

export interface PointsSettings {
  id: string
  pointsPerDollarRedeem: number
  minRedeemPoints: number
  maxRedeemPerDayCents: number
  pointsExpiryDays: number
  version: number
  updatedAt: string
}

export interface PointsLedgerEntry {
  id: string
  amount: number
  type: PointsTransactionType
  serviceType: PointsServiceType | null
  referenceId: string | null
  description: string | null
  balanceAfter: number
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AdminPointsUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  role: string
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
}

export interface AdminPointsUsersPage {
  users: AdminPointsUser[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface AdminUserPoints {
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
  balance: { balance: number; lifetimeEarned: number; lifetimeRedeemed: number }
  history: PointsLedgerEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface PointsAuditEntry {
  id: string
  table: string
  recordId: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
  adminName: string
  adminEmail: string | null
  ipAddress: string | null
  createdAt: string
}

export interface PointsAuditPage {
  entries: PointsAuditEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface PointsDashboard {
  totals: {
    totalIssued: number
    totalRedeemed: number
    totalExpired: number
    outstandingPoints: number
    outstandingLiabilityCents: number
    outstandingLiability: number
  }
  redemptions: { count: number; averageValueCents: number; averageValue: number }
  adminAdjustments: { creditCount: number; debitCount: number; creditTotal: number; debitTotal: number }
  topUsers: Array<{ userId: string; name: string; email: string | null; lifetimeEarned: number; balance: number }>
  ledgerStats: { totalRows: number; oldestEntry: string | null }
}

// ── VeloxClub ──────────────────────────────────────────────────────

export type ClubMembershipStatus = 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED'
export type ClubPromoDiscountType = 'PERCENTAGE' | 'FIXED'

export interface ClubBenefitQuota {
  type: 'quota'
  visits?: number
  rides?: number
  discount_pct?: number
  family_included?: boolean
  max_family?: number
}

export interface ClubBenefitData {
  type: 'data_grant'
  gb: number
}

export interface ClubBenefitBoolean {
  type: 'boolean'
  enabled: boolean
}

export type ClubBenefitEntry = ClubBenefitQuota | ClubBenefitData | ClubBenefitBoolean

export interface ClubBenefits {
  lounge?: ClubBenefitQuota
  dining?: ClubBenefitQuota
  fast_track?: ClubBenefitQuota
  esim?: ClubBenefitData
  pick_drop?: ClubBenefitQuota
  meet_greet?: ClubBenefitQuota
  gym?: ClubBenefitBoolean
  support_level?: string
  dedicated_manager?: boolean
  credit_cashback_max_cents?: number
  bank_bonus_bdt?: number
  point_multiplier?: number
  [key: string]: unknown
}

export interface ClubTierRow {
  id: string
  slug: string
  name: string
  annualFeeCents: number
  sortOrder: number
  philosophy: string | null
  isPurchasable: boolean
  isActive: boolean
  color: string | null
  icon: string | null
  currentVersion: number | null
  benefits: ClubBenefits | null
  activeMembers: number
}

export interface ClubBenefitVersion {
  id: string
  version: number
  isCurrent: boolean
  benefits: ClubBenefits
  changeNote: string | null
  effectiveAt: string
  changedBy: { id: string; name: string; email: string } | null
}

export interface ClubMemberRow {
  id: string
  userId: string
  name: string
  email: string
  tier: string
  tierSlug: string
  status: ClubMembershipStatus
  purchasedAt: string
  billingCycleEnd: string
  invoiceNumber: string | null
  purchasePriceCents: number
  autoRenew: boolean
}

export interface ClubMembersPage {
  members: ClubMemberRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface ClubMemberUsage {
  benefitKey: string
  bookingId: string
  bookingType: string
  consumedAt: string
}

export interface ClubMembershipDetail {
  id: string
  tier: string
  tierSlug: string
  status: ClubMembershipStatus
  benefitVersion: number
  benefitsSnapshot: ClubBenefits | null
  billingCycleStart: string
  billingCycleEnd: string
  gracePeriodEnd: string | null
  purchasedAt: string
  purchasePriceCents: number
  paymentMethod: string
  paymentReferenceId: string
  invoiceNumber: string | null
  orderNo: string | null
  autoRenew: boolean
  loyaltyDiscountApplied: boolean
  usage: ClubMemberUsage[]
}

export interface ClubMemberDetail {
  user: { id: string; name: string; email: string } | null
  memberships: ClubMembershipDetail[]
}

export interface ClubPromoRow {
  id: string
  code: string
  discountType: ClubPromoDiscountType
  discountValue: number
  maxDiscountCents: number | null
  applicableTiers: string[]
  maxUses: number | null
  currentUses: number
  maxUsesPerUser: number
  firstPurchaseOnly: boolean
  isActive: boolean
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface ClubAnalytics {
  activeMembers: number
  byTier: Array<{ slug: string; name: string; count: number; revenueCents: number }>
  mrrCents: number
  mrr: number
  annualRunRateCents: number
  totalRevenueCents: number
  churnRate: number
  renewalSuccessRate: number
  avgLifetimeValueCents: number
  benefitUtilization: Array<{ benefitKey: string; count: number }>
  mostRedeemedBenefit: string | null
  promoUsage: Array<{ code: string; count: number }>
  upgrades: number
  totalMemberships: number
}

export interface ClubChangeLogEntry {
  id: string
  tier: string
  tierSlug: string
  version: number
  isCurrent: boolean
  changeNote: string | null
  effectiveAt: string
  changedBy: { name: string; email: string } | 'System (seed)'
  benefits: ClubBenefits
}

export interface ClubChangeLogPage {
  changes: ClubChangeLogEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ── Settings ────────────────────────────────────────────────────────
export interface VVAdminSettings {
  esim: { configured: boolean; credentialsSource: string; apiUrl: string }
  email: { configured: boolean; provider: string; fromAddress: string }
}

export interface VVEsimApiTestResult {
  ok: boolean
  message: string
  balance?: number
}
