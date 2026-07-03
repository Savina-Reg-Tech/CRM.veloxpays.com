import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { useLogin } from '../hooks/useLogin'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function LoginForm() {
  const { form, onSubmit, serverError, isSubmitting } = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    formState: { errors },
  } = form

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Enter your credentials to continue
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{serverError}</p>
        </div>
      )}

      {/* Email */}
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        leftIcon={<Mail size={16} />}
        error={errors.email?.message}
        {...register('email')}
      />

      {/* Password */}
      <Input
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="••••••••"
        leftIcon={<Lock size={16} />}
        rightIcon={
          <button
            type="button"
            className="pointer-events-auto text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        error={errors.password?.message}
        {...register('password')}
      />

      <Button
        type="submit"
        loading={isSubmitting}
        className="w-full mt-2"
        size="lg"
      >
        Sign in
      </Button>
    </form>
  )
}
