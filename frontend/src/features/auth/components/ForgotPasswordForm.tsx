import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, KeyRound, Lock } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useForgotPassword } from '../hooks/useForgotPassword'
import { PASSWORD_POLICY_HINT } from '@/lib/passwordPolicy'

export default function ForgotPasswordForm() {
  const {
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
    isRequestSubmitting,
    isResetSubmitting,
  } = useForgotPassword()
  const [showPassword, setShowPassword] = useState(false)

  if (step === 'email') {
    const { register, formState } = emailForm
    return (
      <form onSubmit={onRequestSubmit} className="space-y-5" noValidate>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Forgot password?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter your account email and we'll send you a 6-digit code to reset it.
          </p>
        </div>

        {requestError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-600">{requestError}</p>
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          leftIcon={<Mail size={16} />}
          error={formState.errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" loading={isRequestSubmitting} className="w-full mt-2" size="lg">
          Send reset code
        </Button>

        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </form>
    )
  }

  const { register, formState } = resetForm
  return (
    <form onSubmit={onResetSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Enter your code</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          We sent a 6-digit code to <span className="font-medium text-gray-700">{email}</span>. It
          expires in 10 minutes.
        </p>
      </div>

      {resetError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{resetError}</p>
        </div>
      )}

      <Input
        label="6-digit code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        leftIcon={<KeyRound size={16} />}
        error={formState.errors.otp?.message}
        {...register('otp')}
      />

      <Input
        label="New password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Strong password (see requirements)"
        leftIcon={<Lock size={16} />}
        rightIcon={
          <button
            type="button"
            className="pointer-events-auto text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        error={formState.errors.newPassword?.message}
        helperText={PASSWORD_POLICY_HINT}
        {...register('newPassword')}
      />

      <Input
        label="Confirm new password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Re-enter your new password"
        leftIcon={<Lock size={16} />}
        error={formState.errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" loading={isResetSubmitting} className="w-full mt-2" size="lg">
        Reset password
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={backToEmail}
          className="text-gray-500 hover:text-gray-700"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={resendCode}
          className="text-indigo-600 hover:underline font-medium"
        >
          Resend code
        </button>
      </div>
    </form>
  )
}
