import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Armchair,
  Car,
  Settings2,
  Signal,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useVVSettings,
  useVVTestSmtp,
  useVVTestEsimApi,
  useVVTestDragonpassApi,
  useVVTestViatoviaApi,
  useVVTestMintApi,
} from '@/features/veloxverse-admin/hooks/useVVSettings'

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

export default function SettingsPage() {
  const { showToast } = useToast()
  const { data: settings, isLoading } = useVVSettings()
  const testSmtp = useVVTestSmtp()
  const testEsim = useVVTestEsimApi()
  const testDragonpass = useVVTestDragonpassApi()
  const testViatovia = useVVTestViatoviaApi()
  const testMint = useVVTestMintApi()

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

  const handleTestDragonpass = () => {
    testDragonpass.mutate(undefined, {
      onSuccess: (res) =>
        res.ok
          ? showToast({ type: 'success', title: res.message })
          : showToast({ type: 'error', title: 'Error', message: res.message }),
      onError: (err) =>
        showToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to test DragonPass API' }),
    })
  }

  const handleTestViatovia = () => {
    testViatovia.mutate(undefined, {
      onSuccess: (res) =>
        res.ok
          ? showToast({ type: 'success', title: res.message })
          : showToast({ type: 'error', title: 'Error', message: res.message }),
      onError: (err) =>
        showToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to test VeloxAssist API' }),
    })
  }

  const handleTestMint = () => {
    testMint.mutate(undefined, {
      onSuccess: (res) =>
        res.ok
          ? showToast({ type: 'success', title: res.message })
          : showToast({ type: 'error', title: 'Error', message: res.message }),
      onError: (err) =>
        showToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to check Mint configuration' }),
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Provider connectivity for every VeloxVerse integration, plus email and workspace configuration —
          all in one place.
        </p>
      </div>

      {isLoading || !settings ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* eSIM configuration */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Signal className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900">eSIM API</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.esim.configured} label={settings.esim.configured ? 'Connected' : 'Not configured'} />
              <span className="text-gray-500">
                Credentials: <span className="text-gray-900">{settings.esim.credentialsSource}</span>
              </span>
            </div>
            <p className="break-all text-xs text-gray-500">API: {settings.esim.apiUrl || '—'}</p>

            <p className="text-xs text-gray-500">
              eSIM profit margin is managed in{' '}
              <Link to="/dashboard/veloxverse/pricing" className="text-indigo-600 hover:underline">
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

          {/* DragonPass — VeloxLounge */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">DragonPass API (VeloxLounge)</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.dragonpass.configured} label={settings.dragonpass.configured ? 'Connected' : 'Not configured'} />
            </div>
            <p className="break-all text-xs text-gray-500">API: {settings.dragonpass.apiUrl || '—'}</p>

            <div>
              <Button variant="outline" size="sm" disabled={testDragonpass.isPending} onClick={handleTestDragonpass}>
                {testDragonpass.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Armchair className="h-4 w-4" />}
                Test DragonPass API
              </Button>
            </div>
          </section>

          {/* ViaTovia — VeloxAssist Pick & Drop */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">VeloxAssist API (Pick &amp; Drop)</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.viatovia.configured} label={settings.viatovia.configured ? 'Connected' : 'Not configured'} />
            </div>
            <p className="break-all text-xs text-gray-500">API: {settings.viatovia.apiUrl || '—'}</p>

            <div>
              <Button variant="outline" size="sm" disabled={testViatovia.isPending} onClick={handleTestViatovia}>
                {testViatovia.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
                Test VeloxAssist API
              </Button>
            </div>
          </section>

          {/* Mint — card payments */}
          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-fuchsia-500" />
              <h2 className="text-lg font-semibold text-gray-900">Mint API (Payments)</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusPill ok={settings.mint.configured} label={settings.mint.configured ? 'Configured' : 'Not configured'} />
            </div>
            <p className="break-all text-xs text-gray-500">API: {settings.mint.apiUrl || '—'}</p>
            <p className="text-xs text-gray-500">
              Mint has no safe test call — every live request either issues a transaction token or attempts a
              real purchase. This check only confirms the API key and company token are present, not that
              they're valid.
            </p>

            <div>
              <Button variant="outline" size="sm" disabled={testMint.isPending} onClick={handleTestMint}>
                {testMint.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Check Mint configuration
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
          <Card>
            <CardHeader title="General" description="Workspace-level preferences." />
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-600">
                Provider credentials are managed via environment variables or the database settings row. Margin,
                surge, and refund-protection pricing are managed on the{' '}
                <Link to="/dashboard/veloxverse/pricing" className="text-indigo-600 hover:underline">
                  Pricing Rules
                </Link>{' '}
                page.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
