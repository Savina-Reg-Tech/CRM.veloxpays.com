import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Settings2,
  Signal,
  XCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVSettings, useVVTestSmtp, useVVTestEsimApi } from '../hooks/useVVSettings'

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

export default function VVSettingsPage() {
  const { showToast } = useToast()
  const { data: settings, isLoading } = useVVSettings()
  const testSmtp = useVVTestSmtp()
  const testEsim = useVVTestEsimApi()

  const handleTestSmtp = () => {
    testSmtp.mutate(undefined, {
      onSuccess: (res) => showToast({ type: 'success', title: `Test email sent to ${res.sentTo}` }),
      onError: (err) =>
        showToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to send test email' }),
    })
  }

  const handleTestEsim = () => {
    testEsim.mutate(undefined, {
      onSuccess: (res) =>
        res.ok
          ? showToast({ type: 'success', title: res.message })
          : showToast({ type: 'error', title: 'Error', message: res.message }),
      onError: (err) =>
        showToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to test eSIM API' }),
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-gray-700 text-white shadow-lg">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">Configure pricing, email and provider connectivity.</p>
          </div>
        </div>
      </div>

      {isLoading || !settings ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* eSIM configuration */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Signal className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900">eSIM Configuration</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.esim.configured} label={settings.esim.configured ? 'Connected' : 'Not configured'} />
              <span className="text-gray-500">
                Credentials: <span className="text-gray-900">{settings.esim.credentialsSource}</span>
              </span>
            </div>
            <p className="break-all text-xs text-gray-500">API: {settings.esim.apiUrl}</p>

            <p className="text-xs text-gray-500">
              eSIM profit margin is now managed in{' '}
              <Link to="/dashboard/admin/pricing" className="text-indigo-600 hover:underline">
                Pricing Rules
              </Link>{' '}
              under the eSIM service type.
            </p>

            <div>
              <Button variant="outline" size="sm" disabled={testEsim.isPending} onClick={handleTestEsim}>
                {testEsim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Signal className="h-4 w-4" />}
                Test eSIM API
              </Button>
            </div>
          </section>

          {/* Email configuration */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Email Configuration</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.email.configured} label={settings.email.configured ? 'Configured' : 'Dev fallback'} />
              <span className="text-gray-500">
                Provider: <span className="text-gray-900">{settings.email.provider}</span>
              </span>
            </div>
            <p className="text-xs text-gray-500">From: {settings.email.fromAddress}</p>

            <Button variant="outline" size="sm" disabled={testSmtp.isPending} onClick={handleTestSmtp}>
              {testSmtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send test email
            </Button>
          </section>

          {/* General */}
          <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">General</h2>
            </div>
            <p className="text-sm text-gray-500">
              Provider credentials are managed via environment variables or the database settings row. Margin, surge, and
              refund-protection pricing are managed on the{' '}
              <Link to="/dashboard/admin/pricing" className="text-indigo-600 hover:underline">
                Pricing Rules
              </Link>{' '}
              page.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
