// The Review screen: everything needed to decide on one customer email.
//   ≥ 1280 px  three columns — ViaTovia said · Details check · Customer email
//   1024–1279  ViaTovia said collapsible on top, then two columns
//   < 1024     three tabs (Customer email first), sticky action bar at the bottom
// Edits autosave (800 ms after typing stops, at once on blur); Send moves on to the next email.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useBlocker, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { AuditErrorState } from '../audit/AuditUI'
import { useIsDesktop, useMediaQuery } from '../vv-audit/useMediaQuery'
import {
  OPEN_QUEUE_PARAMS,
  PD_KEYS,
  useDraft,
  useDraftAutosave,
  useDraftQueue,
  useRefreshBooking,
} from '../../hooks/usePickdropEmails'
import { useTemplates } from '../../hooks/useEmailTemplates'
import {
  adjacentDraftId,
  SUPPLIER_COPY_EMOJI,
  SUPPLIER_COPY_LABEL,
  isLockedDraftError,
  isSendingStale,
  isSupplierCopy,
  isVoucherError,
  nextDraftId,
  pdErrorText,
  problemsFromError,
  shortDateTime,
  timeOnly,
  triggerHint,
} from '../../pickdropEmails'
import type { DraftDetail, DraftEdit } from '../../types'
import ViatoviaEmailPanel from './ViatoviaEmailPanel'
import DetailsCheck from './DetailsCheck'
import CustomerEmailPanel from './CustomerEmailPanel'
import SendFlow from './SendDialog'
import DiscardDialog from './DiscardDialog'
import { SafeHtmlFrame } from './SafeHtmlFrame'
import { Banner, BookingStatusChip, CountdownChip, Kbd, ShortcutsPopover, ToneChip, isTypingTarget, modKey, useNow } from './PdUI'
import { PD_EMAILS_BASE, bookingPath, draftPath } from './paths'

type MobileTab = 'email' | 'details' | 'viatovia'

function Column({ title, children, className, aside }: { title: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function NoSourceEmail({ draft }: { draft: DraftDetail }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
      <Mail className="h-6 w-6 text-gray-300" />
      <p className="text-sm text-gray-600">
        {draft.trigger === 'DRIVER_SEEN' ? 'Made from ViaTovia’s booking status — no email.' : triggerHint(draft) + '.'}
      </p>
    </div>
  )
}

/** Read-only view of a sent or discarded email. */
function ReadOnlyEmail({ draft }: { draft: DraftDetail }) {
  return (
    <div className="space-y-4">
      {draft.status === 'SENT' ? (
        <Banner tone="success" title={`Sent by ${draft.sentBy ?? 'system'} on ${shortDateTime(draft.sentAt)}`}>
          to {draft.sentTo ?? draft.preview?.to}
          {draft.sendCount > 1 && ` · sent ${draft.sendCount}×`}
        </Banner>
      ) : (
        <Banner tone="info" title={`Discarded by ${draft.discardedBy ?? '—'} on ${shortDateTime(draft.discardedAt)}`}>
          {draft.discardReason && <>Reason: {draft.discardReason}</>}
        </Banner>
      )}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</p>
        <p className="mt-0.5 break-words font-medium text-gray-900">{draft.preview?.subject}</p>
      </div>
      <SafeHtmlFrame html={draft.preview?.html ?? ''} title="Customer email" deviceToggle />
    </div>
  )
}

export default function DraftReview({ id }: { id: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const now = useNow()
  const isXL = useMediaQuery('(min-width: 1280px)')
  const isLG = useIsDesktop()

  const { data: draft, isLoading, error, refetch } = useDraft(id)
  const queue = useDraftQueue(OPEN_QUEUE_PARAMS)
  const { data: tpl } = useTemplates()
  const refreshBooking = useRefreshBooking()

  const placeholders = useMemo(() => {
    const own = draft?.placeholders ?? []
    const all = tpl?.placeholders ?? []
    const merged = [...own]
    for (const p of all) if (!merged.some((m) => m.key === p.key)) merged.push({ key: p.key, label: p.label })
    return merged
  }, [draft?.placeholders, tpl?.placeholders])

  // ── Local edit state ──────────────────────────────────────────────
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [overlay, setOverlay] = useState<Record<string, string>>({})
  const [problems, setProblems] = useState<string[]>([])
  const [highlight, setHighlight] = useState<ReadonlySet<string>>(new Set())
  const [dismissedRows, setDismissedRows] = useState<ReadonlySet<string>>(new Set())
  const [dismissedBanners, setDismissedBanners] = useState<ReadonlySet<string>>(new Set())
  const [testMode, setTestMode] = useState<string | null>(null)
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('email')
  const [viaOpen, setViaOpen] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const loadedNote = useRef<{ id: string; note: string | null } | null>(null)

  const autosave = useDraftAutosave(id, {
    onError: (err: unknown, edit: DraftEdit) => {
      const p = problemsFromError(err)
      if (p.length) {
        setProblems(p)
        return true
      }
      if (isVoucherError(err) && edit.attachVoucher !== undefined) {
        setVoucherMessage(pdErrorText(err))
        void qc.invalidateQueries({ queryKey: PD_KEYS.draft(id) })
        return false
      }
      if (isLockedDraftError(err)) {
        showToast({ type: 'error', title: 'Not saved', message: pdErrorText(err) })
        void qc.invalidateQueries({ queryKey: PD_KEYS.draft(id) })
        return false
      }
      return true
    },
    onSaved: () => {
      setOverlay({})
      setProblems([])
    },
  })

  // A different draft starts fresh.
  useEffect(() => {
    setOverlay({})
    setProblems([])
    setHighlight(new Set())
    setDismissedRows(new Set())
    setDismissedBanners(new Set())
    setTestMode(null)
    setVoucherMessage(null)
    setMobileTab('email')
    loadedNote.current = null
  }, [id])

  // Server copy → local fields, unless the admin has edits on the way. The editor mounts only once
  // the fields hold this draft's text, so it never starts from (and saves) an empty body.
  const [hydratedId, setHydratedId] = useState<string | null>(null)
  useEffect(() => {
    if (!draft || autosave.hasUnsaved()) return
    setSubject(draft.subject)
    setBody(draft.bodyHtml)
    setHydratedId(draft.id)
  }, [draft?.id, draft?.subject, draft?.bodyHtml])

  useEffect(() => {
    if (draft && (!loadedNote.current || loadedNote.current.id !== draft.id)) loadedNote.current = { id: draft.id, note: draft.updatedNote }
  }, [draft])

  // A send that is running: keep checking until it finishes (or goes stale).
  useEffect(() => {
    if (draft?.status !== 'SENDING') return
    const t = setInterval(() => void refetch(), 10_000)
    return () => clearInterval(t)
  }, [draft?.status, refetch])

  const status = draft?.status
  const sendingStale = draft ? isSendingStale(draft, now) : false
  const readOnly = status === 'SENT' || status === 'DISCARDED'
  const editable = status === 'DRAFT' || status === 'FAILED' || sendingStale
  const missingCount = draft?.preview?.missing?.length ?? 0
  const saveBusy = autosave.status === 'pending' || autosave.status === 'saving'
  const queueIds = useMemo(() => (queue.data?.items ?? []).map((d) => d.id), [queue.data])
  const prevId = adjacentDraftId(queueIds, id, -1)
  const nextId = adjacentDraftId(queueIds, id, 1)
  const voucherAvailable = !!draft && ((draft.sourceEmail?.attachmentCount ?? 0) > 0 || !!draft.preview?.voucher)

  // ── Edits ─────────────────────────────────────────────────────────
  const onSubjectChange = (v: string) => {
    setSubject(v)
    autosave.schedule({ subject: v })
  }
  const onBodyChange = (v: string) => {
    setBody(v)
    autosave.schedule({ bodyHtml: v })
  }
  const onValueChange = (k: string, v: string) => {
    setOverlay((o) => ({ ...o, [k]: v }))
    autosave.schedule({ values: { [k]: v } })
  }
  const onAttachVoucher = (on: boolean) => {
    setVoucherMessage(null)
    qc.setQueryData<DraftDetail>(PD_KEYS.draft(id), (d) => (d ? { ...d, attachVoucher: on } : d))
    autosave.schedule({ attachVoucher: on }, true)
  }
  const applyValue = async (k: string, v: string) => {
    setBusyKey(k)
    setOverlay((o) => ({ ...o, [k]: v }))
    autosave.schedule({ values: { [k]: v } })
    await autosave.flush()
    setBusyKey(null)
  }
  const focusField = (key: string) => {
    setMobileTab('email')
    setTimeout(() => {
      const el = document.getElementById(`fill-${key}`) ?? document.getElementById(`val-${key}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(el as HTMLInputElement | null)?.focus({ preventScroll: true })
    }, 60)
  }

  // ── Send ──────────────────────────────────────────────────────────
  const queueSnapshot = useRef<string[]>([])
  const openSend = () => {
    if (!draft) return
    queueSnapshot.current = queueIds
    setSendOpen(true)
  }
  const beforeSend = useCallback(async () => {
    const ok = await autosave.flush()
    if (ok) autosave.setPaused(true)
    return ok
  }, [autosave])
  const onSent = (detail: DraftDetail) => {
    autosave.setPaused(false)
    setTestMode(null)
    if (draft?.status === 'SENT') return // a resend stays put
    const next = nextDraftId(queueSnapshot.current.includes(detail.id) ? queueSnapshot.current : [detail.id, ...queueSnapshot.current], detail.id)
    if (next) navigate(draftPath(next))
    else navigate(PD_EMAILS_BASE)
  }

  const sendDisabledReason = !draft
    ? 'Loading…'
    : status === 'DISCARDED'
      ? 'This email was discarded'
      : status === 'SENDING' && !sendingStale
        ? 'Sending…'
        : missingCount > 0
          ? `Fill in: ${(draft.preview?.missing ?? []).map((k) => placeholders.find((p) => p.key === k)?.label ?? k).join(', ')}`
          : saveBusy
            ? 'Saving your changes…'
            : !draft.preview?.to
              ? 'The customer has no email address'
              : null
  const sendLabel = status === 'SENT' ? 'Resend' : status === 'FAILED' || sendingStale ? 'Try again' : status === 'SENDING' ? 'Sending…' : 'Send email'

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void autosave.flush()
        return
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        if (!sendDisabledReason) openSend()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (e.key === ']' && nextId) navigate(draftPath(nextId))
      else if (e.key === '[' && prevId) navigate(draftPath(prevId))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Leaving with unsaved changes ──────────────────────────────────
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && autosave.hasUnsaved())
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void autosave.flush().then((ok) => (ok ? blocker.proceed() : setLeaveConfirm(true)))
  }, [blocker.state])
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (autosave.hasUnsaved()) {
        void autosave.flush()
        e.preventDefault()
      }
    }
    // Mobile Safari may never fire beforeunload — save when the tab is hidden.
    const onHide = () => document.visibilityState === 'hidden' && void autosave.flush()
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [autosave])

  // ── Render ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    )
  }
  if (error || !draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to={PD_EMAILS_BASE} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Pick &amp; Drop Emails
        </Link>
        <AuditErrorState error={error} onRetry={() => void refetch()} notFoundText="This email draft doesn't exist any more." />
      </div>
    )
  }

  const dismissBanner = (k: string) => setDismissedBanners((s) => new Set([...s, k]))
  const showBanner = (k: string) => !dismissedBanners.has(k)
  const noteChanged = !!draft.updatedNote && loadedNote.current?.id === draft.id && loadedNote.current.note !== draft.updatedNote

  const banners = (
    <div className="space-y-2">
      {testMode && (
        <Banner tone="info" title="Test mode — only test accounts receive emails" onDismiss={() => setTestMode(null)}>
          Nothing was sent. {testMode}
        </Banner>
      )}
      {draft.sourceEmail && draft.sourceEmail.senderVerified === false && showBanner('sender') && (
        <Banner tone="warning" title="Sender not verified" onDismiss={() => dismissBanner('sender')}>
          Gmail couldn&apos;t confirm this email really came from ViaTovia. Check before sending.
        </Banner>
      )}
      {draft.booking?.status === 'CANCELLED' && showBanner('cancelled') && (
        <Banner tone="warning" title="This ride is cancelled" onDismiss={() => dismissBanner('cancelled')}>
          Sending asks for an extra confirmation.
        </Banner>
      )}
      {noteChanged && showBanner('note-changed') ? (
        <Banner tone="warning" title="Updated with newer information — review the details check" onDismiss={() => dismissBanner('note-changed')}>
          {draft.updatedNote}
        </Banner>
      ) : (
        draft.updatedNote &&
        !readOnly &&
        showBanner('note') && (
          <Banner tone="info" title="Updated with newer information" onDismiss={() => dismissBanner('note')}>
            {draft.updatedNote}
          </Banner>
        )
      )}
      {status === 'FAILED' && showBanner('failed') && (
        <Banner tone="error" title="Last send failed" onDismiss={() => dismissBanner('failed')}>
          {draft.error ?? 'The mail server did not accept the email.'} Use “Try again” to send it again.
        </Banner>
      )}
      {status === 'SENDING' && (
        <Banner tone="info" title={sendingStale ? 'Sending seems to have stopped' : 'Sending…'}>
          {sendingStale ? 'It started over 10 minutes ago. You can try again.' : `Started ${shortDateTime(draft.sendingStartedAt)}.`}
        </Banner>
      )}
      {voucherMessage && (
        <Banner tone="warning" title="Voucher not attached" onDismiss={() => setVoucherMessage(null)}>
          {voucherMessage}
        </Banner>
      )}
    </div>
  )

  const viaTovia = draft.sourceEmail ? (
    <ViatoviaEmailPanel emailId={draft.sourceEmail.id} fallback={draft.sourceEmail} />
  ) : (
    <NoSourceEmail draft={draft} />
  )
  const details = (
    <DetailsCheck
      draft={draft}
      dismissed={dismissedRows}
      onDismiss={(k) => setDismissedRows((s) => new Set([...s, k]))}
      onUseValue={(k, v) => void applyValue(k, v)}
      onFill={focusField}
      readOnly={!editable}
      busyKey={busyKey}
    />
  )
  const customer = readOnly ? (
    <ReadOnlyEmail draft={draft} />
  ) : hydratedId !== draft.id ? (
    <Skeleton className="h-96 w-full" />
  ) : (
    <fieldset disabled={!editable} className="min-w-0">
      <CustomerEmailPanel
        draft={draft}
        placeholders={placeholders}
        subject={subject}
        body={body}
        overlay={overlay}
        onSubjectChange={onSubjectChange}
        onBodyChange={onBodyChange}
        onValueChange={onValueChange}
        onCommit={() => void autosave.flush()}
        onAttachVoucher={onAttachVoucher}
        voucherAvailable={voucherAvailable}
        highlight={highlight}
        problems={problems}
        saving={saveBusy}
        disabled={!editable}
      />
    </fieldset>
  )

  const saveLine =
    autosave.status === 'saving' ? (
      <span className="inline-flex items-center gap-1.5 text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    ) : autosave.status === 'pending' ? (
      <span className="text-gray-500">Unsaved changes</span>
    ) : autosave.status === 'error' ? (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-red-600">
        Couldn&apos;t save{problems.length ? ' — fix the problems shown' : ''}
        <button type="button" onClick={() => void autosave.flush()} className="font-semibold underline underline-offset-2">
          Retry
        </button>
      </span>
    ) : autosave.savedAt ? (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Saved {timeOnly(autosave.savedAt)}
      </span>
    ) : draft.editedAt ? (
      <span className="text-gray-400">Last edited {shortDateTime(draft.editedAt)}{draft.editedBy ? ` by ${draft.editedBy}` : ''}</span>
    ) : null

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      {/* Top bar */}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={readOnly ? `${PD_EMAILS_BASE}/history` : PD_EMAILS_BASE}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Pick &amp; Drop Emails</span><span className="sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ShortcutsPopover
              items={[
                { keys: [modKey, 'S'], label: 'Save now' },
                { keys: [modKey, 'Enter'], label: 'Send' },
                { keys: ['['], label: 'Previous email' },
                { keys: [']'], label: 'Next email' },
                { keys: ['Esc'], label: 'Close dialog' },
              ]}
            />
            {!readOnly && queueIds.length > 1 && (
              <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm">
                <button
                  type="button"
                  disabled={!prevId}
                  onClick={() => prevId && navigate(draftPath(prevId))}
                  aria-label="Previous email ([)"
                  title="Previous email ( [ )"
                  className="flex h-10 w-10 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-xs tabular-nums text-gray-500">
                  {queueIds.indexOf(id) + 1 || '–'}/{queueIds.length}
                </span>
                <button
                  type="button"
                  disabled={!nextId}
                  onClick={() => nextId && navigate(draftPath(nextId))}
                  aria-label="Next email (])"
                  title="Next email ( ] )"
                  className="flex h-10 w-10 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="break-words text-lg font-bold text-gray-900 sm:text-xl">
              {draft.templateName} <span className="font-normal text-gray-400">·</span>{' '}
              <span className="font-mono text-base font-semibold text-gray-700">{draft.orderNo}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {isSupplierCopy(draft) && (
                <ToneChip tone="blue">
                  <span aria-hidden>{SUPPLIER_COPY_EMOJI}</span> {SUPPLIER_COPY_LABEL}
                </ToneChip>
              )}
              <CountdownChip pickupAt={draft.pickupAt} now={now} />
              {draft.booking?.pickupLocal && <span className="text-xs text-gray-600">Pickup {draft.booking.pickupLocal} (local)</span>}
              <BookingStatusChip status={draft.booking?.status ?? draft.bookingStatus} />
              <span className="text-xs text-gray-500">{triggerHint(draft)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={bookingPath(draft.orderNo)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Open booking
            </Link>
            {!readOnly && (
              <Button
                variant="outline"
                className="h-10"
                loading={refreshBooking.isPending}
                onClick={() =>
                  refreshBooking.mutate(
                    { orderNo: draft.orderNo },
                    {
                      onSuccess: (r) =>
                        showToast({
                          type: 'success',
                          title: `Refreshed — ${r.draftsRefreshed} draft${r.draftsRefreshed === 1 ? '' : 's'} updated`,
                        }),
                      onError: (err) => showToast({ type: 'error', title: 'Could not refresh from ViaTovia', message: pdErrorText(err) }),
                    },
                  )
                }
              >
                {!refreshBooking.isPending && <RefreshCw className="h-4 w-4" />}
                Refresh from ViaTovia
              </Button>
            )}
          </div>
        </div>
      </header>

      {banners}

      {/* Columns */}
      {isXL ? (
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,4fr)] items-start gap-4">
          <Column title="ViaTovia said">{viaTovia}</Column>
          <Column title="Details check">{details}</Column>
          <Column title="Customer email">{customer}</Column>
        </div>
      ) : isLG ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setViaOpen((o) => !o)}
              aria-expanded={viaOpen}
              className="flex min-h-12 w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">ViaTovia said</span>
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                <span className="truncate">{draft.sourceEmail?.subject ?? 'No email'}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', viaOpen && 'rotate-180')} />
              </span>
            </button>
            {viaOpen && <div className="border-t border-gray-100 p-4">{viaTovia}</div>}
          </section>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4">
            <Column title="Details check">{details}</Column>
            <Column title="Customer email">{customer}</Column>
          </div>
        </div>
      ) : (
        <div>
          <div className="sticky -top-4 z-10 -mx-4 bg-gray-50/95 px-4 backdrop-blur sm:-top-6 sm:-mx-6 sm:px-6" role="tablist" aria-label="Review sections">
            <div className="grid grid-cols-3 border-b border-gray-200">
              {(
                [
                  ['email', 'Customer email'],
                  ['details', 'Details check'],
                  ['viatovia', 'ViaTovia said'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === k}
                  onClick={() => setMobileTab(k)}
                  className={cn(
                    '-mb-px flex min-h-12 items-center justify-center gap-1.5 border-b-2 px-1 text-center text-xs font-semibold sm:text-sm',
                    mobileTab === k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500',
                  )}
                >
                  {label}
                  {k === 'email' && missingCount > 0 && !readOnly && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-700">{missingCount} missing</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <div className={cn(mobileTab !== 'email' && 'hidden')}>{customer}</div>
            <div className={cn(mobileTab !== 'details' && 'hidden')}>{details}</div>
            <div className={cn(mobileTab !== 'viatovia' && 'hidden')}>{viaTovia}</div>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {editable && (
              <Button variant="ghost" onClick={() => setDiscardOpen(true)} className="min-h-11 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Discard</span>
              </Button>
            )}
            <div className="hidden min-w-0 truncate text-xs sm:block">{saveLine}</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5 sm:flex-none">
            <span className="text-xs sm:hidden">{saveLine}</span>
            {status !== 'DISCARDED' && (
              <span title={sendDisabledReason ?? undefined} className="w-full sm:w-auto">
                <Button
                  variant={status === 'SENT' ? 'outline' : 'primary'}
                  onClick={openSend}
                  disabled={!!sendDisabledReason && status !== 'SENT'}
                  className="min-h-11 w-full px-5 sm:w-auto"
                >
                  {status === 'SENT' ? <RotateCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {sendLabel}
                  {status === 'SENT' && draft.sendCount > 0 && <span className="text-xs opacity-70">(sent {draft.sendCount}×)</span>}
                </Button>
              </span>
            )}
            {sendDisabledReason && status !== 'SENT' && status !== 'DISCARDED' && (
              <span className="max-w-full truncate text-[11px] text-gray-500 sm:max-w-xs">{sendDisabledReason}</span>
            )}
          </div>
        </div>
        <p className="mx-auto mt-1 hidden max-w-[1600px] text-right text-[11px] text-gray-400 md:block">
          <Kbd>{modKey}</Kbd>+<Kbd>Enter</Kbd> send · <Kbd>{modKey}</Kbd>+<Kbd>S</Kbd> save · <Kbd>[</Kbd> <Kbd>]</Kbd> previous / next
        </p>
      </div>

      <SendFlow
        draftId={draft.id}
        open={sendOpen}
        onClose={() => {
          setSendOpen(false)
          autosave.setPaused(false)
        }}
        beforeSend={editable ? beforeSend : undefined}
        onSent={onSent}
        onMissing={(keys) => {
          setHighlight(new Set(keys))
          void refetch()
          if (keys[0]) focusField(keys[0])
        }}
        onTestMode={setTestMode}
        onVoucherError={(msg) => {
          setVoucherMessage(msg)
          onAttachVoucher(false)
        }}
      />
      <DiscardDialog draft={draft} open={discardOpen} onClose={() => setDiscardOpen(false)} onDiscarded={() => autosave.dropPending()} />
      <ConfirmDialog
        open={leaveConfirm}
        onClose={() => {
          setLeaveConfirm(false)
          blocker.reset?.()
        }}
        onConfirm={() => {
          setLeaveConfirm(false)
          autosave.dropPending()
          blocker.proceed?.()
        }}
        title="Leave without saving?"
        message={`Your latest changes couldn't be saved${autosave.error ? `: ${pdErrorText(autosave.error)}` : ''}.`}
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        danger
      />
    </div>
  )
}
