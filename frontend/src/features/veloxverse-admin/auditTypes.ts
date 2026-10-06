// ── VeloxVerse customer-journey audit log (GET/PUT /admin/audit/*) ──────────
// Shapes captured from the live VeloxVerse API — see the handoff
// "Velox-CRM — Customer Journey Audit Logs" §5. Every field may be null on the
// wire unless typed otherwise; render "—" for nulls.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type EventStatus = 'success' | 'failure' | 'warning' | 'info'
export type EventSource = 'backend' | 'frontend' | 'webhook' | 'job' | 'admin'
export type EventActor = 'customer' | 'guest' | 'admin' | 'support' | 'system'

/** Masked by VeloxVerse for support viewers (`j***@e***.com`, `J. D.`). */
export interface AuditCustomer {
  id: string
  email: string | null
  name: string | null
  role: string | null
}

export interface AuditEvent {
  id: string
  createdAt: string
  service: string
  eventType: string
  step: string
  status: EventStatus
  severity: Severity
  source: EventSource
  actor: EventActor
  supplier: string | null
  userId: string | null
  anonId: string | null
  sessionId: string | null
  journeyId: string | null
  requestId: string | null
  supplierCallId: string | null
  parentEventId: string | null
  httpMethod: string | null
  route: string | null
  httpStatus: number | null
  referenceType: string | null
  referenceId: string | null
  errorCode: string | null
  errorMessage: string | null
  errorDetails: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  durationMs: number | null
  isSensitiveMasked: boolean
  ip: string | null
  userAgent: string | null
  platform: string | null
  appVersion: string | null
  customer: AuditCustomer | null
}

export interface AuditCritical {
  count: number
  latest: AuditEvent[]
}

export interface AuditEventPage {
  events: AuditEvent[]
  nextCursor: string | null
  /** Only filled on the first page (no cursor) — keep page 1's value while paging. */
  critical: AuditCritical
}

export interface AuditTimelinePage extends AuditEventPage {
  /** null for the guest timeline. */
  customer: AuditCustomer | null
}

export interface AuditDragonpassLog {
  id: string
  method: string
  endpoint: string
  responseStatus: number | null
  success: boolean
  durationMs: number | null
  errorMessage: string | null
  createdAt: string
}

export interface AuditPaymentSummary {
  id: string
  status: string
  resourceType: string
  resourceId: string
  /** Cents; sometimes a string on the wire — always Number() it. */
  amountCents: number | string
  currency: string
  provider: string
  createdAt: string
  updatedAt: string
}

export interface AuditEventDetail {
  event: AuditEvent
  parent: AuditEvent | null
  children: AuditEvent[]
  sameRequestEvents: number
  dragonpassApiLog: AuditDragonpassLog | null
  payment: AuditPaymentSummary | null
}

export interface AuditTrace {
  requestId: string
  customer: AuditCustomer | null
  anonId: string | null
  journeyId: string | null
  route: string | null
  references: Array<{ type: string | null; id: string | null }>
  supplierCalls: AuditEvent[]
  errors: AuditEvent[]
  events: AuditEvent[]
}

export type JourneyOutcome =
  | 'booked'
  | 'booked_then_cancelled'
  | 'paid_not_booked'
  | 'payment_declined'
  | 'payment_in_progress'
  | 'checkout_not_paid'
  | 'browsing'

export interface AuditJourney {
  journeyId: string
  customer: AuditCustomer | null
  services: string[]
  outcome: JourneyOutcome
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  errors: number
  payments: string[]
  events: AuditEvent[]
}

export interface AuditBookingTrail {
  referenceType: string
  referenceId: string
  journeys: string[]
  events: AuditEvent[]
}

export interface AuditStuckRule {
  key: string
  description: string
  thresholdMinutes: number
  severity: Severity
}

export interface AuditStuckItem {
  rule: string
  severity: Severity
  description: string
  userId: string | null
  journeyId: string | null
  service: string
  referenceType: string
  referenceId: string
  since: string
  minutesStuck: number
  details: Record<string, unknown>
  customer: AuditCustomer | null
}

export interface AuditMeta {
  retentionDays: number
  summaryRetentionDays: number
  services: string[]
  eventTypes: string[]
  suppliers: string[]
  steps: string[]
  alertTypes: string[]
  severities: Array<{ value: Severity; colour: string }>
  stuckRules: AuditStuckRule[]
}

export interface AuditErrorsSummary {
  from: string
  to: string
  total: number
  bySeverity: Partial<Record<Severity, number>>
  /** "none" = errors without an HTTP status. */
  byHttpStatusClass: Record<string, number>
  /** "none" = errors without a supplier. */
  bySupplier: Record<string, number>
  byService: Record<string, number>
  topErrors: Array<{ errorCode: string | null; message: string | null; count: number }>
}

export interface AuditFunnelStep {
  step: string
  events: number
  journeys: number
  /** Percent (one decimal) relative to checkout_started; null for `search`. */
  conversionFromCheckout: number | null
}

export interface AuditFunnel {
  from: string
  to: string
  service: string | null
  steps: AuditFunnelStep[]
}

export interface AuditDailySummary {
  id: string
  /** UTC day, YYYY-MM-DD. */
  date: string
  service: string
  totalEvents: number
  uniqueCustomers: number
  uniqueGuests: number
  journeysStarted: number
  journeysCompleted: number
  totalErrors: number
  bookingFailures: number
  stuckJourneys: number
  downtimeIncidents: number
  downtimeMinutes: number
  alertsSent: number
  errorsBySeverity: Partial<Record<Severity, number>>
  /** Mixes exact codes ("401") and classes ("4xx") — split by key pattern. */
  errorsByHttpStatus: Record<string, number>
  errorsBySupplier: Record<string, number>
  supplierLatency: Record<string, { avgMs: number; p95Ms: number; calls: number }>
  paymentFailures: { declines: number; byDeclineCode: Record<string, number>; paidNotBooked: number; refundFailures: number }
  /** `{}` on back-filled days. */
  stuckByRule: Record<string, number>
  topErrors: Array<{ errorCode: string | null; message: string | null; count: number }>
  topFailingRoutes: Array<{ route: string; httpStatus: number | null; count: number }>
  frontendErrors: { byStep: Record<string, number>; networkErrors: number }
  funnel: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface AuditAlert {
  id: string
  alertKey: string
  type: string
  severity: Severity
  service: string | null
  supplier: string | null
  errorCode: string | null
  /** Empty = nobody was emailed. */
  recipients: string[]
  subject: string
  firstSeenAt: string
  lastSeenAt: string
  lastSentAt: string | null
  occurrenceCount: number
  /** null = still open. */
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditAlertsPage {
  openCount: number
  alerts: AuditAlert[]
}

export interface AuditThresholds {
  spikeCount: number
  spikeWindowMinutes: number
  errorRatePercent: number
  errorRateWindowMinutes: number
  supplierConsecutiveFailures: number
  supplierFailureRatePercent: number
  supplierWindowMinutes: number
  paymentDeclineRatePercent: number
  paymentWindowMinutes: number
  cooldownMinutes: number
}

export interface AuditSettings {
  retentionDays: number
  summaryRetentionDays: number
  alertsEnabled: boolean
  thresholds: AuditThresholds
  minRetentionDays: number
  updatedBy: string | null
  updatedAt: string
}

export interface AuditSettingsUpdate {
  retentionDays?: number
  summaryRetentionDays?: number
  alertsEnabled?: boolean
  thresholds?: Partial<AuditThresholds>
}

export interface AlertRecipient {
  id: string
  email: string
  name: string | null
  alertTypes: string[]
  minSeverity: Severity
  services: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AlertRecipientInput {
  email?: string
  name?: string | null
  alertTypes?: string[]
  minSeverity?: Exclude<Severity, 'info'>
  services?: string[]
  isActive?: boolean
}

/** Filters for GET /events (and /export.csv). List filters are sent comma-joined. */
export interface AuditEventFilters {
  email?: string
  userId?: string
  anonId?: string
  requestId?: string
  journeyId?: string
  referenceId?: string
  service?: string[]
  eventType?: string[]
  status?: string[]
  severity?: string[]
  supplier?: string[]
  step?: string[]
  httpStatus?: number
  errorCode?: string
  from?: string
  to?: string
}

export interface AuditTimelineFilters {
  from?: string
  to?: string
  service?: string[]
  severity?: string[]
}

export interface AuditExportResult {
  filename: string
  rows: number
  truncated: boolean
}
