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
export type LoungeVisitStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'pending_confirmation'

/** `lounge` = LNG- orders, `benefit` = BNF- orders (Dining / Fast Track / Fitness). */
export type LoungeBookingTypeFilter = 'lounge' | 'benefit' | 'all'
export type LoungeResourceType = 'FAST_TRACK' | 'DINING' | 'FITNESS'

/** VeloxVerse account behind a lounge/benefit booking (admin visits endpoints). */
export interface LoungeCustomer {
  id: string
  name: string | null
  email: string | null
  role: string | null
  isGuest: boolean
  isVerified: boolean
  isActive: boolean
  preferredCurrency: string | null
  registeredAt: string | null
}

export interface LoungeVoucher {
  code?: string | null
  voucherCode?: string | null
  /** e.g. QR / BARCODE / CODE — decides how the voucher is rendered. */
  voucherType?: string | null
  type?: string | null
  status?: string | number | null
  passengerName?: string | null
  name?: string | null
  url?: string | null
  [key: string]: unknown
}

export interface LoungeWalkinPass {
  ePassId: string | null
  /** Visits on the pass (one per person). */
  usages: number | null
  /** UTC ISO — display in the lounge's local time using `timeZone`. */
  validFrom: string | null
  validUntil: string | null
  timeZone: string | null
  scope: { resourceIds?: string[]; iata?: string[] } | null
  /** Set when the pass expired unused. */
  expiredAt: string | null
  /** 2 = used, 3 = reversed by lounge staff. */
  scans: { status: 2 | 3 | number; usageDate: string }[] | null
}

/**
 * One row of `GET /lounge/admin/visits` — everything the customer's "My Bookings" has plus
 * `customer`, `paymentStatus` and `dragonpassOrderIds`.
 */
export interface LoungeVisit {
  id: string
  orderId?: string | null
  loungeName: string | null
  loungeId?: string | null
  airportCode: string | null
  visitDate: string | null
  visitTime?: string | null
  status: LoungeVisitStatus
  /** Cents, in `currency`. */
  totalCost: number
  /** Real charged currency for `totalCost` — falls back to 'USD' for bookings from before this
   * was tracked. Never assume USD from the absence of a `$` sign upstream. */
  currency: string
  /** null = lounge. */
  resourceType?: LoungeResourceType | string | null
  bookingType?: 'WALK_IN' | 'PREBOOK' | null
  guestCount: number
  adults?: number | null
  children?: number | null
  infants?: number | null
  infantsFree?: boolean | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactCallingCode?: string | null
  flightNumber?: string | null
  isRefundable?: boolean
  cancellable?: boolean | null
  cancellationHoursBefore?: number | null
  cancellationPolicy?: string | null
  epassCode?: string | null
  qrCode?: string | null
  vouchers?: LoungeVoucher[] | null
  /** Lounge IANA zone — visit & cancellation times are lounge-local. */
  timeZone?: string | null
  walkinPass?: LoungeWalkinPass | null
  createdAt: string
  customer?: LoungeCustomer | null
  paymentStatus?: { status: string; amountCents: number; currency: string } | null
  dragonpassOrderIds?: string[]
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

export interface LoungePayment {
  id: string
  status: string
  provider: string | null
  /** Mint purchase reference. */
  providerReference: string | null
  invoiceNumber: string | null
  currency: string
  /** Charged to the card. */
  amountCents: number
  creditAppliedCents: number | null
  pointsAppliedCents: number | null
  pointsRedeemed: number | null
  clubDiscountCents: number | null
  promoDiscountCents: number | null
  promoCode: string | null
  card: {
    brand: string | null
    /** Masked, e.g. 424242******4242 */
    number: string | null
    holderName: string | null
    country: string | null
    funding: string | null
  } | null
  chargeAttemptedAt: string | null
  chargeResponse: { code: string | number | null; message: string | null } | null
  refund: {
    amount: number | null
    currency: string | null
    status: string | null
    reference: string | null
    at: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export interface LoungeDragonpass {
  orderIds: string[]
  reference: string | null
  epassId: string | null
  epassIds: string[] | null
  epassCode: string | null
  epassIssued: boolean | null
  epassLocal: boolean | null
  /** true = time-slot prebooking, false = walk-in / ePass only. */
  prebooked: boolean
  lastStatus: string | number | null
  lastStatusChangedDates: unknown
  lastWalkinStatus: string | number | null
  location: unknown
  vouchers: LoungeVoucher[] | null
  fitnessVouchers: unknown
}

export interface LoungeVisitDetail extends LoungeVisit {
  customer: LoungeCustomer | null
  /** null for old wallet bookings — then see `walletTransactionId`. */
  payment: LoungePayment | null
  walletTransactionId: string | null
  paymentMethod: string | null
  dragonpass: LoungeDragonpass | null
  walkinPass: LoungeWalkinPass | null
  timeZone: string | null
  club: { applied: boolean; benefitKey: string | null; claimId: string | null } | null
  dining: {
    cuisineType: string | null
    offerType: string | null
    offerLabel: string | null
    setMealItems: unknown
    couponValue: number | string | null
    couponValueCents: number | null
    couponCurrency: string | null
    discount: number | string | null
  } | null
  emails: { confirmationSentAt: string | null; pendingConfirmationEmail: unknown } | null
  /** INTERNAL — never show to customers. */
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
  pricePerVisitCents: number | null
  pricePerGuestCents: number | null
  refundableCents: number
  surgeApplied: boolean
  cancelledAt: string | null
  cancelledBy: string | null
  bookedAt: string | null
  passengers: { name: string; type: string }[] | null
  /** Full stored booking record for support (DragonPass tokens removed). */
  metadata: Record<string, unknown> | null
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

/** Per-currency overrides of a promo's money fields, in cents OF THAT CURRENCY. A missing value
 * means the backend converts the USD base amount at the live FX rate. */
export interface PromoCurrencyAmount {
  minPurchaseCents?: number | null
  /** FIXED codes — the discount itself. */
  discountCents?: number | null
  /** PERCENTAGE codes — the cap on the discount. */
  maxDiscountCents?: number | null
}

export interface PromoCode {
  id: string
  code: string
  description?: string | null
  discountType: PromoDiscountType
  /** FIXED: USD cents. PERCENTAGE: basis points (20% = 2000). */
  discountValue: number
  /** USD cents — the base for any currency without its own override. */
  minPurchaseCents?: number
  maxDiscountCents?: number | null
  applicableServices: string[]
  currencyAmounts?: Record<string, PromoCurrencyAmount>
  maxUses?: number | null
  maxUsesPerUser?: number | null
  /** What the VeloxVerse backend returns (`promo_codes.current_uses`). */
  currentUses?: number
  /** @deprecated legacy name — the backend returns `currentUses`. */
  usageCount?: number
  isActive: boolean
  startsAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt?: string
}

/** Services a promo usage can belong to. WALLET = the old "redeem to wallet credit" flow (USD). */
export type PromoUsageService = 'LOUNGE' | 'BENEFIT' | 'ESIM' | 'TRANSFER' | 'CLUB' | 'FLIGHT' | 'WALLET'
export type PromoUsageStatus = 'USED' | 'REFUNDED' | 'PROCESSING' | 'FAILED'

/** Per-currency usage totals — every amount is cents OF `currency`; never summed across currencies. */
export interface PromoCurrencyStats {
  currency: string
  uses: number
  discountCents: number
  /** Gross order value before the promo. */
  orderValueCents: number
  /** What customers actually paid (card + credit). */
  chargedCents: number
}

/** `GET /admin/promo-codes/:id/stats`. Only completed orders + wallet redemptions count as uses. */
export interface PromoCodeStats {
  code: string
  totals: { uses: number; uniqueUsers: number; refunded: number }
  /** Sorted by uses, most-used first. */
  byCurrency: PromoCurrencyStats[]
  byService: Array<{ service: PromoUsageService; uses: number }>
  /** Approximate FX conversion of all discounts to USD — display only, labelled "≈". */
  approxUsd: { discountCents: number; skippedCurrencies: string[] } | null
  firstUsedAt: string | null
  lastUsedAt: string | null
}

export interface PromoUsageRow {
  /** Payment id (or usage id for wallet redemptions). */
  id: string
  usedAt: string
  customer: { id: string; name: string | null; email: string }
  service: PromoUsageService
  serviceLabel: string
  description: string
  invoiceNumber: string | null
  paymentId: string | null
  /** The currency the customer paid in — every amount on the row is in it. */
  currency: string
  orderValueCents: number
  discountCents: number
  chargedCents: number
  creditAppliedCents: number
  pointsAppliedCents: number
  status: PromoUsageStatus
  refund: { amountCents: number; currency: string; refundedAt: string } | null
}

export interface PromoUsagesPage {
  code: string
  usages: PromoUsageRow[]
  pagination: VVPagination
}

export interface PromoUsageFilters {
  page?: number
  limit?: number
  currency?: string
  service?: PromoUsageService
  status?: 'used' | 'refunded' | 'all'
  from?: string
  to?: string
  search?: string
}

export interface CreatePromoCodeInput {
  code: string
  description?: string | null
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseCents?: number
  maxDiscountCents?: number | null
  applicableServices: string[]
  currencyAmounts?: Record<string, PromoCurrencyAmount>
  maxUses?: number | null
  maxUsesPerUser?: number | null
  isActive?: boolean
  expiresAt?: string | null
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
  /** A built-in `PointsServiceType`, or a service key an admin created (e.g. `CAR_RENTAL`). */
  serviceType: string
  currency: string
  /** May be fractional (up to 4 dp), e.g. 0.1 pts per ₹1. */
  pointsPerUnit: number
  /** Computed by VeloxVerse: pointsPerUnit ÷ pointsPerUnitRedeem[currency] × 100, before the club
   * multiplier. null when the currency has no redemption rate (redemption off). */
  percentBack: number | null
  /** False = rates are set but no booking flow awards points for this service yet. */
  earningConnected?: boolean
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
export interface CreatePointsServiceInput {
  /** UPPER_SNAKE_CASE key, e.g. `CAR_RENTAL`. */
  serviceType: string
  /** Points per USD 1; other currencies are scaled to the same % back by VeloxVerse. */
  usdPointsPerUnit: number
  description?: string | null
  /** Active rows are shown to customers in "how you earn". */
  isActive?: boolean
}

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

/** `GET /admin/points/settings/suggested-rates` — a one-off suggestion (USD rate ÷ today's FX
 * rate), never saved until an admin reviews and saves it. */
export interface RedemptionRateSuggestions {
  usdRate: number
  suggestions: Array<{
    currency: string
    current: number | null
    /** null when today's exchange rate couldn't be fetched for this currency. */
    suggested: number | null
    /** Units of `currency` per 1 USD. */
    fxRate: number | null
    fxRateFetchedAt: string | null
  }>
}

export interface PointsSettings {
  id: string
  /** Fixed "points needed to redeem 1 unit" per supported currency — no live FX anywhere.
   * null = redemption is switched off for customers paying in that currency. */
  pointsPerUnitRedeem: Record<string, number | null>
  minRedeemPoints: number
  /** USD cents, 0 = no cap. Valued at the fixed USD redemption rate. */
  maxRedeemPerDayCents: number
  /** 0 = never. */
  pointsExpiryDays: number
  version: number
  updatedAt: string
  /** @deprecated alias of `pointsPerUnitRedeem.USD` — do not build on it. */
  pointsPerDollarRedeem?: number
  /** @deprecated raw saved map — use `pointsPerUnitRedeem`. */
  redemptionRates?: Record<string, number>
  /** @deprecated alias of `pointsPerUnitRedeem`. */
  redemptionPreview?: Record<string, number | null>
}

export interface PointsSettingsUpdate {
  /** Partial map OK — only listed currencies change. Integers ≥ 1. */
  pointsPerUnitRedeem?: Record<string, number>
  minRedeemPoints?: number
  maxRedeemPerDayCents?: number
  pointsExpiryDays?: number
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
  /** How much of the benefit this claim used: GB for `esim` (the metered data grant), 1 for
   * every other benefit. Pre-release eSIM claims were backfilled with the member's full grant. */
  units: number
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
  /** How much of this line item was covered by redeeming a VeloxClub membership benefit
   * (0/undefined for line items that weren't a club redemption, and for all refund/credit
   * line items). When `clubRedeemed` is true, the UI should show a "VeloxClub redeemed" label
   * instead of a bare (possibly zero) amount — see billing.service.ts#paymentLineItem. */
  clubDiscountCents?: number
  clubRedeemed?: boolean
  /** Promo code applied at checkout (e.g. WELCOME20) and the discount it gave, in this line's
   * `currency` cents — 0/undefined when no promo was used. See billing.service.ts#paymentLineItem. */
  promoDiscountCents?: number
  promoCode?: string | null
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

// ── Refer & Earn (admin report) ─────────────────────────────────────
// Rewards are POINTS. Each side of a referral is priced in its OWN currency (an INR referrer and
// an AUD referee each get their own currency's configured points) — never combine sides into one
// money figure. `value` is those points at the fixed redemption rate of that same currency, or
// null when redemption is switched off for it.

export type ReferralSide = 'REFERRER' | 'REFEREE'
export type ReferralUsageStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'REVOKED'
/** `PENDING` again after a reward was reversed shows as `REVERSED`. */
export type ReferralDisplayStatus = 'PENDING' | 'REWARDED' | 'REVERSED' | 'REVOKED' | 'EXPIRED'

export interface PointsValue {
  cents: number
  currency: string
}

export interface ReferralPerson {
  id: string
  name: string | null
  email: string
  isActive: boolean
}

export interface ReferralParty extends ReferralPerson {
  currency: string
  pointsInForce: number
  value: PointsValue | null
}

export interface ReferralRow {
  id: string
  createdAt: string
  completedAt: string | null
  lastActivityAt: string
  code: string | null
  status: ReferralUsageStatus
  displayStatus: ReferralDisplayStatus
  reversalCount: number
  referrer: ReferralParty
  referee: ReferralParty
}

export interface ReferralsPage {
  referrals: ReferralRow[]
  pagination: VVPagination
}

export interface ReferralListFilters {
  page?: number
  limit?: number
  status?: 'pending' | 'rewarded' | 'reversed' | 'revoked' | 'expired'
  currency?: string
  search?: string
  from?: string
  to?: string
}

export interface ReferralCurrencyStats {
  currency: string
  referrerPointsAwarded: number
  refereePointsAwarded: number
  pointsReversed: number
  pointsInForce: number
  /** Award events (each side of each reward counts once). */
  rewards: number
  value: PointsValue | null
}

export interface ReferralOverview {
  days: number
  since: string
  totals: {
    referrals: number
    pending: number
    rewarded: number
    reversed: number
    revoked: number
    expired: number
    uniqueReferrers: number
    reversals: number
    /** 0–1 — rewarded ÷ referrals. */
    conversionRate: number
    codes: { total: number; active: number }
  }
  byCurrency: ReferralCurrencyStats[]
  topReferrers: Array<{
    referrer: ReferralPerson
    currency: string
    referrals: number
    rewarded: number
    pending: number
    pointsInForce: number
    value: PointsValue | null
  }>
  trend: Array<{ date: string; referrals: number; rewarded: number; reversed: number }>
  /** Points needed to redeem 1 unit, per currency (only currencies with redemption on). */
  redemptionRates: Record<string, number>
}

export interface ReferralTimelineEvent {
  id: string
  type: 'CODE_APPLIED' | 'AWARD' | 'REVERSAL'
  at: string
  side: ReferralSide
  points: number
  currency: string
  value: PointsValue | null
  reason: string | null
  bookingRef: string | null
}

export interface ReferralDetail {
  referral: ReferralRow
  code: {
    id: string
    code: string
    isActive: boolean
    maxUses: number | null
    currentUses: number
    expiresAt: string | null
  } | null
  timeline: ReferralTimelineEvent[]
  bookings: Array<{
    reference: string
    paymentId: string | null
    invoiceNumber: string | null
    description: string | null
    status: string | null
    /** In the currency the referee actually paid. */
    amount: PointsValue | null
    createdAt: string | null
  }>
}

export interface AdminReferralCode {
  id: string
  code: string
  owner: ReferralPerson & { currency: string }
  isActive: boolean
  expired: boolean
  maxUses: number | null
  currentUses: number
  expiresAt: string | null
  createdAt: string
  referrals: number
  rewarded: number
  pending: number
}

export interface ReferralCodesPage {
  codes: AdminReferralCode[]
  pagination: VVPagination
}

export interface ReferralCodeFilters {
  page?: number
  limit?: number
  status?: 'active' | 'inactive' | 'expired'
  search?: string
}

export interface ReferralCodePatch {
  isActive?: boolean
  maxUses?: number | null
  expiresAt?: string | null
}
