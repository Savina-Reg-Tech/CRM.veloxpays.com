import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '../authService'
import { useToast } from '@/app/providers/ToastProvider'

// Login only checks that fields are non-empty; the password policy is
// validated on the backend. Re-applying the 10-char minimum here would
// just confuse legacy users who were created under an older policy.
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null)
    try {
      const { user } = await authService.login(data.email, data.password)
      setUser(user)
      showToast({
        type: 'success',
        title: 'Login successful',
        message: `Welcome back, ${user.name}.`,
      })
      navigate('/dashboard')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Invalid email or password.'
      setServerError(message)
      showToast({
        type: 'error',
        title: 'Login failed',
        message,
      })
    }
  })

  return { form, onSubmit, serverError, isSubmitting: form.formState.isSubmitting }
}
