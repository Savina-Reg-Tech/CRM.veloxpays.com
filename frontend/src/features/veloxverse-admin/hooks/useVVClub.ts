import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvClubService } from '../vvAdminService'
import type { ClubBenefits, ClubPromoDiscountType } from '../types'

// ── Tiers & Benefits ──────────────────────────────────────────────

export function useVVClubTiers() {
  return useQuery({
    queryKey: ['vv-club', 'tiers'],
    queryFn: () => vvClubService.getTiers(),
  })
}

export function useVVClubTierBenefits(tierId: string | undefined) {
  return useQuery({
    queryKey: ['vv-club', 'tier-benefits', tierId],
    queryFn: () => vvClubService.getTierBenefits(tierId!),
    enabled: !!tierId,
  })
}

export function useVVUpdateClubTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tierId, patch }: { tierId: string; patch: { annualFeeCents?: number; isActive?: boolean } }) =>
      vvClubService.updateTier(tierId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-club'] }),
  })
}

export function useVVUpdateClubTierBenefits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tierId, benefits, changeNote }: { tierId: string; benefits: ClubBenefits; changeNote?: string }) =>
      vvClubService.updateTierBenefits(tierId, benefits, changeNote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-club'] }),
  })
}

// ── Members ───────────────────────────────────────────────────────

export function useVVClubMembers(page: number, filters: { tierSlug?: string; status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['vv-club', 'members', page, filters],
    queryFn: () => vvClubService.listMembers({ page, ...filters }),
    placeholderData: (prev) => prev,
  })
}

export function useVVClubMember(userId: string | undefined) {
  return useQuery({
    queryKey: ['vv-club', 'member', userId],
    queryFn: () => vvClubService.getMember(userId!),
    enabled: !!userId,
  })
}

export function useVVClubForceCancel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      vvClubService.forceCancel(userId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-club'] }),
  })
}

// ── Promo Codes ───────────────────────────────────────────────────

export function useVVClubPromos() {
  return useQuery({
    queryKey: ['vv-club', 'promos'],
    queryFn: () => vvClubService.listPromos(),
  })
}

export function useVVCreateClubPromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      code: string; discountType: ClubPromoDiscountType; discountValue: number;
      maxDiscountCents?: number | null; applicableTiers?: string[]; maxUses?: number | null;
      maxUsesPerUser?: number; firstPurchaseOnly?: boolean; isActive?: boolean;
      startsAt?: string | null; expiresAt?: string | null;
    }) => vvClubService.createPromo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-club', 'promos'] }),
  })
}

export function useVVUpdateClubPromo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      vvClubService.updatePromo(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vv-club', 'promos'] }),
  })
}

// ── Analytics ─────────────────────────────────────────────────────

export function useVVClubAnalytics() {
  return useQuery({
    queryKey: ['vv-club', 'analytics'],
    queryFn: () => vvClubService.getAnalytics(),
  })
}

// ── Change Log ────────────────────────────────────────────────────

export function useVVClubChangeLog(page: number) {
  return useQuery({
    queryKey: ['vv-club', 'change-log', page],
    queryFn: () => vvClubService.getChangeLog(page),
    placeholderData: (prev) => prev,
  })
}
