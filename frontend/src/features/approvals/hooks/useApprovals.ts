import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { approvalsApi, type ListApprovalsParams } from '../approvalService'
import { useToast } from '@/app/providers/ToastProvider'
import type { ApprovalRequestStatus } from '@/types'

type TransitionVars = { id: number; to_status: ApprovalRequestStatus; note?: string }

const PENDING_COUNT_KEY = ['approvals', 'pending-count'] as const

export function usePendingApprovalsCount(enabled = true) {
  return useQuery({
    queryKey: [...PENDING_COUNT_KEY],
    queryFn: () => approvalsApi.getPendingCount(),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useApprovals(params: ListApprovalsParams & { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 20, ...rest } = params
  const limit = pageSize
  const offset = (page - 1) * pageSize

  return useQuery({
    queryKey: ['approvals', { page, pageSize, ...rest }],
    queryFn: () => approvalsApi.list({ ...rest, limit, offset }),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })
}

export function useApprovalDetail(id: number | null) {
  return useQuery({
    queryKey: ['approvals', id],
    queryFn: () => approvalsApi.getById(id as number),
    enabled: id != null && id > 0,
  })
}

export function useCreateApprovalRequest(onSuccess?: () => void) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: approvalsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: [...PENDING_COUNT_KEY] })
      showToast({ type: 'success', title: 'Request submitted', message: 'Approval request created.' })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create request.'
      showToast({ type: 'error', title: 'Error', message })
    },
  })
}

export function useTransitionApproval(onSettled?: () => void) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ id, ...body }: TransitionVars) => approvalsApi.transition(id, body),
    onSuccess: (_data: unknown, variables: TransitionVars) => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['approvals', variables.id] })
      qc.invalidateQueries({ queryKey: [...PENDING_COUNT_KEY] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      showToast({ type: 'success', title: 'Updated', message: 'Approval status updated.' })
    },
    onSettled: () => {
      onSettled?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Update failed.'
      showToast({ type: 'error', title: 'Error', message })
    },
  })
}
