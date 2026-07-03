import api from '@/lib/axios'
import type { ApiResponse, Paginated } from '@/types'
import type {
  Form, FormSubmission, Lead, BlockedDomain,
  CreateFormPayload, UpdateFormPayload, EmbedCodes,
  GlobalStats, DailyCount, LeadStatus,
} from './types'

const BASE = '/forms'

export const formApi = {
  // ── Forms CRUD ────────────────────────────────────────────────
  list: async (params?: { limit?: number; offset?: number; status?: string }) => {
    const res = await api.get<ApiResponse<Paginated<Form>>>(`${BASE}`, { params })
    return res.data.data
  },

  get: async (id: number) => {
    const res = await api.get<ApiResponse<Form>>(`${BASE}/${id}`)
    return res.data.data
  },

  create: async (payload: CreateFormPayload) => {
    const res = await api.post<ApiResponse<Form>>(`${BASE}`, payload)
    return res.data.data
  },

  update: async (id: number, payload: UpdateFormPayload) => {
    const res = await api.patch<ApiResponse<Form>>(`${BASE}/${id}`, payload)
    return res.data.data
  },

  delete: async (id: number) => {
    await api.delete(`${BASE}/${id}`)
  },

  getEmbedCodes: async (id: number) => {
    const res = await api.get<ApiResponse<EmbedCodes>>(`${BASE}/${id}/embed`)
    return res.data.data
  },

  // ── Submissions ───────────────────────────────────────────────
  listSubmissions: async (formId: number, params?: { limit?: number; offset?: number; status?: string }) => {
    const res = await api.get<ApiResponse<Paginated<FormSubmission>>>(`${BASE}/${formId}/submissions`, { params })
    return res.data.data
  },

  getAnalytics: async (formId: number) => {
    const res = await api.get<ApiResponse<{ daily: DailyCount[]; globalStats: Record<string, number> }>>(`${BASE}/${formId}/analytics`)
    return res.data.data
  },

  // ── Global stats ──────────────────────────────────────────────
  getGlobalStats: async () => {
    const res = await api.get<ApiResponse<GlobalStats>>(`${BASE}/stats`)
    return res.data.data
  },

  // ── Leads ─────────────────────────────────────────────────────
  listLeads: async (params?: { limit?: number; offset?: number; status?: string; form_id?: number; search?: string }) => {
    const res = await api.get<ApiResponse<Paginated<Lead>>>(`${BASE}/leads/all`, { params })
    return res.data.data
  },

  getLead: async (id: number) => {
    const res = await api.get<ApiResponse<Lead>>(`${BASE}/leads/${id}`)
    return res.data.data
  },

  updateLeadStatus: async (id: number, status: LeadStatus) => {
    const res = await api.patch<ApiResponse<Lead>>(`${BASE}/leads/${id}/status`, { status })
    return res.data.data
  },

  getLeadStats: async () => {
    const res = await api.get<ApiResponse<GlobalStats['leads']>>(`${BASE}/leads/stats`)
    return res.data.data
  },

  // ── Blocked domains ───────────────────────────────────────────
  listDomains: async () => {
    const res = await api.get<ApiResponse<{ items: BlockedDomain[]; total: number }>>(`${BASE}/email-domains/list`)
    return res.data.data
  },

  addDomain: async (domain: string) => {
    const res = await api.post<ApiResponse<BlockedDomain>>(`${BASE}/email-domains`, { domain })
    return res.data.data
  },

  deleteDomain: async (id: number) => {
    await api.delete(`${BASE}/email-domains/${id}`)
  },
}
