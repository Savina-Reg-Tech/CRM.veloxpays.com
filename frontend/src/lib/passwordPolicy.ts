import { z } from 'zod'

/** Keep in sync with backend `passwordPolicy.js` */
export const PASSWORD_POLICY_HINT =
  'Use 10–128 characters with uppercase, lowercase, a number, and a special character (!@#$%…). No leading/trailing spaces.'

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/\\~`"']/

export const passwordFieldSchema = z
  .string()
  .min(1, 'Password is required')
  .refine((v) => v === v.trim(), { message: 'Password must not have leading or trailing spaces' })
  .refine((v) => v.length >= 10 && v.length <= 128, {
    message: 'Password must be between 10 and 128 characters',
  })
  .refine((v) => /[A-Z]/.test(v), { message: 'Include at least one uppercase letter' })
  .refine((v) => /[a-z]/.test(v), { message: 'Include at least one lowercase letter' })
  .refine((v) => /\d/.test(v), { message: 'Include at least one number' })
  .refine((v) => SPECIAL_RE.test(v), {
    message: 'Include at least one special character (!@#$%^&*…)',
  })
