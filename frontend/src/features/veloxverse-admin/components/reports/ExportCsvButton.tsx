import { useState } from 'react'
import { Download } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { auditErrorText } from '../../audit'
import type { CsvExportResult } from '../../auditTypes'

/**
 * Downloads the list's CSV with its current filters (see `downloadVVCsv`) and says how many rows
 * came back — or that the 10,000-row cap cut it short.
 */
export default function ExportCsvButton({
  onExport,
  disabled,
  className,
}: {
  onExport: () => Promise<CsvExportResult>
  disabled?: boolean
  className?: string
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const res = await onExport()
      showToast({
        type: 'success',
        title: 'Export downloaded',
        message: res.truncated
          ? `Only the newest 10,000 rows were exported — narrow the dates or filters to get the rest. (${res.filename})`
          : `${res.rows.toLocaleString()} rows · ${res.filename}`,
      })
    } catch (err) {
      showToast({ type: 'error', title: 'Export failed', message: auditErrorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void run()} loading={busy} disabled={disabled} className={className}>
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  )
}
