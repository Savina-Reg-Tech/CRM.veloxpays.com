import type { Customer } from '@/types'

export function formatCustomerLegalName(
  c: Pick<Customer, 'first_name' | 'middle_name' | 'last_name'>
): string {
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ')
}
