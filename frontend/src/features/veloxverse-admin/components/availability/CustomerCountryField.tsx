import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { countryFlag } from '../../availability'
import { useVVCustomerCountry } from '../../hooks/useVVAvailability'
import ChangeCustomerCountryModal from './ChangeCustomerCountryModal'
import { formatWhen } from './AvailabilityUI'

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

function nameOf(code: string, fallback?: string | null): string {
  if (fallback) return fallback
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

interface Props {
  userId: string
  /** From the customer feed (/api/crm/customers) — used while / if the availability call fails. */
  feedCountryCode?: string | null
  feedCountry?: string | null
}

/** "Account country: 🇦🇺 Australia · set by customer" with a Change button for admins. */
export default function CustomerCountryField({ userId, feedCountryCode, feedCountry }: Props) {
  const role = useAuthStore((s) => s.user?.role)
  const canChange = role === 'super_admin' || role === 'admin'
  const query = useVVCustomerCountry(userId, canChange)
  const [open, setOpen] = useState(false)

  const code = query.data ? query.data.country : (feedCountryCode ?? null)
  const source = query.data?.countrySource
  const sourceWords = source === 'admin' ? 'set by admin' : source === 'customer' ? 'set by customer' : null

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
        <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Account country:</span>
        {code ? (
          <span className="font-medium text-gray-700">
            <span aria-hidden="true">{countryFlag(code)}</span> {nameOf(code, query.data ? null : feedCountry)}
            {sourceWords && <span className="font-normal text-gray-500"> · {sourceWords}</span>}
            {query.data?.countryUpdatedAt && <span className="font-normal text-gray-400"> · {formatWhen(query.data.countryUpdatedAt)}</span>}
          </span>
        ) : (
          <span className="text-gray-600">Not set — we use where they browse from</span>
        )}
        {canChange && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[32px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Change
          </button>
        )}
        {open && <ChangeCustomerCountryModal open onClose={() => setOpen(false)} userId={userId} current={code} />}
      </div>
      <p className="text-[11px] text-gray-400">
        Where the customer lives. They can still use services of the country they are visiting. Customers set this once; after
        that only your team can change it here.
      </p>
    </div>
  )
}
