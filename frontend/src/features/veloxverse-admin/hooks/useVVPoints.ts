import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvPointsService, vvReferralConfigService } from '../vvAdminService'

// ── Earning Rules ──────────────────────────────────────────────────

export function useVVPointsConfig() {
  return useQuery({
    queryKey: ['vv-points', 'config'],
    queryFn: () => vvPointsService.getConfig(),
  })
}

export function useVVUpdatePointsConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { pointsPerUnit?: number; isActive?: boolean; description?: string } }) =>
      vvPointsService.updateConfig(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points'] }),
  })
}

// ── Global Settings ────────────────────────────────────────────────

export function useVVPointsSettings() {
  return useQuery({
    queryKey: ['vv-points', 'settings'],
    queryFn: () => vvPointsService.getSettings(),
  })
}

export function useVVUpdatePointsSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof vvPointsService.updateSettings>[0]) =>
      vvPointsService.updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points'] }),
  })
}

// ── User Points ────────────────────────────────────────────────────

export function useVVPointsUsers(page: number, search?: string) {
  return useQuery({
    queryKey: ['vv-points', 'users', page, search ?? ''],
    queryFn: () => vvPointsService.listUsers(page, search),
    placeholderData: (prev) => prev,
  })
}

export function useVVUserPoints(userId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['vv-points', 'user', userId, page],
    queryFn: () => vvPointsService.getUserPoints(userId!, page),
    enabled: !!userId,
  })
}

export function useVVAdjustPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) =>
      vvPointsService.adjustPoints(userId, amount, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points'] }),
  })
}

export function useVVRecalculateBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => vvPointsService.recalculate(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points'] }),
  })
}

// ── Audit Log ──────────────────────────────────────────────────────

export function useVVPointsAuditLog(page: number) {
  return useQuery({
    queryKey: ['vv-points', 'audit', page],
    queryFn: () => vvPointsService.getAuditLog(page),
    placeholderData: (prev) => prev,
  })
}

// ── Dashboard ──────────────────────────────────────────────────────

export function useVVPointsDashboard() {
  return useQuery({
    queryKey: ['vv-points', 'dashboard'],
    queryFn: () => vvPointsService.getDashboard(),
  })
}

// ── Refer & Earn config (per-currency points) ─────────────────────
// CRM is the source of truth: each row is a direct, admin-set points count for one supported
// preferred currency (referrer + referee sides) — VeloxVerse applies the row matching each
// recipient's own preferred currency at award time. See referralPointsConfig.admin.service.ts.

export function useVVReferralConfig() {
  return useQuery({
    queryKey: ['vv-points', 'referral-config'],
    queryFn: () => vvReferralConfigService.getConfig(),
  })
}

export function useVVUpdateReferralConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: { referrerPoints?: number; refereePoints?: number; isActive?: boolean }
    }) => vvReferralConfigService.updateConfig(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points', 'referral-config'] }),
  })
}

export function useVVCreateReferralConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { currency: string; referrerPoints: number; refereePoints: number }) =>
      vvReferralConfigService.createConfig(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-points', 'referral-config'] }),
  })
}
