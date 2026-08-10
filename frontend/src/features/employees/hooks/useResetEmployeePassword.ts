import { useMutation } from '@tanstack/react-query'
import { employeeService } from '../employeeService'
import { useToast } from '@/app/providers/ToastProvider'

export interface ResetPasswordArgs {
  id: number
  password?: string
}

export function useResetEmployeePassword() {
  const { showToast } = useToast()

  return useMutation({
    mutationFn: ({ id, password }: ResetPasswordArgs) =>
      employeeService.resetPassword(id, password),
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to reset password. Please try again.'
      showToast({
        type: 'error',
        title: 'Password reset failed',
        message,
      })
    },
  })
}
