import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vvClubService } from '../vvAdminService'
import type { ClubBenefits, ClubPriceLists, ClubPromoDiscountType } from '../types'

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
    mutationFn: ({ tierId, patch }: { tierId: string; patch: { annualFeeCents?: number; isActive?: boolean; changeNote?: string } }) =>
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

// ── Prices by country ─────────────────────────────────────────────

export function useVVClubPriceLists() {
  return useQuery({
    queryKey: ['vv-club', 'prices'],
    queryFn: () => vvClubService.getPriceLists(),
  })
}

export function useVVClubPriceHistory(page: number, limit = 30) {
  return useQuery({
    queryKey: ['vv-club', 'prices-history', page, limit],
    queryFn: () => vvClubService.getPriceHistory(page, limit),
    placeholderData: (prev) => prev,
  })
}

/** After a set/remove: show VeloxVerse's fresh panel straight away, then re-sync history and tiers
 * (a tier's "Also: …" line lists its fixed prices). */
function usePriceListSaved() {
  const qc = useQueryClient()
  return (lists: ClubPriceLists) => {
    qc.setQueryData(['vv-club', 'prices'], lists)
    qc.invalidateQueries({ queryKey: ['vv-club', 'prices'] })
    qc.invalidateQueries({ queryKey: ['vv-club', 'prices-history'] })
    qc.invalidateQueries({ queryKey: ['vv-club', 'tiers'] })
  }
}

export function useVVSetClubPriceList() {
  const onSaved = usePriceListSaved()
  return useMutation({
    mutationFn: ({ currency, prices, changeNote }: { currency: string; prices: Record<string, number>; changeNote?: string }) =>
      vvClubService.setPriceList(currency, prices, changeNote),
    onSuccess: onSaved,
  })
}

export function useVVRemoveClubPriceList() {
  const onSaved = usePriceListSaved()
  return useMutation({
    mutationFn: ({ currency, changeNote }: { currency: string; changeNote?: string }) =>
      vvClubService.removePriceList(currency, changeNote),
    onSuccess: onSaved,
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
