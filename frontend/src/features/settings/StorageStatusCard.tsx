import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, HardDrive, XCircle } from 'lucide-react'
import api from '@/lib/axios'
import Skeleton from '@/components/ui/Skeleton'
import type { ApiResponse } from '@/types'

/** GET /api/storage/status — where uploaded documents live and whether that place is reachable. */
export interface StorageStatus {
  kind: 's3' | 'local'
  bucket?: string
  region?: string
  prefix?: string
  directory?: string
  signedUrlTtlSeconds?: number
  ok: boolean
  error: string | null
  /** false = files live on the server's own disk and are lost when it is redeployed. */
  durable: boolean
  warning: string | null
}

/**
 * Document storage for verification documents (employees / agents / affiliates) and Form Builder
 * file uploads. Read-only: storage is configured on the server (S3_BUCKET etc.), not from here.
 */
export default function StorageStatusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['storage-status'],
    queryFn: async () => (await api.get<ApiResponse<StorageStatus>>('/storage/status')).data.data,
    staleTime: 60_000,
  })

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900">Document storage</h2>
      </div>
      <p className="text-sm text-gray-500">
        Where verification documents and form uploads are kept. Files are private — they open only through the CRM,
        for staff who are allowed to see them.
      </p>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : isError || !data ? (
        <p className="text-sm text-red-600">Could not check document storage.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data.ok && data.durable ? 'bg-emerald-50 text-emerald-700' : data.ok ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {data.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {!data.ok ? 'Not working' : data.kind === 's3' ? 'Connected' : 'Local disk'}
            </span>
            <span className="text-gray-900">
              {data.kind === 's3' ? (
                <>
                  Amazon S3 bucket <span className="font-mono text-[13px]">{data.bucket}</span>
                  {data.region && <span className="text-gray-500"> · {data.region}</span>}
                  {data.prefix && <span className="text-gray-500"> · folder {data.prefix}</span>}
                </>
              ) : (
                'This server’s own disk'
              )}
            </span>
          </div>
          {data.kind === 's3' && data.ok && data.signedUrlTtlSeconds && (
            <p className="text-xs text-gray-500">
              Download links expire after {Math.round(data.signedUrlTtlSeconds / 60)} minute{data.signedUrlTtlSeconds === 60 ? '' : 's'}.
            </p>
          )}
          {data.error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{data.error}</p>
          )}
          {data.warning && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {data.warning}
            </p>
          )}
        </>
      )}
    </section>
  )
}
