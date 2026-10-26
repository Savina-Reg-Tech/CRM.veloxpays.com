import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { pickdropEmailsService } from '../vvAdminService'
import { draftPath } from '../components/pickdrop-emails/paths'
import type { DraftDetail, DraftEdit, DraftListParams, InboxAttachment, InboxListParams } from '../types'

export const PD_KEYS = {
  all: ['pd-emails'] as const,
  drafts: (params?: DraftListParams) => (params ? (['pd-emails', 'drafts', params] as const) : (['pd-emails', 'drafts'] as const)),
  draft: (id: string) => ['pd-emails', 'draft', id] as const,
  inbox: (params?: InboxListParams) => (params ? (['pd-emails', 'inbox', params] as const) : (['pd-emails', 'inbox'] as const)),
  inboxItem: (id: string) => ['pd-emails', 'inbox-item', id] as const,
  booking: (orderNo: string) => ['pd-emails', 'booking', orderNo] as const,
  badge: ['pd-emails', 'badge'] as const,
}

/** The queue the Review screen walks through (and that "next email" follows). */
export const OPEN_QUEUE_PARAMS: DraftListParams = { open: true, page: 1, limit: 100 }

/** After send / discard / link / ignore / sync: the queue, badge, inbox and that booking's timeline. */
export function invalidatePickdrop(qc: QueryClient, orderNo?: string | null) {
  void qc.invalidateQueries({ queryKey: PD_KEYS.drafts() })
  void qc.invalidateQueries({ queryKey: PD_KEYS.badge })
  void qc.invalidateQueries({ queryKey: PD_KEYS.inbox() })
  void qc.invalidateQueries({ queryKey: ['pd-emails', 'inbox-item'] })
  if (orderNo) void qc.invalidateQueries({ queryKey: PD_KEYS.booking(orderNo) })
}

// ── Queue & drafts ──────────────────────────────────────────────────
export function useDraftQueue(params: DraftListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PD_KEYS.drafts(params),
    queryFn: () => pickdropEmailsService.listDrafts(params),
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  })
}

export function useDraft(id: string | undefined) {
  return useQuery({
    queryKey: PD_KEYS.draft(id ?? ''),
    queryFn: () => pickdropEmailsService.getDraft(id!),
    enabled: !!id,
    // A newer ViaTovia email can update the draft while it is open.
    refetchOnWindowFocus: true,
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && status !== 403 && count < 2
    },
  })
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

function mergeEdit(a: DraftEdit | null, b: DraftEdit | null): DraftEdit | null {
  if (!a) return b
  if (!b) return a
  const merged: DraftEdit = { ...a, ...b }
  if (a.values || b.values) merged.values = { ...(a.values ?? {}), ...(b.values ?? {}) }
  return merged
}

export const AUTOSAVE_DELAY_MS = 800

/**
 * Autosave for one draft: edits are merged and PATCHed 800 ms after the last change (or at once
 * with `immediate`). The PATCH answer is the whole draft, so it replaces the cached one —
 * `missing` and `preview` update without another request. Never saves while `paused` (a send is
 * running). `onError` decides whether a failed edit is kept for Retry (return true) or dropped.
 */
export function useDraftAutosave(
  id: string | undefined,
  opts: { onError?: (err: unknown, edit: DraftEdit) => boolean; onSaved?: (detail: DraftDetail) => void } = {},
) {
  const qc = useQueryClient()
  const pending = useRef<DraftEdit | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const paused = useRef(false)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)

  // A different draft starts clean.
  useEffect(() => {
    pending.current = null
    clearTimeout(timer.current)
    setStatus('idle')
    setSavedAt(null)
    setError(null)
    return () => clearTimeout(timer.current)
  }, [id])

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    if (inFlight.current) await inFlight.current
    const edit = pending.current
    if (!edit || !id) return true
    if (paused.current) return false
    pending.current = null
    setStatus('saving')
    const run = pickdropEmailsService
      .editDraft(id, edit)
      .then((detail) => {
        qc.setQueryData(PD_KEYS.draft(id), detail)
        setSavedAt(Date.now())
        setError(null)
        setStatus(pending.current ? 'pending' : 'saved')
        if (!pending.current) optsRef.current.onSaved?.(detail)
        return true
      })
      .catch((err: unknown) => {
        const keep = optsRef.current.onError ? optsRef.current.onError(err, edit) : true
        if (keep) pending.current = mergeEdit(edit, pending.current)
        setError(err)
        setStatus(keep ? 'error' : pending.current ? 'pending' : 'idle')
        return false
      })
      .finally(() => {
        inFlight.current = null
      })
    inFlight.current = run
    const ok = await run
    // Edits typed while that save was running go out straight after it.
    if (ok && pending.current && !paused.current) return flush()
    return ok
  }, [id, qc])

  const schedule = useCallback(
    (edit: DraftEdit, immediate = false) => {
      pending.current = mergeEdit(pending.current, edit)
      setStatus('pending')
      clearTimeout(timer.current)
      if (immediate) void flush()
      else timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  const hasUnsaved = useCallback(() => !!pending.current || !!inFlight.current, [])
  const setPaused = useCallback((p: boolean) => {
    paused.current = p
  }, [])
  const dropPending = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
    setStatus('idle')
  }, [])

  return { schedule, flush, status, savedAt, error, hasUnsaved, setPaused, dropPending }
}

export function useSendDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resend, confirmCancelled }: { id: string; orderNo: string; resend?: boolean; confirmCancelled?: boolean }) =>
      resend
        ? pickdropEmailsService.resendDraft(id, confirmCancelled ? { confirmCancelled } : {})
        : pickdropEmailsService.sendDraft(id, confirmCancelled ? { confirmCancelled } : {}),
    onSuccess: (detail, vars) => {
      qc.setQueryData(PD_KEYS.draft(vars.id), detail)
      invalidatePickdrop(qc, vars.orderNo)
    },
    // A failed send (mail server) leaves the draft FAILED on the server; a 409 means it changed.
    onError: (_err, vars) => {
      void qc.invalidateQueries({ queryKey: PD_KEYS.draft(vars.id) })
      invalidatePickdrop(qc, vars.orderNo)
    },
  })
}

export function useDiscardDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; orderNo: string; reason: string }) => pickdropEmailsService.discardDraft(id, reason),
    onSuccess: (detail, vars) => {
      qc.setQueryData(PD_KEYS.draft(vars.id), detail)
      invalidatePickdrop(qc, vars.orderNo)
    },
  })
}

// ── Inbox ───────────────────────────────────────────────────────────
export function useInbox(params: InboxListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PD_KEYS.inbox(params),
    queryFn: () => pickdropEmailsService.listInbox(params),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  })
}

export function useInboxItem(id: string | null | undefined) {
  return useQuery({
    queryKey: PD_KEYS.inboxItem(id ?? ''),
    queryFn: () => pickdropEmailsService.getInbox(id!),
    enabled: !!id,
  })
}

export function useLinkInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, orderNo }: { id: string; orderNo: string }) => pickdropEmailsService.linkInbox(id, orderNo),
    onSuccess: (detail) => {
      qc.setQueryData(PD_KEYS.inboxItem(detail.id), detail)
      invalidatePickdrop(qc, detail.orderNo)
    },
  })
}

export function useIgnoreInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => pickdropEmailsService.ignoreInbox(id, note),
    onSuccess: (detail) => {
      qc.setQueryData(PD_KEYS.inboxItem(detail.id), detail)
      invalidatePickdrop(qc, detail.orderNo)
    },
  })
}

export function useSyncInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => pickdropEmailsService.syncInbox(),
    onSuccess: () => invalidatePickdrop(qc),
  })
}

/**
 * A customer email made from one ViaTovia email (its rebranded copy, or a template filled from
 * it). Asking again returns the same open draft. Opens the Review screen on success.
 */
export function useCreateDraftFromInbox() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: ({ id, templateKey }: { id: string; templateKey: string }) => pickdropEmailsService.createDraftFromInbox(id, templateKey),
    onSuccess: (detail, vars) => {
      qc.setQueryData(PD_KEYS.draft(detail.id), detail)
      void qc.invalidateQueries({ queryKey: PD_KEYS.inboxItem(vars.id) })
      invalidatePickdrop(qc, detail.orderNo)
      navigate(draftPath(detail.id))
    },
  })
}

export function useDownloadAttachment() {
  return useMutation({
    mutationFn: ({ inboxId, attachment }: { inboxId: string; attachment: InboxAttachment }) =>
      pickdropEmailsService.downloadAttachment(inboxId, attachment),
  })
}

// ── Booking ─────────────────────────────────────────────────────────
export function useBookingEmails(orderNo: string | null | undefined) {
  return useQuery({
    queryKey: PD_KEYS.booking(orderNo ?? ''),
    queryFn: () => pickdropEmailsService.bookingTimeline(orderNo!),
    enabled: !!orderNo,
  })
}

/** Open drafts for one booking (the "1 email waiting — Review" badge on the booking). */
export function useBookingOpenDrafts(orderNo: string | null | undefined) {
  return useQuery({
    queryKey: [...PD_KEYS.drafts({ open: true, orderNo: orderNo ?? '', limit: 20 })],
    queryFn: () => pickdropEmailsService.listDrafts({ open: true, orderNo: orderNo!, limit: 20 }),
    enabled: !!orderNo,
  })
}

export function useRefreshBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderNo }: { orderNo: string }) => pickdropEmailsService.refreshBooking(orderNo),
    onSuccess: (_res, { orderNo }) => {
      // Its open drafts were refilled.
      void qc.invalidateQueries({ queryKey: ['pd-emails', 'draft'] })
      invalidatePickdrop(qc, orderNo)
    },
  })
}

export function useCreateBookingDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderNo, templateKey }: { orderNo: string; templateKey: string }) =>
      pickdropEmailsService.createBookingDraft(orderNo, templateKey),
    onSuccess: (detail) => {
      qc.setQueryData(PD_KEYS.draft(detail.id), detail)
      invalidatePickdrop(qc, detail.orderNo)
    },
  })
}

// ── Sidebar badge ───────────────────────────────────────────────────
/** Open drafts + unmatched ViaTovia emails. Polls every minute, only while the tab is visible. */
export function usePickdropBadge(enabled = true) {
  const common = {
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  } as const
  const drafts = useQuery({
    ...common,
    queryKey: [...PD_KEYS.badge, 'drafts'],
    queryFn: () => pickdropEmailsService.listDrafts({ open: true, limit: 1 }),
  })
  const unmatched = useQuery({
    ...common,
    queryKey: [...PD_KEYS.badge, 'unmatched'],
    queryFn: () => pickdropEmailsService.listInbox({ status: 'UNMATCHED', limit: 1 }),
  })
  const open = drafts.data?.total ?? 0
  const unmatchedCount = unmatched.data?.total ?? 0
  return { open, unmatched: unmatchedCount, total: open + unmatchedCount, isLoading: drafts.isLoading || unmatched.isLoading }
}
