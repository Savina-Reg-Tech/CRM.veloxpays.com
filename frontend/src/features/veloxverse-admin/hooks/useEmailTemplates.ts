import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { emailTemplatesService } from '../vvAdminService'
import type { TemplateUpdate } from '../types'

export const TPL_KEYS = {
  all: ['pd-templates'] as const,
  list: ['pd-templates', 'list'] as const,
  one: (key: string) => ['pd-templates', 'one', key] as const,
  versions: (key: string) => ['pd-templates', 'versions', key] as const,
  preview: (key: string, body: unknown) => ['pd-templates', 'preview', key, body] as const,
}

/** Templates and the placeholder catalogue (labels for every `{{key}}`). */
export function useTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: TPL_KEYS.list,
    queryFn: () => emailTemplatesService.list(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

export function useTemplate(key: string | undefined) {
  return useQuery({
    queryKey: TPL_KEYS.one(key ?? ''),
    queryFn: () => emailTemplatesService.get(key!),
    enabled: !!key,
  })
}

export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: TemplateUpdate }) => emailTemplatesService.update(key, body),
    onSuccess: (tpl) => {
      qc.setQueryData(TPL_KEYS.one(tpl.key), tpl)
      void qc.invalidateQueries({ queryKey: TPL_KEYS.all })
    },
  })
}

export const TEMPLATE_PREVIEW_DELAY_MS = 600

/** Renders saved or unsaved text, 600 ms after the last change. */
export function useTemplatePreview(
  key: string | undefined,
  body: { orderNo?: string; subject?: string; bodyHtml?: string },
  options?: { enabled?: boolean },
) {
  const debounced = useDebounce(body, TEMPLATE_PREVIEW_DELAY_MS)
  return useQuery({
    queryKey: TPL_KEYS.preview(key ?? '', debounced),
    queryFn: () => emailTemplatesService.preview(key!, debounced),
    enabled: !!key && (options?.enabled ?? true),
    placeholderData: (prev) => prev,
    retry: false,
  })
}

export function useTemplateTest() {
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: { orderNo?: string; subject?: string; bodyHtml?: string } }) =>
      emailTemplatesService.test(key, body),
  })
}

export function useTemplateVersions(key: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: TPL_KEYS.versions(key ?? ''),
    queryFn: () => emailTemplatesService.versions(key!),
    enabled: !!key && (options?.enabled ?? true),
  })
}

export function useRestoreTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, version }: { key: string; version: number }) => emailTemplatesService.restore(key, version),
    onSuccess: (tpl) => {
      qc.setQueryData(TPL_KEYS.one(tpl.key), tpl)
      void qc.invalidateQueries({ queryKey: TPL_KEYS.all })
    },
  })
}
