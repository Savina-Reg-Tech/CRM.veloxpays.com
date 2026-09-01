import api from '@/lib/axios'
import type { ApiResponse, Paginated } from '@/types'
import type {
  Form, FormSubmission, Lead, BlockedDomain,
  CreateFormPayload, UpdateFormPayload, EmbedCodes,
  GlobalStats, DailyCount, LeadStatus,
  FormTemplate, CreateFormTemplatePayload, UpdateFormTemplatePayload,
  WebhookDelivery,
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

  /** Authenticated download URL for a file-type answer on a FormSubmission — mirrors
   * verificationApi.fileUrl's pattern (a plain `<a href>`, cookie session auth carries over on
   * the navigation; see SubmissionDataView's `fileUrl` prop). */
  submissionFileUrl: (formId: number, submissionId: number, fieldId: string): string =>
    `${api.defaults.baseURL}${BASE}/${formId}/submissions/${submissionId}/files/${encodeURIComponent(fieldId)}`,

  getAnalytics: async (formId: number) => {
    const res = await api.get<ApiResponse<{ daily: DailyCount[]; globalStats: Record<string, number> }>>(`${BASE}/${formId}/analytics`)
    return res.data.data
  },

  // ── Webhook delivery log ────────────────────────────────────────
  listWebhookDeliveries: async (formId: number, params?: { limit?: number; offset?: number }) => {
    const res = await api.get<ApiResponse<Paginated<WebhookDelivery>>>(`${BASE}/${formId}/webhook-deliveries`, { params })
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

  /** Authenticated download URL for a file-type answer on a Lead — a separate route from
   * submissionFileUrl because a Lead's submission_data is its own independent copy taken at
   * submit time (see the CRM backend's models/Lead.js), not a live join back to the originating
   * FormSubmission row. */
  leadFileUrl: (leadId: number, fieldId: string): string =>
    `${api.defaults.baseURL}${BASE}/leads/${leadId}/files/${encodeURIComponent(fieldId)}`,

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

  // ── Design templates (global, shared theme presets) ────────────
  listTemplates: async () => {
    const res = await api.get<ApiResponse<FormTemplate[]>>(`${BASE}/templates`)
    return res.data.data
  },

  createTemplate: async (payload: CreateFormTemplatePayload) => {
    const res = await api.post<ApiResponse<FormTemplate>>(`${BASE}/templates`, payload)
    return res.data.data
  },

  updateTemplate: async (id: number, payload: UpdateFormTemplatePayload) => {
    const res = await api.patch<ApiResponse<FormTemplate>>(`${BASE}/templates/${id}`, payload)
    return res.data.data
  },

  deleteTemplate: async (id: number) => {
    await api.delete(`${BASE}/templates/${id}`)
  },
}
