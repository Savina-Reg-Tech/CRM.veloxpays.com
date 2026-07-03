import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { verificationApi, type ListReviewParams } from '../verificationService'
import { useToast } from '@/app/providers/ToastProvider'
import type { DocumentStatus } from '@/types'

const errMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

// ── Pending count for header badge ─────────────────────────────────
export function usePendingVerificationCount(enabled = true) {
  return useQuery({
    queryKey: ['verification', 'pending-count'],
    queryFn: () => verificationApi.getPendingVerificationCount(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ── Acting user ────────────────────────────────────────────────────
export function useVerificationMeta() {
  return useQuery({
    queryKey: ['verification', 'meta'],
    queryFn: () => verificationApi.getMeta(),
    staleTime: 5 * 60_000,
  })
}

export function useMyProgress() {
  return useQuery({
    queryKey: ['verification', 'my-progress'],
    queryFn: () => verificationApi.getMyProgress(),
    staleTime: 10_000,
  })
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ['verification', 'my-documents'],
    queryFn: () => verificationApi.getMyDocuments(),
    staleTime: 10_000,
  })
}

export function useUploadDocument(onSuccess?: () => void) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ docType, file, customLabel }: { docType: string; file: File; customLabel?: string }) =>
      verificationApi.upload(docType, file, customLabel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification', 'my-progress'] })
      qc.invalidateQueries({ queryKey: ['verification', 'my-documents'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      showToast({ type: 'success', title: 'Uploaded', message: 'Document submitted for review.' })
      onSuccess?.()
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Upload failed', message: errMessage(err, 'Upload failed.') }),
  })
}

// ── Moderator review portal ────────────────────────────────────────
export function useReviewQueue(params: ListReviewParams & { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 20, ...rest } = params
  return useQuery({
    queryKey: ['verification', 'review', { page, pageSize, ...rest }],
    queryFn: () =>
      verificationApi.listForReview({ ...rest, limit: pageSize, offset: (page - 1) * pageSize }),
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })
}

export function useVerificationDetail(userId: number | null) {
  return useQuery({
    queryKey: ['verification', 'detail', userId],
    queryFn: () => verificationApi.getUserDetail(userId as number),
    enabled: userId != null && userId > 0,
  })
}

function useReviewInvalidation() {
  const qc = useQueryClient()
  return (userId?: number) => {
    qc.invalidateQueries({ queryKey: ['verification', 'review'] })
    if (userId) qc.invalidateQueries({ queryKey: ['verification', 'detail', userId] })
    qc.invalidateQueries({ queryKey: ['approvals', 'pending-count'] })
    qc.invalidateQueries({ queryKey: ['employees'] })
  }
}

export function useReviewDocument(userId: number) {
  const invalidate = useReviewInvalidation()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ documentId, to_status, note }: { documentId: number; to_status: DocumentStatus; note?: string }) =>
      verificationApi.reviewDocument(documentId, { to_status, note }),
    onSuccess: () => {
      invalidate(userId)
      showToast({ type: 'success', title: 'Updated', message: 'Document review saved.' })
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Error', message: errMessage(err, 'Review failed.') }),
  })
}

export function useActivateAccount(userId: number) {
  const invalidate = useReviewInvalidation()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: () => verificationApi.activate(userId),
    onSuccess: () => {
      invalidate(userId)
      showToast({ type: 'success', title: 'Activated', message: 'Account activated.' })
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Error', message: errMessage(err, 'Activation failed.') }),
  })
}

export function useSuspendAccount(userId: number) {
  const invalidate = useReviewInvalidation()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (note?: string) => verificationApi.suspend(userId, note),
    onSuccess: () => {
      invalidate(userId)
      showToast({ type: 'success', title: 'Suspended', message: 'Account suspended.' })
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Error', message: errMessage(err, 'Suspend failed.') }),
  })
}

export function useRejectVerification(userId: number) {
  const invalidate = useReviewInvalidation()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: (note: string) => verificationApi.reject(userId, note),
    onSuccess: () => {
      invalidate(userId)
      showToast({ type: 'success', title: 'Rejected', message: 'Verification rejected.' })
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Error', message: errMessage(err, 'Reject failed.') }),
  })
}
