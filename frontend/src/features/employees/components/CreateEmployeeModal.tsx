import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useCreateEmployee } from '../hooks/useCreateEmployee'
import { useAuthStore } from '@/store/authStore'
import { ROLE_CREATION_RIGHTS } from '@/config/roles'
import { PASSWORD_POLICY_HINT, passwordFieldSchema } from '@/lib/passwordPolicy'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: passwordFieldSchema,
  role: z.enum(['super_admin', 'admin', 'employee', 'agent', 'affiliate']),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateEmployeeModal({ open, onClose }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const createEmployee = useCreateEmployee(onClose)
  const creatorRole = useAuthStore((s) => s.user?.role ?? 'employee')
  const roleOptions = ROLE_CREATION_RIGHTS[creatorRole]
  const canCreateUsers = roleOptions.length > 0

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: roleOptions[0] ?? 'affiliate' },
  })

  const handleClose = () => {
    setShowPassword(false)
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    if (!canCreateUsers) return
    await createEmployee.mutateAsync(data)
    setShowPassword(false)
    reset()
  })

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add New User"
      description="Create a new CRM user account with a role based on your permissions."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-employee-form"
            loading={isSubmitting || createEmployee.isPending}
            disabled={!canCreateUsers}
          >
            Create User
          </Button>
        </>
      }
    >
      <form id="create-employee-form" onSubmit={onSubmit} className="space-y-4">
        {/* Server error */}
        {createEmployee.isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-600">
              {(createEmployee.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Something went wrong. Please try again.'}
            </p>
          </div>
        )}

        <div className="w-full">
          <label
            htmlFor="role"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Role
          </label>
          <select
            id="role"
            disabled={!canCreateUsers}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
            {...register('role')}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {errors.role?.message && (
            <p className="mt-1.5 text-xs text-red-500">{errors.role.message}</p>
          )}
          {!canCreateUsers && (
            <p className="mt-1.5 text-xs text-gray-500">
              Your role does not have permission to create users.
            </p>
          )}
        </div>

        <Input
          label="Full Name"
          placeholder="Jane Smith"
          leftIcon={<User size={16} />}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="jane@company.com"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
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
          error={errors.password?.message}
          helperText={PASSWORD_POLICY_HINT}
          {...register('password')}
        />
      </form>
    </Modal>
  )
}
