import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { vvAuditService } from '../vvAdminService'
import type { AlertRecipientInput, AuditEventFilters, AuditSettingsUpdate, AuditTimelineFilters } from '../types'

// Every key starts ['vv-audit', <viewer role>, …] — VeloxVerse masks data for support viewers, so
// an admin's cached (unmasked) responses must never be served to a support login in the same tab.
// VeloxVerse also audits every read, so lists keep a ≥ 30s staleTime instead of refetching.
const LIST_STALE = 30_000

function useAuditKey() {
  const role = useAuthStore((s) => s.user?.role ?? 'anon')
  return (...parts: unknown[]) => ['vv-audit', role, ...parts]
}

export function useVVAuditMeta() {
  const key = useAuditKey()
  return useQuery({ queryKey: key('meta'), queryFn: () => vvAuditService.meta(), staleTime: 60 * 60_000 })
}

export function useVVAuditEvents(filters: AuditEventFilters, options: { enabled?: boolean; limit?: number } = {}) {
  const key = useAuditKey()
  return useInfiniteQuery({
    queryKey: key('events', filters, options.limit ?? 50),
    queryFn: ({ pageParam }) => vvAuditService.events(filters, { limit: options.limit ?? 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE,
    enabled: options.enabled ?? true,
  })
}

export function useVVAuditEvent(id: string | null | undefined) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('event', id), queryFn: () => vvAuditService.event(id!), enabled: Boolean(id), staleTime: LIST_STALE, retry: false })
}

export function useVVAuditTrace(requestId: string | undefined) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('trace', requestId), queryFn: () => vvAuditService.trace(requestId!), enabled: Boolean(requestId), staleTime: LIST_STALE })
}

export function useVVAuditJourney(journeyId: string | undefined) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('journey', journeyId), queryFn: () => vvAuditService.journey(journeyId!), enabled: Boolean(journeyId), staleTime: LIST_STALE })
}

export function useVVAuditTimeline(kind: 'user' | 'guest', id: string | undefined, filters: AuditTimelineFilters = {}) {
  const key = useAuditKey()
  return useInfiniteQuery({
    queryKey: key('timeline', kind, id, filters),
    queryFn: ({ pageParam }) => vvAuditService.timeline(kind, id!, filters, { limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(id),
    staleTime: LIST_STALE,
  })
}

export function useVVAuditBookingTrail(referenceType: string | undefined, referenceId: string | null | undefined) {
  const key = useAuditKey()
  return useQuery({
    queryKey: key('booking', referenceType, referenceId),
    queryFn: () => vvAuditService.bookingTrail(referenceType!, referenceId!),
    enabled: Boolean(referenceType && referenceId),
    staleTime: LIST_STALE,
  })
}

/** Live — refreshes every 60s (VeloxVerse rate limits: never faster). */
export function useVVAuditStuck(rules?: string[]) {
  const key = useAuditKey()
  return useQuery({
    queryKey: key('stuck', rules ?? []),
    queryFn: () => vvAuditService.stuck({ rules }),
    refetchInterval: 60_000,
    staleTime: LIST_STALE,
    placeholderData: keepPreviousData,
  })
}

export function useVVAuditErrors(params: { from?: string; to?: string; service?: string[] }) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('errors', params), queryFn: () => vvAuditService.errorsSummary(params), staleTime: LIST_STALE, placeholderData: keepPreviousData })
}

export function useVVAuditFunnel(params: { service?: string; from?: string; to?: string }) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('funnel', params), queryFn: () => vvAuditService.funnel(params), staleTime: LIST_STALE, placeholderData: keepPreviousData })
}

export function useVVAuditSummaries(params: { from?: string; to?: string; service?: string }) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('summaries', params), queryFn: () => vvAuditService.dailySummaries(params), staleTime: 5 * 60_000, placeholderData: keepPreviousData })
}

export function useVVAuditAlerts(params: { status?: 'open' | 'resolved' | 'all'; type?: string; from?: string; to?: string; limit?: number }) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('alerts', params), queryFn: () => vvAuditService.alerts(params), staleTime: LIST_STALE, placeholderData: keepPreviousData })
}

// ── Admin only ───────────────────────────────────────────────────────

export function useVVAuditSettings(enabled = true) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('settings'), queryFn: () => vvAuditService.getSettings(), enabled, retry: false })
}

export function useVVAuditUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AuditSettingsUpdate) => vvAuditService.updateSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-audit'] }),
  })
}

export function useVVAuditRecipients(enabled = true) {
  const key = useAuditKey()
  return useQuery({ queryKey: key('recipients'), queryFn: () => vvAuditService.recipients(), enabled, retry: false })
}

export function useVVAuditSaveRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: AlertRecipientInput }) =>
      id ? vvAuditService.updateRecipient(id, body) : vvAuditService.createRecipient(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-audit'] }),
  })
}

export function useVVAuditDeleteRecipient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vvAuditService.deleteRecipient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-audit'] }),
  })
}

export function useVVAuditTestRecipient() {
  return useMutation({ mutationFn: (id: string) => vvAuditService.testRecipient(id) })
}

export function useVVAuditExport() {
  return useMutation({ mutationFn: (filters: AuditEventFilters) => vvAuditService.exportCsv(filters) })
}
