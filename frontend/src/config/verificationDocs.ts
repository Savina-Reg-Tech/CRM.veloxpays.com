/**
 * Role-based required-documents catalog (frontend mirror of
 * backend `src/config/verificationDocs.js`). Keep the two in sync.
 */
import type { UserRole } from '@/types'

export const DOC_LABELS: Record<string, string> = {
  passport: 'Passport',
  driving_license: 'Driving License',
  proof_of_address: 'Proof of Address',
  experience_letter: 'Experience Letter',
  police_verification: 'Police Verification Certificate',
  business_registration: 'Business Registration Certificate',
  trade_license: 'Trade License',
  incorporation_certificate: 'Incorporation Certificate',
  tax_certificate: 'Tax Certificate',
  business_address_proof: 'Business Address Proof',
  business_bank_account_details: 'Business Bank Account Details',
  business_bank_statements: 'Business Bank Statements',
  bank_account_details: 'Bank Account Details',
  business_account_details: 'Business Account Details',
}

export interface RoleDocSpec {
  required: string[]
  optional: string[]
}

export const ROLE_REQUIRED_DOCUMENTS: Record<UserRole, RoleDocSpec> = {
  employee: {
    required: [
      'passport',
      'driving_license',
      'proof_of_address',
      'experience_letter',
      'police_verification',
    ],
    optional: [],
  },
  agent: {
    required: [
      'passport',
      'driving_license',
      'proof_of_address',
      'business_registration',
      'trade_license',
      'incorporation_certificate',
      'tax_certificate',
      'business_address_proof',
      'business_bank_account_details',
      'business_bank_statements',
    ],
    optional: [],
  },
  affiliate: {
    required: ['passport', 'driving_license', 'proof_of_address', 'bank_account_details'],
    optional: ['business_account_details'],
  },
  admin: { required: [], optional: [] },
  super_admin: { required: [], optional: [] },
}

export const ROLES_REQUIRING_VERIFICATION: UserRole[] = ['employee', 'agent', 'affiliate']

export function roleRequiresVerification(role: UserRole | undefined): boolean {
  return !!role && ROLES_REQUIRING_VERIFICATION.includes(role)
}

export function getRoleDocumentSpec(role: UserRole | undefined): RoleDocSpec {
  return (role && ROLE_REQUIRED_DOCUMENTS[role]) || { required: [], optional: [] }
}

export const CUSTOM_DOC_PREFIX = 'custom_'

export function isCustomDocType(docType: string): boolean {
  return docType.startsWith(CUSTOM_DOC_PREFIX)
}

export function docLabel(docType: string, customLabel?: string | null): string {
  if (customLabel) return customLabel
  return DOC_LABELS[docType] ?? docType
}
