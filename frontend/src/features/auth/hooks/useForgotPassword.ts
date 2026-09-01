import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { authService } from '../authService'
import { useToast } from '@/app/providers/ToastProvider'
import { passwordFieldSchema } from '@/lib/passwordPolicy'

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
export type ForgotPasswordEmailValues = z.infer<typeof emailSchema>

const resetSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
export type ResetPasswordValues = z.infer<typeof resetSchema>

/**
 * Drives the two-step "Forgot password" flow: request a 6-digit OTP by
 * email, then submit that code + a new password. Kept as one hook (rather
 * than one per step) so the email captured in step 1 carries into step 2
 * without a route param or extra state elsewhere.
 */
export function useForgotPassword() {
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const emailForm = useForm<ForgotPasswordEmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  })

  const onRequestSubmit = emailForm.handleSubmit(async (data) => {
    setRequestError(null)
    try {
      const message = await authService.forgotPassword(data.email)
      setEmail(data.email)
      setStep('reset')
      showToast({ type: 'success', title: 'Check your email', message })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.'
      setRequestError(message)
      showToast({ type: 'error', title: 'Error', message })
    }
  })

  const onResetSubmit = resetForm.handleSubmit(async (data) => {
    setResetError(null)
    try {
      const message = await authService.resetPassword(email, data.otp, data.newPassword)
      showToast({ type: 'success', title: 'Password reset', message })
      navigate('/login')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'That code is invalid or has expired. Request a new one.'
      setResetError(message)
      showToast({ type: 'error', title: 'Error', message })
    }
  })

  /** Back to step 1 — e.g. wrong email, or the code expired before they used it. */
  const backToEmail = () => {
    setResetError(null)
    resetForm.reset()
    setStep('email')
  }

  /** Re-send a fresh code to the same email without retyping it. */
  const resendCode = async () => {
    setResetError(null)
    try {
      const message = await authService.forgotPassword(email)
      showToast({ type: 'success', title: 'Code sent', message })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.'
      showToast({ type: 'error', title: 'Error', message })
    }
  }

  return {
    step,
    email,
    emailForm,
    resetForm,
    onRequestSubmit,
    onResetSubmit,
    requestError,
    resetError,
    backToEmail,
    resendCode,
    isRequestSubmitting: emailForm.formState.isSubmitting,
    isResetSubmitting: resetForm.formState.isSubmitting,
  }
}
