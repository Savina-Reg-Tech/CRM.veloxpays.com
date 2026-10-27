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
  /** Absent on VeloxVerse builds without API logs. */
  apiLogs?: ApiLogMeta
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
  /** Absent on VeloxVerse builds without API logs. */
  apiLogs?: ApiLogSettings
}

export interface AuditSettingsUpdate {
  retentionDays?: number
  summaryRetentionDays?: number
  alertsEnabled?: boolean
  thresholds?: Partial<AuditThresholds>
  /** Send only the keys that changed. */
  apiLogs?: Partial<Pick<ApiLogSettings, 'enabled' | 'capture' | 'bodies' | 'retentionDays'>>
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

/** Result of any VeloxVerse CSV download (see `downloadVVCsv`). */
export interface CsvExportResult {
  filename: string
  rows: number
  truncated: boolean
}

export type AuditExportResult = CsvExportResult

// ── API logs (every HTTP exchange: inbound, supplier calls, webhooks) ──

export type ApiLogDirection = 'inbound' | 'outbound' | 'webhook'
export type ApiLogOutcome = 'success' | 'failure' | 'error' | 'timeout' | 'unknown'
export type ApiLogStatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'none'
export type ApiLogCapture = 'all' | 'errors_only'

/** Row in lists, timelines and "other attempts" — never headers or bodies. */
export interface ApiLogSummary {
  id: string
  createdAt: string
  direction: ApiLogDirection
  service: string
  /** dragonpass | mint | esim | travelfusion | viatovia | email | s3 */
  supplier: string | null
  /** Outbound: 'POST /v2/orders/:id/cancel', 'sendMail:otp', 'StartBooking' */
  operation: string | null
  /** GET POST PUT PATCH DELETE SMTP S3 */
  method: string | null
  /** Query values already redacted. */
  url: string | null
  /** Pattern, e.g. '/api/v1/lounge/visits/:id/cancel' */
  route: string | null
  /** null = no answer (timeout / network). */
  statusCode: number | null
  outcome: ApiLogOutcome
  /** outcome is unknown or timeout */
  needsAttention: boolean
  /** payment / refund / charge / top-up / flight booking */
  isMoneyCall: boolean
  durationMs: number | null
  /** 1, 2… (supplier retry after a network failure) */
  attempt: number | null
  /** DragonPass / eSIM request id, or 'fp:…' Mint token fingerprint */
  idempotencyKey: string | null
  errorCode: string | null
  errorMessage: string | null
  actor: 'customer' | 'guest' | 'admin' | 'support' | 'system'
  /** Background job name, e.g. 'dragonpassReconciliation' */
  jobName: string | null
  /** Our request id = the support reference; 'job-…' for job runs. */
  requestId: string | null
  journeyId: string | null
  userId: string | null
  /** Booking / payment / supplier ids found in this exchange. */
  refs: string[]
  hasBodies: boolean
  /** A body was > 16 KB — only a preview is stored. */
  bodyTruncated: boolean
  /** Something was removed or masked. */
  isSensitiveMasked: boolean
  /** Support viewers get '203.0.113.0/24'. */
  ip: string | null
  /** Support viewers get 'Chrome on macOS'. */
  userAgent: string | null
  /** Masked for support viewers. */
  customer: AuditCustomer | null
}

/** A body over 16 KB, as stored. */
export interface ApiLogTruncatedBody {
  _truncated: true
  _bytes: number
  preview: string
}

export interface ApiLogDetail extends ApiLogSummary {
  anonId: string | null
  referenceType: string | null
  referenceId: string | null
  /** Allow-listed headers only. */
  requestHeaders: Record<string, string> | null
  /** JSON, { text } for a non-JSON body, or ApiLogTruncatedBody. */
  requestBody: unknown | null
  responseBody: unknown | null
  requestBytes: number | null
  responseBytes: number | null
}

export interface ApiLogDetailResponse {
  log: ApiLogDetail
  /** Same idempotency key (retries of the same call). */
  otherAttempts: ApiLogSummary[]
  sameRequestLogs: number
  sameRequestAuditEvents: number
}

export interface ApiLogListResponse {
  logs: ApiLogSummary[]
  nextCursor: string | null
}

export interface ApiTimelineAuditEvent {
  id: string
  createdAt: string
  service: string
  eventType: string
  step: string
  status: string
  severity: string
  requestId: string | null
  journeyId: string | null
  referenceType: string | null
  referenceId: string | null
  errorCode: string | null
  errorMessage: string | null
  supplier: string | null
}

export type ApiTimelineItem =
  | { kind: 'api_log'; at: string; log: ApiLogSummary }
  | { kind: 'audit_event'; at: string; event: ApiTimelineAuditEvent }

export interface ApiTimelineResponse {
  query: { ref: string | null; requestId: string | null; journeyId: string | null; from: string; to: string }
  /** Request ids the story spans. */
  requests: string[]
  customer: AuditCustomer | null
  counts: { apiLogs: number; auditEvents: number; failures: number; needsAttention: number }
  /** > 1000 API logs — narrow the range. */
  truncated: boolean
  /** Oldest first. */
  items: ApiTimelineItem[]
}

export interface ApiLogStats {
  from: string
  to: string
  total: number
  byOutcome: Partial<Record<ApiLogOutcome, number>>
  byStatusClass: Partial<Record<ApiLogStatusClass | '1xx', number>>
  byDirection: Partial<Record<ApiLogDirection, number>>
  suppliers: Array<{ supplier: string; calls: number; failed: number; needsAttention: number; failureRatePercent: number; p95Ms: number | null }>
  slowest: Array<{ operation: string; method: string | null; calls: number; p95Ms: number | null; maxMs: number | null }>
  topErrors: Array<{ error: string; count: number; message: string | null }>
  /** Latest 20 unknown / timeout. */
  needsAttention: ApiLogSummary[]
}

export interface ApiLogExport {
  filename: string
  csv: string
  rows: number
  truncated: boolean
}

export interface ApiLogSettings {
  enabled: boolean
  capture: ApiLogCapture
  bodies: boolean
  retentionDays: number
  minRetentionDays: number
  maxRetentionDays: number
}

/** GET /meta → data.apiLogs */
export interface ApiLogMeta {
  directions: ApiLogDirection[]
  outcomes: Array<{ value: ApiLogOutcome; colour: string; needsAttention: boolean }>
  statusClasses: ApiLogStatusClass[]
  methods: string[]
  captureModes: ApiLogCapture[]
  defaultRetentionDays: number
  retentionDays: number
}

/** GET /api-logs query (lists are sent as "a,b"). */
export interface ApiLogFilters {
  from?: string
  to?: string
  direction?: string[]
  outcome?: string[]
  statusClass?: string[]
  statusCode?: number
  method?: string[]
  service?: string[]
  supplier?: string[]
  route?: string
  ref?: string
  requestId?: string
  journeyId?: string
  userId?: string
  email?: string
  jobName?: string
  errorsOnly?: boolean
  moneyOnly?: boolean
  minDurationMs?: number
}

/** Exactly one of ref / requestId / journeyId. */
export interface ApiTimelineParams {
  ref?: string
  requestId?: string
  journeyId?: string
  from?: string
  to?: string
}
