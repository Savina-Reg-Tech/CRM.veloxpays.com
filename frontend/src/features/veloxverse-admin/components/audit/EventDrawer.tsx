import { useEffect, useId, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FocusTrap from 'focus-trap-react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { useVVAuditEvent, useVVAuditMeta } from '../../hooks/useVVAudit'
import {
  eventTypeLabel,
  formatAuditCents,
  formatDurationMs,
  humanize,
  serviceLabel,
  sourceLabel,
  supplierLabel, stepLabel,
  stepStaffAction,
} from '../../audit'
import type { AuditEvent } from '../../auditTypes'
import {
  AuditErrorState,
  AuditTime,
  CopyId,
  CustomerCell,
  Field,
  KeyValueList,
  MaskedNote,
  Section,
  SeverityBadge,
  StatusIcon,
} from './AuditUI'
import { useOpenEvent } from './EventTable'

const AUDIT = '/dashboard/veloxverse/audit-logs'

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>
}

function LinkedEvent({ e }: { e: AuditEvent }) {
  const open = useOpenEvent()
  return (
    <button
      type="button"
      onClick={() => open(e.id)}
      className="flex w-full items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-left text-sm hover:border-indigo-200 hover:bg-indigo-50/40"
    >
      <StatusIcon status={e.status} />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{stepLabel(e.step)}</span>
      <span className="shrink-0 text-xs text-gray-500">{serviceLabel(e.service)}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
    </button>
  )
}

/** Side panel for one event (handoff §7.2) — opened anywhere by `?event=<id>`. */
export function EventDrawer() {
  const [params, setParams] = useSearchParams()
  const id = params.get('event')
  const { data, isLoading, error, refetch } = useVVAuditEvent(id)
  const meta = useVVAuditMeta()
  const titleId = useId()

  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        return next
      },
      { replace: true }
    )

  useEffect(() => {
    if (!id) return
    // The API-log drawer (?log=) stacks above this one — let Esc close only the top drawer.
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !new URLSearchParams(window.location.search).has('log') && close()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!id) return null
  const e = data?.event

  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        fallbackFocus: () => document.getElementById(`${titleId}-panel`) ?? document.body,
        escapeDeactivates: false,
        clickOutsideDeactivates: false,
        allowOutsideClick: true,
        returnFocusOnDeactivate: true,
        tabbableOptions: { displayCheck: 'none' },
      }}
    >
      <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" tabIndex={-1} aria-label="Close" onClick={close} className="absolute inset-0 hidden bg-gray-900/30 md:block" />
        {/* Full-screen sheet below md (Back bar on top); right-side panel from md. */}
        <aside id={`${titleId}-panel`} tabIndex={-1} className="relative flex h-full w-full flex-col bg-white shadow-xl outline-none md:max-w-2xl">
          <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-1 py-1 md:hidden">
            <button
              type="button"
              onClick={close}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
            </button>
            <span id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">Audit event</span>
          </div>
          <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
            {e ? (
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={e.severity} />
                  <StatusIcon status={e.status} withLabel />
                  <h2 className="min-w-0 break-words text-lg font-semibold text-gray-900">{stepLabel(e.step)}</h2>
                </div>
                <p className="break-words text-xs text-gray-500">
                  <AuditTime iso={e.createdAt} /> · {serviceLabel(e.service)} · {eventTypeLabel(e.eventType)} · {sourceLabel(e.source)} · actor {e.actor}
                </p>
                {stepStaffAction(e.step) && (
                  <p role="note" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <span className="font-semibold">What to do: </span>
                    {stepStaffAction(e.step)}
                  </p>
                )}
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-gray-900">Event</h2>
            )}
            <button
              type="button"
              onClick={close}
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:inline-flex"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-5">
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="md" label="Loading event…" /></div>
            ) : error || !data || !e ? (
              <AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={meta.data?.retentionDays} />
            ) : (
              <>
                <MaskedNote />
                {e.isSensitiveMasked && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Sensitive values were redacted from this row when it was recorded.</p>
                )}

                <Section title="Customer">
                  <Grid>
                    <Field label="Customer"><CustomerCell customer={e.customer} anonId={e.anonId} /></Field>
                    <Field label="Name">{e.customer?.name}</Field>
                    <Field label="Account type">{e.customer?.role ? humanize(e.customer.role.toLowerCase()) : e.anonId ? 'Guest (anonymous)' : null}</Field>
                    <Field label="Actor">{humanize(e.actor)}</Field>
                  </Grid>
                </Section>

                <Section title="Ids">
                  <Grid>
                    <Field label="Journey"><CopyId value={e.journeyId} to={e.journeyId ? `${AUDIT}/journeys/${e.journeyId}` : undefined} /></Field>
                    <Field label="Request (support ref)"><CopyId value={e.requestId} to={e.requestId ? `${AUDIT}/trace/${e.requestId}` : undefined} /></Field>
                    <Field label="Reference">
                      {e.referenceId ? (
                        <span className="block">
                          <span className="text-xs text-gray-500">{e.referenceType ?? 'reference'}</span>
                          <CopyId
                            value={e.referenceId}
                            to={e.referenceType ? `${AUDIT}/bookings/${encodeURIComponent(e.referenceType)}/${encodeURIComponent(e.referenceId)}` : undefined}
                          />
                        </span>
                      ) : null}
                    </Field>
                    <Field label="Session"><CopyId value={e.sessionId} /></Field>
                    <Field label="Browser id"><CopyId value={e.anonId} to={e.anonId ? `${AUDIT}/guests/${encodeURIComponent(e.anonId)}` : undefined} /></Field>
                    <Field label="Event id"><CopyId value={e.id} /></Field>
                    {e.supplierCallId && <Field label="Supplier call"><CopyId value={e.supplierCallId} /></Field>}
                  </Grid>
                </Section>

                {(e.errorCode || e.errorMessage || e.errorDetails) && (
                  <Section title="Error">
                    <div className="space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
                      {e.errorCode && <p className="break-all font-mono text-sm font-semibold text-red-800">{e.errorCode}</p>}
                      {e.errorMessage && <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-900">{e.errorMessage}</pre>}
                    </div>
                    {e.errorDetails && <KeyValueList data={e.errorDetails} />}
                  </Section>
                )}

                {(e.httpMethod || e.route || e.httpStatus != null || e.durationMs != null) && (
                  <Section title="Request">
                    <Grid>
                      <Field label="Route">
                        {e.route ? <span className="break-all font-mono text-xs">{e.httpMethod} {e.route}</span> : null}
                      </Field>
                      <Field label="HTTP status">{e.httpStatus}</Field>
                      <Field label="Duration">{e.durationMs != null ? formatDurationMs(e.durationMs) : null}</Field>
                    </Grid>
                  </Section>
                )}

                {(e.supplier || data.dragonpassApiLog) && (
                  <Section title="Supplier">
                    <Grid>
                      <Field label="Supplier">{e.supplier ? supplierLabel(e.supplier) : null}</Field>
                      <Field label="Operation">
                        {typeof e.metadata?.operation === 'string' ? <span className="break-all font-mono text-xs">{e.metadata.operation}</span> : null}
                      </Field>
                      <Field label="Supplier HTTP status">{e.metadata?.upstreamStatus != null ? String(e.metadata.upstreamStatus) : null}</Field>
                    </Grid>
                    {data.dragonpassApiLog && (
                      <div className="mt-2 rounded-lg border border-gray-100 p-3">
                        <p className="mb-2 text-xs font-semibold text-gray-500">DragonPass API log</p>
                        <Grid>
                          <Field label="Call"><span className="break-all font-mono text-xs">{data.dragonpassApiLog.method} {data.dragonpassApiLog.endpoint}</span></Field>
                          <Field label="Response">
                            {data.dragonpassApiLog.responseStatus ?? '—'} · {data.dragonpassApiLog.success ? 'success' : 'failed'}
                          </Field>
                          <Field label="Duration">{formatDurationMs(data.dragonpassApiLog.durationMs)}</Field>
                          <Field label="At"><AuditTime iso={data.dragonpassApiLog.createdAt} /></Field>
                          {data.dragonpassApiLog.errorMessage && <Field label="Error">{data.dragonpassApiLog.errorMessage}</Field>}
                        </Grid>
                      </div>
                    )}
                  </Section>
                )}

                {data.payment && (
                  <Section title="Payment">
                    <Grid>
                      <Field label="Amount">{formatAuditCents(data.payment.amountCents, data.payment.currency)}</Field>
                      <Field label="Status">{data.payment.status}</Field>
                      <Field label="Provider">{data.payment.provider}</Field>
                      <Field label="For">{humanize(data.payment.resourceType?.toLowerCase())}</Field>
                      <Field label="Payment id">
                        <CopyId value={data.payment.id} to={`${AUDIT}/bookings/payment/${data.payment.id}`} />
                      </Field>
                      <Field label="Resource id"><CopyId value={data.payment.resourceId} /></Field>
                      <Field label="Created"><AuditTime iso={data.payment.createdAt} /></Field>
                      <Field label="Updated"><AuditTime iso={data.payment.updatedAt} /></Field>
                    </Grid>
                  </Section>
                )}

                <Section title="Metadata">
                  <KeyValueList data={e.metadata} empty="No extra details." />
                </Section>

                <Section title="Device">
                  <Grid>
                    <Field label="IP">{e.ip}</Field>
                    <Field label="Browser">{e.userAgent}</Field>
                    <Field label="Platform">{e.platform}</Field>
                    <Field label="App version">{e.appVersion}</Field>
                  </Grid>
                </Section>

                {(data.parent || data.children.length > 0 || data.sameRequestEvents > 1) && (
                  <Section title="Related">
                    <div className="space-y-2">
                      {data.parent && (
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Caused by</p>
                          <LinkedEvent e={data.parent} />
                        </div>
                      )}
                      {data.children.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Led to</p>
                          <div className="space-y-1.5">{data.children.map((c) => <LinkedEvent key={c.id} e={c} />)}</div>
                        </div>
                      )}
                      {data.sameRequestEvents > 1 && e.requestId && (
                        <Link to={`${AUDIT}/trace/${e.requestId}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                          See all {data.sameRequestEvents} events of this request <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </FocusTrap>
  )
}
