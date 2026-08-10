import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useResetEmployeePassword } from '../hooks/useResetEmployeePassword'
import { useToast } from '@/app/providers/ToastProvider'
import { PASSWORD_POLICY_HINT, passwordFieldSchema } from '@/lib/passwordPolicy'
import type { Employee } from '@/types'

const schema = z.object({ password: passwordFieldSchema })
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  employee: Employee | null
}

export default function ResetPasswordModal({ open, onClose, employee }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const resetPassword = useResetEmployeePassword()
  const { showToast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const handleClose = () => {
    setShowPassword(false)
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!employee) return
    try {
      await resetPassword.mutateAsync({ id: employee.id, password: values.password })
      showToast({
        type: 'success',
        title: 'Password reset',
        message: `${employee.name}'s password was updated.`,
      })
      handleClose()
    } catch {
      // Error toast is already shown by the mutation's onError handler.
    }
  })

  if (!employee) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reset password"
      description={`Set a new password for ${employee.name} (${employee.email}). This immediately replaces their current password.`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={resetPassword.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="reset-password-form" loading={resetPassword.isPending}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={onSubmit}>
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Strong password (see requirements)"
          leftIcon={<KeyRound size={16} />}
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
          error={errors.password?.message}
          helperText={PASSWORD_POLICY_HINT}
          {...register('password')}
        />
      </form>
    </Modal>
  )
}
