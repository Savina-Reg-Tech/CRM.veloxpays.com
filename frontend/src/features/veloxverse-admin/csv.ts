/**
 * Client-side CSV export for admin reports (the CRM's `/vv-admin` proxy only forwards JSON, so
 * reports are fetched page by page and assembled here).
 */

/** Quote a cell, neutralising spreadsheet formula prefixes (`=`, `+`, `-`, `@`) in free text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [header, ...rows].map((r) => r.map((c) => csvCell(c == null ? '' : String(c))).join(',')).join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Fetch every page of a paginated admin list (100 per request). */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; totalPages: number }>
): Promise<T[]> {
  const items: T[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await fetchPage(page)
    items.push(...res.items)
    totalPages = res.totalPages
    page += 1
  } while (page <= totalPages)
  return items
}

/** Cents → plain decimal for a CSV amount column (the currency goes in its own column). */
export function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}
