// ═══════════════════════════════════════════════════════════════════
// VeloxVerse Admin Types
// Ported from VeloxVerse frontend/src/types/*.types.ts
// ═══════════════════════════════════════════════════════════════════

// ── Analytics ───────────────────────────────────────────────────────
// Overview/revenue/popular-packages/customer-spending are true platform-wide aggregates that can
// combine bookings made in several different real currencies, so — unlike a single order/visit's
// own currency — these are now FX-converted server-side into whichever `currency` the admin picks
// (see the currency selector on the Analytics page), not fixed to USD. `fxSkippedCurrencies` lists
// any native currency the FX provider couldn't convert for this request; its amount is excluded
// from the total rather than silently added in unconverted, so a request with skipped currencies
// under-reports slightly instead of mis-reporting.
export interface AnalyticsOverview {
  currency: string
  totalRevenue: number
  totalOrders: number
  activeUsers: number
  activeEsims: number
  esimRevenue: number
  esimOrders: number
  loungeRevenue: number
  loungeBookings: number
  benefitRevenue: number
  benefitBookings: number
  transferRevenue: number
  transferBookings: number
  fxSkippedCurrencies: string[]
}

export interface TimeSeriesPoint {
  date: string
  amount?: number
  count?: number
}

export interface RevenueSeries {
  period: string
  currency: string
  points: { date: string; amount: number }[]
  fxSkippedCurrencies: string[]
}

export interface GrowthSeries {
  period: string
  points: { date: string; count: number }[]
}

export interface PopularPackage {
  packageCode: string
  packageName: string
  count: number
  revenue: number
}

export interface PopularPackagesResult {
  currency: string
  packages: PopularPackage[]
  fxSkippedCurrencies: string[]
}

export type ActivityDirection = 'credit' | 'debit'
export type ActivityType = 'ESIM' | 'LOUNGE' | 'BENEFIT' | 'TRANSFER' | 'REFUND'

export interface RecentActivity {
  orderNo: string
  type: ActivityType
  description: string
  amountUsd: number
  /** Real currency `amountUsd` is charged/refunded in — "Usd" in that field's name is legacy,
   * not a guarantee; each row can be a different real currency. */
  currency: string
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
  totalSpend: number
  esimSpend: number
  loungeSpend: number
  benefitSpend: number
  travelSpend: number
  transferSpend: number
  orderCount: number
}

export interface CustomerSpendingResult {
  currency: string
  customers: CustomerSpending[]
  fxSkippedCurrencies: string[]
}

// Finding #397 (CRM dual-amount generalization) — the same "Original Price (native) / FX Rate /
// Customer Price (converted)" shape already used on the VeloxVerse Invoice Details view (#396),
// now shared by the CRM's eSIM and Lounge/Benefit admin detail views. Null on both when the
// booking's payment has no linked PriceQuote (pre-#392 booking, or fully covered by wallet/club
// redemption) — the plain single-currency fields elsewhere on the object are unaffected either way.
export interface AdminNativePrice {
  nativeAmountCents: number
  nativeCurrency: string
  convertedAmountCents: number
  paymentCurrency: string
  fxRate: number
  fxRateFetchedAt: string
  fxProvider: string
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
  /** The real currency cost/sellingPrice/profit are denominated in — despite the "Usd" field
   * suffix (kept for API back-compat), these are NOT always USD. Always read this field. */
  currency?: string
  /** True when cost couldn't be converted into `currency` (FX unavailable) and is shown in its
   * native USD instead — an approximation flag, not a currency mismatch. */
  costCurrencyFallback?: boolean
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
  costCurrencyFallback?: boolean
  paymentMethod: string
  totalVolume?: number
  /** Bytes used so far, straight from adminOrderService.buildAdminOrderDetail's `dataUsage` —
   * was already returned by the backend but not previously in this type or rendered anywhere. */
  dataUsage?: number
  /** 0-100, pre-computed server-side by buildAdminOrderDetail (null when no live provider profile
   * was available for this query, e.g. still provisioning). */
  dataUsagePercent?: number | null
  remainingVolumeGB?: number | null
  totalDuration?: number
  durationUnit?: string
  /** The customer device this eSIM was installed on, if any — matches an id in
   * VVAdminUserDetail.devices (fetched separately; the order endpoint only has the raw id). */
  deviceId?: string | null
  /** #397 — see AdminNativePrice's docblock. Detail-only (not on AdminOrderRow), matching the
   * existing Transfer CRM precedent of showing dual amounts only in the expanded/detail view. */
  nativePrice?: AdminNativePrice | null
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
  /** Real charged currency for `totalCost` — falls back to 'USD' for bookings from before this
   * was tracked. Never assume USD from the absence of a `$` sign upstream. */
  currency: string
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
  currency: string
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
  /** #397 — see AdminNativePrice's docblock. Covers Lounge, Dining, Fast Track and Fitness since
   * they all share this same visit detail endpoint. */
  nativePrice?: AdminNativePrice | null
  cancelledAt: string | null
  cancelledBy: string | null
  bookedAt: string | null
}

// ── Transfers (VeloxAssist Pick & Drop) ───────────────────────────────
export type TransferBookingStatus = 'PENDING' | 'CONFIRMED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'

// Matches VeloxVerse's transferService.listAll() → presentBooking(b) + { customer }. There is
// no separate "detail" endpoint for admin — this row already carries everything (route, driver,
// traveler counts, pricing) needed for a full detail view, so "View more" just expands this
// same object rather than making another request.
export interface AdminTransferBooking {
  id: string
  orderNo: string
  reservationNo?: string | null
  searchId?: string | null
  pickupType?: string
  pickupName?: string | null
  dropoffType?: string
  dropoffName?: string | null
  flightArrival?: string
  flightNumber?: string | null
  vehicleId?: string | null
  vehicleSegment?: string | null
  vehicleMake?: string | null
  vehicleModel?: string | null
  vehicleImage?: string | null
  maxPassengers?: number | null
  adults: number
  children: number
  infants: number
  suitcases: number
  smallBags: number
  basePriceCents: number | null
  salePriceCents: number | null
  currency: string
  /** The currency `basePriceCents` (the native ViaTovia vehicle cost) is actually denominated
   * in — NOT necessarily `currency`, which is the frozen payment currency `salePriceCents` was
   * charged in. Falls back to `currency` for bookings that predate this field. */
  nativeCurrency: string
  distanceKm?: number | null
  status: TransferBookingStatus
  cancellationReason?: string | null
  /** Populated once ViaTovia assigns a driver — typically after status reaches APPROVED. */
  driverName?: string | null
  driverPhone?: string | null
  driverVehiclePlate?: string | null
  /** Admin-only enrichment (transferService.listAll) — the linked Payment row's provider/status,
   * looked up separately since TransferBooking itself has no paymentMethod column (unlike
   * EsimOrder). null means no direct-charge Payment row was found for this booking (e.g. fully
   * covered by wallet credit or a club benefit redemption). */
  paymentMethod?: string | null
  paymentStatus?: string | null
  createdAt: string
  customer: { id: string; name: string; email: string } | null
}

export interface TransferCancelReason {
  id: number
  label: string
}

export interface TransferCancelResult extends AdminTransferBooking {
  refundedCents: number
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
  /** Matches `presentOrder()` in veloxverse's order.service.ts — `priceUsd` (major units,
   * "Usd" is legacy naming) paired with the order's real `currency`, NOT a `sellingPrice`
   * field (that name doesn't exist on the actual API response). */
  orders: { orderNo: string; packageName: string; status: string; priceUsd: number | null; currency: string }[]
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

/**
 * One row of the (service, currency) earning-rules matrix — `pointsPerUnit` is a direct,
 * admin-set points count per 1 unit of `currency` (e.g. LOUNGE+USD -> 5 pts per $1, LOUNGE+INR ->
 * a separately configured rate per ₹1), NOT a monetary rate converted via live FX, mirroring the
 * same design as `ReferralPointsConfigRow` below. REFERRAL never appears in this list — its
 * historical single-currency row is legacy/unused since Refer & Earn moved to
 * `ReferralPointsConfigRow` (filtered server-side).
 */
export interface PointsConfigRow {
  id: string
  serviceType: PointsServiceType
  currency: string
  pointsPerUnit: number
  isActive: boolean
  description: string | null
  version: number
  updatedBy?: string | null
  updatedAt: string
}

/**
 * Refer & Earn per-currency points config — the CRM-managed source of truth VeloxVerse's
 * `points-referral.service.ts#awardReferralPoints` reads at award time. One row per supported
 * preferred currency; `referrerPoints`/`refereePoints` are direct, admin-set point counts (not a
 * monetary amount converted via a live FX rate), so the reward's value can never drift day to day.
 */
export interface ReferralPointsConfigRow {
  id: string
  currency: string
  referrerPoints: number
  refereePoints: number
  isActive: boolean
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
  /** EFFECTIVE points-needed-to-redeem-1-unit for every supported currency, e.g.
   * `{ USD: 1000, INR: 12, GBP: 1270 }` — an explicit admin override from `redemptionRates` where
   * one is set, else a live-FX-derived value off `pointsPerDollarRedeem`. What real checkouts
   * actually use, and the right values to pre-fill an edit form with. */
  redemptionPreview?: Record<string, number>
  /** Currently-saved admin overrides only (may omit currencies never explicitly set — those fall
   * back to live FX in `redemptionPreview` above). Editable: PUT the same field back with new
   * values to set/change a currency's redemption rate directly. */
  redemptionRates?: Record<string, number>
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
  /** Real currency `purchasePriceCents` was charged in (club-admin.service.ts already returns
   * this per-row — falls back to 'USD' only for pre-currency-migration memberships). */
  currency: string
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
  currency: string
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

// ── Billing (admin, per-customer) ────────────────────────────────────
// Backed by a new VeloxVerse admin endpoint (routes/admin.billing.routes.ts) that reuses the
// exact same billingService the customer-facing "My Billing" page uses — just keyed by an
// admin-supplied userId instead of the logged-in user. One row per direct-charge Payment
// (debit) or succeeded PaymentRefund (credit), across every VeloxVerse service (eSIM, Lounge,
// VeloxClub, Pick & Drop, flights) — this is the authoritative source for "how much has this
// customer spent / been refunded", not a client-side sum of per-service list fields.
export interface AdminBillingLineItem {
  id: string
  date: string
  orderNo: string
  invoiceNo: string | null
  description: string
  service: string
  type: string
  amountUsd: number
  /** Real currency this line item was charged/refunded in — "Usd" in the field name above is
   * legacy naming from before multi-currency existed, not a guarantee the value is in USD. */
  currency: string
  direction: 'debit' | 'credit'
  paymentMethod: string | null
  status: string
}

export interface AdminBillingTotals {
  orderCount: number
  spentUsd: number
  topUpsUsd: number
  refundsUsd: number
  netUsd: number
}

export interface AdminBillingActivity {
  items: AdminBillingLineItem[]
  totals: AdminBillingTotals
}

// ── Settings ────────────────────────────────────────────────────────
export interface VVAdminSettings {
  esim: { configured: boolean; credentialsSource: string; apiUrl: string }
  // VeloxLounge — DragonPass ePass/resource API.
  dragonpass: { configured: boolean; apiUrl: string }
  // VeloxAssist Pick & Drop — ViaTovia transfer API.
  viatovia: { configured: boolean; apiUrl: string }
  // Card payments — Mint. No safe no-op endpoint upstream, so `configured` is the only signal;
  // there's no live-verified "connected" state the way eSIM/DragonPass/ViaTovia have.
  mint: { configured: boolean; apiUrl: string }
  email: { configured: boolean; provider: string; fromAddress: string }
}

export interface VVEsimApiTestResult {
  ok: boolean
  message: string
  balance?: number
}

/** Shared shape for the DragonPass / ViaTovia / Mint test-connection buttons. */
export interface VVApiTestResult {
  ok: boolean
  message: string
}
