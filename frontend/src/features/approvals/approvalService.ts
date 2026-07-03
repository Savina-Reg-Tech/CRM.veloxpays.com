import api from '@/lib/axios'
import type {
  ApiResponse,
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestStatus,
  CreateApprovalRequestPayload,
  Paginated,
} from '@/types'

export interface ListApprovalsParams {
  limit?: number
  offset?: number
  mine?: boolean
  status?: ApprovalRequestStatus
  kind?: string
}

export const approvalsApi = {
  listKinds: async (): Promise<string[]> => {
    const res = await api.get<ApiResponse<string[]>>('/approvals/meta/kinds')
    return res.data.data
  },

  listStatuses: async (): Promise<string[]> => {
    const res = await api.get<ApiResponse<string[]>>('/approvals/meta/statuses')
    return res.data.data
  },

  getPendingCount: async (): Promise<number> => {
    const res = await api.get<ApiResponse<{ count: number }>>('/approvals/meta/pending-count')
    return res.data.data.count
  },

  list: async (params: ListApprovalsParams = {}): Promise<Paginated<ApprovalRequest>> => {
    const res = await api.get<ApiResponse<Paginated<ApprovalRequest>>>('/approvals', {
      params: {
        limit: params.limit,
        offset: params.offset,
        status: params.status,
        kind: params.kind,
        ...(params.mine === true ? { mine: '1' } : {}),
      },
    })
    return res.data.data
  },

  getById: async (id: number): Promise<ApprovalRequestDetail> => {
    const res = await api.get<ApiResponse<ApprovalRequestDetail>>(`/approvals/${id}`)
    return res.data.data
  },

  create: async (payload: CreateApprovalRequestPayload): Promise<ApprovalRequest> => {
    const res = await api.post<ApiResponse<ApprovalRequest>>('/approvals', payload)
    return res.data.data
  },

  transition: async (
    id: number,
    payload: { to_status: ApprovalRequestStatus; note?: string }
  ): Promise<ApprovalRequest> => {
    const res = await api.patch<ApiResponse<ApprovalRequest>>(
      `/approvals/${id}/status`,
      payload
    )
    return res.data.data
  },

  assign: async (
    id: number,
    payload: { assigned_to_id: number | null }
  ): Promise<ApprovalRequest> => {
    const res = await api.patch<ApiResponse<ApprovalRequest>>(
      `/approvals/${id}/assign`,
      payload
    )
    return res.data.data
  },
}
