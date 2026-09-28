import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Gift, RefreshCw, Ticket, Undo2, UserPlus, Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { formatMoney, cn } from '@/lib/utils'
import { useVVReferral } from '../hooks/useVVReferrals'
import { formatDate, formatDateTime } from '../utils'
import {
  REFERRAL_STATUS,
  formatPoints,
  personLabel,
  pointsValueLabel,
  reversalReasonLabel,
} from '../referral'
import type { ReferralDetail, ReferralParty, ReferralTimelineEvent } from '../types'

const BACK = '/dashboard/veloxverse/refer-earn?tab=referrals'

function PartyCard({ title, party, note }: { title: string; party: ReferralParty; note: string }) {
  const worth = pointsValueLabel(party.value)
  return (
    <Card padding="sm" className="sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        {!party.isActive && <Badge variant="danger">Blocked</Badge>}
      </div>
      <Link to={`/dashboard/veloxverse/users/${party.id}`} className="mt-2 block truncate text-base font-semibold text-gray-900 hover:text-indigo-600">
        {personLabel(party)}
      </Link>
      {party.name && <p className="truncate text-sm text-gray-500">{party.email}</p>}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 rounded-lg bg-gray-50 p-3">
        <div>
          <p className="text-xs text-gray-500">Points in force</p>
          <p className="text-xl font-bold text-gray-900">{formatPoints(party.pointsInForce)}</p>
        </div>
        <div className="text-right">
          <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{party.currency}</span>
          <p className="mt-1 text-xs">
            {worth ? <span className="text-emerald-700">{worth}</span> : <span className="text-gray-400">no {party.currency} redemption rate</span>}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">{note}</p>
    </Card>
  )
}

function eventMeta(e: ReferralTimelineEvent, d: ReferralDetail): { icon: ReactNode; tone: string; title: string; body: ReactNode } {
  const who = e.side === 'REFERRER' ? personLabel(d.referral.referrer) : personLabel(d.referral.referee)
  const role = e.side === 'REFERRER' ? 'Referrer' : 'Referred customer'
  const worth = pointsValueLabel(e.value)
  const amount = (
    <>
      <span className="font-medium">{formatPoints(e.points)}</span> <span className="text-gray-500">({e.currency}{worth ? ` · ${worth}` : ''})</span>
    </>
  )
  if (e.type === 'CODE_APPLIED') {
    return {
      icon: <UserPlus className="h-4 w-4" />,
      tone: 'bg-indigo-50 text-indigo-600 ring-indigo-200',
      title: `Code ${d.referral.code ?? ''} applied`,
      body: <>{personLabel(d.referral.referee)} signed up with {personLabel(d.referral.referrer)}'s code.</>,
    }
  }
  if (e.type === 'AWARD') {
    return {
      icon: <Gift className="h-4 w-4" />,
      tone: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
      title: `${role} awarded`,
      body: (
        <>
          {who} received +{amount}
          {e.bookingRef && <span className="text-gray-500"> for booking <span className="font-mono text-xs">{e.bookingRef}</span></span>}
        </>
      ),
    }
  }
  return {
    icon: <Undo2 className="h-4 w-4" />,
    tone: 'bg-red-50 text-red-600 ring-red-200',
    title: `${role} reversed — ${reversalReasonLabel(e.reason).toLowerCase()}`,
    body: (
      <>
        {who} lost −{amount}
        {e.bookingRef && <span className="text-gray-500"> (booking <span className="font-mono text-xs">{e.bookingRef}</span>)</span>}
      </>
    ),
  }
}

function Timeline({ detail }: { detail: ReferralDetail }) {
  return (
    <ol className="relative space-y-5 border-l border-gray-200 pl-6">
      {detail.timeline.map((e) => {
        const m = eventMeta(e, detail)
        return (
          <li key={e.id} className="relative">
            <span className={cn('absolute -left-[37px] flex h-7 w-7 items-center justify-center rounded-full ring-1', m.tone)}>{m.icon}</span>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <p className="text-sm font-medium text-gray-900">{m.title}</p>
              <time className="shrink-0 text-xs text-gray-500">{formatDateTime(e.at)}</time>
            </div>
            <p className="mt-0.5 break-words text-sm text-gray-600">{m.body}</p>
          </li>
        )
      })}
    </ol>
  )
}

export default function VVReferralDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, error, refetch } = useVVReferral(id)

  const backLink = (
    <Link to={BACK} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" />
      Referrals
    </Link>
  )

  if (isLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        {backLink}
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-5xl space-y-6">
        {backLink}
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-sm text-gray-600">{error instanceof Error ? error.message : 'Referral not found.'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  const r = data.referral
  const status = REFERRAL_STATUS[r.displayStatus]

  return (
    <div className="max-w-5xl space-y-5 sm:space-y-6">
      {backLink}

      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
          <Gift className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-gray-900 sm:text-2xl">
            {personLabel(r.referrer)} <span className="font-normal text-gray-400">→</span> {personLabel(r.referee)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {r.code && <span className="font-mono text-sm text-gray-600">{r.code}</span>}
            <span className="text-sm text-gray-500">· since {formatDate(r.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{status.help}</p>
        </div>
      </div>

      {r.referrer.currency !== r.referee.currency && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          The two sides use different currencies — the referrer is rewarded in <strong>{r.referrer.currency}</strong> and the referred
          customer in <strong>{r.referee.currency}</strong>, each at their own currency's configured points.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PartyCard title="Referrer" party={r.referrer} note="Reward for a successful referral." />
        <PartyCard title="Referred customer" party={r.referee} note="Welcome bonus for joining through the referral." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding="sm" className="sm:p-6 lg:col-span-2">
          <CardHeader
            title="Timeline"
            description={r.reversalCount ? `${r.reversalCount} reversal${r.reversalCount === 1 ? '' : 's'} so far.` : 'Every award and reversal, oldest first.'}
            className="mb-5"
          />
          <div className="pl-3">
            <Timeline detail={data} />
          </div>
          {r.displayStatus === 'PENDING' && (
            <p className="mt-5 text-xs text-gray-500">Waiting for {personLabel(r.referee)}'s first card-paid booking.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card padding="sm" className="sm:p-5">
            <CardHeader title="Qualifying bookings" className="mb-3" />
            {data.bookings.length === 0 ? (
              <p className="text-sm text-gray-500">None yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.bookings.map((b) => (
                  <li key={b.reference} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="break-words font-medium text-gray-900">{b.description ?? 'Booking'}</p>
                        <p className="break-all font-mono text-xs text-gray-500">{b.invoiceNumber ?? b.reference}</p>
                        {b.amount && (
                          <p className="mt-1 text-gray-700">{formatMoney(b.amount.cents / 100, b.amount.currency)}</p>
                        )}
                        {(b.status || b.createdAt) && (
                          <p className="text-xs text-gray-500">
                            {b.status?.toLowerCase().replace(/_/g, ' ')}
                            {b.createdAt ? ` · ${formatDate(b.createdAt)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.code && (
            <Card padding="sm" className="sm:p-5">
              <CardHeader title="Referral code" className="mb-3" />
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-gray-400" />
                <span className="font-mono font-semibold text-gray-900">{data.code.code}</span>
                <Badge variant={data.code.isActive ? 'success' : 'neutral'}>{data.code.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-gray-500">Uses</dt>
                  <dd className="font-medium text-gray-900">
                    {data.code.currentUses}
                    {data.code.maxUses != null ? ` / ${data.code.maxUses}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Expires</dt>
                  <dd className="font-medium text-gray-900">{data.code.expiresAt ? formatDate(data.code.expiresAt) : 'Never'}</dd>
                </div>
              </dl>
              <Link
                to={`/dashboard/veloxverse/refer-earn?tab=codes&cq=${encodeURIComponent(data.code.code)}`}
                className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Manage code
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
