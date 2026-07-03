import { useQuery, useMutation } from '@tanstack/react-query'
import { vvSettingsService } from '../vvAdminService'

export function useVVSettings() {
  return useQuery({
    queryKey: ['vv-settings'],
    queryFn: () => vvSettingsService.get(),
  })
}

export function useVVTestSmtp() {
  return useMutation({
    mutationFn: () => vvSettingsService.testSmtp(),
  })
}

export function useVVTestEsimApi() {
  return useMutation({
    mutationFn: () => vvSettingsService.testEsimApi(),
  })
}
