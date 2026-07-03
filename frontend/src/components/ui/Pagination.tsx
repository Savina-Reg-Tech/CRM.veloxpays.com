import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (next: number) => void
}

/**
 * Simple Prev / Next pagination footer.
 *
 * Designed to live below a Table — shows the current window (e.g. "1–20 of 87")
 * and disables the arrows at the boundaries. Always renders so the layout
 * doesn't jump between pages.
 */
export default function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const safePageSize = Math.max(pageSize, 1)
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * safePageSize + 1
  const to = Math.min(safePage * safePageSize, total)

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2 text-sm">
      <p className="text-gray-500">
        {total === 0 ? (
          'No records'
        ) : (
          <>
            Showing <span className="font-medium text-gray-700">{from}</span>–
            <span className="font-medium text-gray-700">{to}</span> of{' '}
            <span className="font-medium text-gray-700">{total}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-xs text-gray-500">
          Page <span className="font-medium text-gray-700">{safePage}</span> of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
