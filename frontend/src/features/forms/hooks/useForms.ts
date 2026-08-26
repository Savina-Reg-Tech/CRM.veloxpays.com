import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formApi } from '../formService'
import type { CreateFormPayload, UpdateFormPayload, LeadStatus, CreateFormTemplatePayload, UpdateFormTemplatePayload } from '../types'

// ── Query keys ────────────────────────────────────────────────────
export const formKeys = {
  all:         ['forms'] as const,
  lists:       () => [...formKeys.all, 'list'] as const,
  list:        (params: object) => [...formKeys.lists(), params] as const,
  details:     () => [...formKeys.all, 'detail'] as const,
  detail:      (id: number) => [...formKeys.details(), id] as const,
  stats:       () => [...formKeys.all, 'stats'] as const,
  submissions: (formId: number, params: object) => [...formKeys.all, 'submissions', formId, params] as const,
  analytics:   (formId: number) => [...formKeys.all, 'analytics', formId] as const,
  webhookDeliveries: (formId: number, params: object) => [...formKeys.all, 'webhook-deliveries', formId, params] as const,
  leads:       (params: object) => [...formKeys.all, 'leads', params] as const,
  leadStats:   () => [...formKeys.all, 'lead-stats'] as const,
  domains:     () => [...formKeys.all, 'domains'] as const,
  templates:   () => [...formKeys.all, 'templates'] as const,
}

// ── Forms ─────────────────────────────────────────────────────────
export function useForms(params?: { limit?: number; offset?: number; status?: string }) {
  return useQuery({
    queryKey: formKeys.list(params ?? {}),
    queryFn: () => formApi.list(params),
  })
}

export function useForm(id: number | null) {
  return useQuery({
    queryKey: formKeys.detail(id!),
    queryFn: () => formApi.get(id!),
    enabled: !!id,
  })
}

export function useGlobalStats() {
  return useQuery({
    queryKey: formKeys.stats(),
    queryFn: formApi.getGlobalStats,
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFormPayload) => formApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.lists() }),
  })
}

export function useUpdateForm(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateFormPayload) => formApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: formKeys.detail(id) })
      qc.invalidateQueries({ queryKey: formKeys.lists() })
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => formApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.lists() }),
  })
}

// ── Submissions ───────────────────────────────────────────────────
export function useFormSubmissions(formId: number, params?: { limit?: number; offset?: number; status?: string }) {
  return useQuery({
    queryKey: formKeys.submissions(formId, params ?? {}),
    queryFn: () => formApi.listSubmissions(formId, params),
    enabled: !!formId,
  })
}

export function useFormAnalytics(formId: number) {
  return useQuery({
    queryKey: formKeys.analytics(formId),
    queryFn: () => formApi.getAnalytics(formId),
    enabled: !!formId,
  })
}

export function useWebhookDeliveries(formId: number, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: formKeys.webhookDeliveries(formId, params ?? {}),
    queryFn: () => formApi.listWebhookDeliveries(formId, params),
    enabled: !!formId,
  })
}

// ── Leads ─────────────────────────────────────────────────────────
export function useLeads(params?: { limit?: number; offset?: number; status?: string; form_id?: number; search?: string }) {
  return useQuery({
    queryKey: formKeys.leads(params ?? {}),
    queryFn: () => formApi.listLeads(params),
  })
}

export function useLeadStats() {
  return useQuery({
    queryKey: formKeys.leadStats(),
    queryFn: formApi.getLeadStats,
  })
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: LeadStatus }) => formApi.updateLeadStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
    },
  })
}

// ── Blocked domains ───────────────────────────────────────────────
export function useBlockedDomains() {
  return useQuery({
    queryKey: formKeys.domains(),
    queryFn: formApi.listDomains,
  })
}

export function useAddDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (domain: string) => formApi.addDomain(domain),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.domains() }),
  })
}

export function useDeleteDomain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => formApi.deleteDomain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.domains() }),
  })
}

// ── Design templates ────────────────────────────────────────────────
export function useFormTemplates() {
  return useQuery({
    queryKey: formKeys.templates(),
    queryFn: formApi.listTemplates,
  })
}

export function useCreateFormTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFormTemplatePayload) => formApi.createTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.templates() }),
  })
}

export function useUpdateFormTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFormTemplatePayload }) => formApi.updateTemplate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.templates() }),
  })
}

export function useDeleteFormTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => formApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.templates() }),
  })
}
