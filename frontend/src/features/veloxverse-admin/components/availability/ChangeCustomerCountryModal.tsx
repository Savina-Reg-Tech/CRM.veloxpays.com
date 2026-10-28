import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { auditErrorText } from '../../audit'
import { useVVAvailability, useVVSetCustomerCountry } from '../../hooks/useVVAvailability'
import { CountrySelect } from './AvailabilityUI'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  current: string | null
}

const REASON_MAX = 500

/** Set / correct / clear a customer's account country (full-screen below `sm`, centred above). */
export default function ChangeCustomerCountryModal({ open, onClose, userId, current }: Props) {
  const overview = useVVAvailability()
  const setCountry = useVVSetCustomerCountry()
  const { showToast } = useToast()
  const [country, setCountryValue] = useState(current ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const unchanged = (country || null) === (current || null)

  const onSave = async () => {
    setError('')
    try {
      await setCountry.mutateAsync({ userId, country: country || null, reason: reason.trim() || undefined })
      showToast({ type: 'success', title: 'Country updated' })
      onClose()
    } catch (err) {
      setError(auditErrorText(err, 'Could not update the country.'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change account country"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={setCountry.isPending}>Cancel</Button>
          <Button onClick={onSave} loading={setCountry.isPending} disabled={unchanged || !overview.data}>
            {country ? 'Save' : 'Clear country'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="vv-customer-country" className="mb-1.5 block text-sm font-medium text-gray-700">Country</label>
          {overview.isLoading ? (
            <Skeleton className="h-10" />
          ) : (
            <CountrySelect
              id="vv-customer-country"
              value={country}
              onChange={setCountryValue}
              countries={overview.data?.countries ?? []}
              emptyLabel="Clear (use where they browse from)"
            />
          )}
        </div>
        <div>
          <label htmlFor="vv-customer-country-reason" className="mb-1.5 block text-sm font-medium text-gray-700">Reason (optional)</label>
          <textarea
            id="vv-customer-country-reason"
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer moved to Australia — ticket #1234"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm"
          />
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          This decides which services this customer can use. Customers can&apos;t change it themselves once it is set.
        </p>
        {(error || overview.isError) && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error || auditErrorText(overview.error, 'Could not load the country list.')}
          </p>
        )}
      </div>
    </Modal>
  )
}
