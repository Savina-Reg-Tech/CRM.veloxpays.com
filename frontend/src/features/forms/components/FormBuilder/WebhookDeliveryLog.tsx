import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { useWebhookDeliveries } from '../../hooks/useForms'

interface WebhookDeliveryLogProps {
  formId: number
}

/** Admin-visible record of every webhook send attempt (success or failure)
 * for this form — see backend webhook_deliveries table. Webhooks are
 * fire-and-forget from the submitter's point of view, so without this log
 * a misconfigured URL or a receiver that started rejecting requests would
 * fail completely silently. */
export default function WebhookDeliveryLog({ formId }: WebhookDeliveryLogProps) {
  const { data, isLoading, isFetching, refetch } = useWebhookDeliveries(formId, { limit: 15 })
  const items = data?.items ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">Recent delivery attempts</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600"
        >
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400">No webhook deliveries yet — they'll show up here after a matching submission.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {items.map((d) => (
            <div key={d.id} className="flex items-start gap-2 px-3 py-2 text-xs">
              {d.success ? (
                <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 truncate">{d.rule_name || 'Webhook'}</span>
                  <span className="text-gray-400 shrink-0">{new Date(d.created_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-400 font-mono truncate">{d.url}</p>
                {!d.success && d.error_message && <p className="text-red-500 mt-0.5">{d.error_message}</p>}
              </div>
              <div className="text-right shrink-0 text-gray-400">
                {d.status_code != null && <div>HTTP {d.status_code}</div>}
                {d.duration_ms != null && <div>{d.duration_ms}ms</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
