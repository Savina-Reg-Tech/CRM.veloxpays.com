import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../employeeService'
import type { CreateEmployeePayload } from '@/types'
import { useToast } from '@/app/providers/ToastProvider'

export function useCreateEmployee(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => employeeService.create(payload),
    onSuccess: (createdUser) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending-count'] })
      showToast({
        type: 'success',
        title: `${createdUser.role.replace(/_/g, ' ')} created`,
        message: `${createdUser.name} was added. They cannot sign in until onboarding is approved.`,
      })
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to create user. Please try again.'
      showToast({
        type: 'error',
        title: 'User creation failed',
        message,
      })
    },
  })
}
