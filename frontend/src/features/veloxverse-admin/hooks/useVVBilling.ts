import { useQuery } from '@tanstack/react-query'
import { vvBillingService } from '../vvAdminService'

export function useVVAdminBillingActivity(userId: string | undefined) {
  return useQuery({
    queryKey: ['vv-billing', 'activity', userId],
    queryFn: () => vvBillingService.getActivity(userId!),
    enabled: !!userId,
  })
}
