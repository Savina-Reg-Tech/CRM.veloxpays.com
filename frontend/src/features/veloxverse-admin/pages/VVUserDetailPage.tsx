import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Smartphone,
  DollarSign,
  Undo2,
  Scale,
  Gem,
  Crown,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Spinner from '@/components/ui/Spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import { useVeloxVerseCustomerProfile } from '@/features/customers/hooks/useVeloxVerseCustomerProfile'
import { CustomerActivityList } from '@/features/customers/components/CustomerActivityList'
import { useVVUserDetail, useVVSetUserStatus } from '../hooks/useVVUsers'
import { formatUsd, formatDate, formatDateTime, statusBadgeVariant } from '../utils'

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = 'text-gray-900',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className={`text-lg font-bold ${tone}`}>{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

export default function VVUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useVVUserDetail(id)
  const setStatus = useVVSetUserStatus()
  const { showToast } = useToast()

  // Every order, booking, VeloxClub membership, support ticket, form request, and dollar of
  // spend/refund tied to this VeloxVerse account — this page is the CRM's single "customer 360"
  // view for a VeloxVerse user (reached from VeloxVerse → VV Users, and from Customers' "View
  // more" on a VeloxVerse row, which now opens this page directly instead of a popup).
  const profile = useVeloxVerseCustomerProfile(data?.user.id ?? null, data?.user.email)

  const handleStatus = async (isActive: boolean) => {
    if (!data) return
    try {
      await setStatus.mutateAsync({ id: data.user.id, isActive })
      showToast({
        type: 'success',
        title: 'Status updated',
        message: `Account ${isActive ? 'activated' : 'deactivated'}.`,
      })
    } catch (e) {
      showToast({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'Failed to update status.',
      })
    }
  }

  const billingTotals = profile.billing?.totals
  const pointsBalance = profile.points?.balance

  // Lounge purchases don't have their own admin "who booked this" list endpoint yet, so lounge
  // (and other direct-charge benefit) activity is read from the billing ledger instead — same
  // description/date/amount a customer would see on their own statement, just filtered to
  // service === LOUNGE/BENEFIT. It won't have per-visit fields like guest count or airport (those
  // live only on the lounge visit record itself, not the payment), but it's real booking history
  // where none was shown before.
  const loungeBillingItems = (profile.billing?.items ?? []).filter(
    (li) => li.service === 'LOUNGE' || li.service === 'BENEFIT'
  )

  return (
    <div className="max-w-full space-y-6">
      <Link
        to="/dashboard/veloxverse/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Loading user…" />
        </div>
      ) : !data ? (
        <Card>
          <p className="py-12 text-center text-sm text-gray-500">
            User not found.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {data.user.fullName || 'Guest User'}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Mail className="h-3.5 w-3.5" /> {data.user.email}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Joined {formatDate(data.user.createdAt)} ·{' '}
                  {data.user.isVerified ? 'Verified' : 'Unverified'}
                </p>
                {data.user.role === 'GUEST' && data.user.guestExpiresAt && (
                  <p className="mt-1 text-xs text-amber-600">
                    Guest expires {formatDate(data.user.guestExpiresAt)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {data.user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    checked={data.user.isActive}
                    disabled={setStatus.isPending}
                    onChange={handleStatus}
                  />
                </div>
                {/* Account type only — this is a customer record (guest or registered), so
                    there's no promote-to-admin/super-admin control here. */}
                <Badge variant={data.user.role === 'GUEST' ? 'warning' : 'neutral'}>
                  {data.user.role === 'GUEST' ? 'Guest' : 'Registered'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Money: what this customer has spent, been refunded, and their points balance —
              from VeloxVerse's real billing ledger (Payments + PaymentRefunds), not a guess. */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              label="Total spent"
              value={profile.isBillingLoading ? '…' : formatUsd(billingTotals?.spentUsd ?? 0)}
              sub={billingTotals ? `${billingTotals.orderCount} orders` : undefined}
            />
            <StatTile
              icon={<Undo2 className="h-5 w-5 text-red-500" />}
              label="Total refunded"
              value={profile.isBillingLoading ? '…' : formatUsd(billingTotals?.refundsUsd ?? 0)}
              tone={billingTotals && billingTotals.refundsUsd > 0 ? 'text-red-600' : 'text-gray-900'}
            />
            <StatTile
              icon={<Scale className="h-5 w-5 text-blue-500" />}
              label="Net spend"
              value={profile.isBillingLoading ? '…' : formatUsd(billingTotals?.netUsd ?? 0)}
            />
            <StatTile
              icon={<Gem className="h-5 w-5 text-fuchsia-500" />}
              label="Points balance"
              value={
                profile.isPointsLoading
                  ? '…'
                  : profile.isPointsError
                    ? '—'
                    : (pointsBalance?.balance ?? 0).toLocaleString()
              }
              sub={
                pointsBalance
                  ? `${pointsBalance.lifetimeEarned.toLocaleString()} earned lifetime`
                  : undefined
              }
            />
          </div>

          {/* Everything by service — eSIM / Lounge / VeloxClub / Assist (Pick & Drop) / Support /
              Form requests, plus an "All" tab with the unified chronological feed. */}
          <Card padding="sm">
            {profile.isError ? (
              <p className="py-4 text-center text-sm text-red-600">
                Could not load full VeloxVerse activity. Check that the VeloxVerse bridge is
                running.
              </p>
            ) : profile.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" label="Loading activity…" />
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="flex-nowrap overflow-x-auto">
                  <TabsTrigger value="all" className="shrink-0">
                    All ({profile.activity.length})
                  </TabsTrigger>
                  <TabsTrigger value="esim" className="shrink-0">
                    eSIM ({data.orders.length})
                  </TabsTrigger>
                  <TabsTrigger value="lounge" className="shrink-0">
                    VeloxLounge ({loungeBillingItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="club" className="shrink-0">
                    VeloxClub ({profile.clubMemberships.length})
                  </TabsTrigger>
                  <TabsTrigger value="assist" className="shrink-0">
                    Assist ({profile.transfers.length})
                  </TabsTrigger>
                  <TabsTrigger value="support" className="shrink-0">
                    Support ({profile.tickets.length})
                  </TabsTrigger>
                  <TabsTrigger value="forms" className="shrink-0">
                    Forms ({profile.leads.length})
                  </TabsTrigger>
                </TabsList>

                {/* ── All: unified chronological feed ── */}
                <TabsContent value="all">
                  <CustomerActivityList items={profile.activity} />
                </TabsContent>

                {/* ── eSIM orders + devices ── */}
                <TabsContent value="esim" className="space-y-4">
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Orders
                    </h3>
                    {data.orders.length === 0 ? (
                      <p className="text-sm text-gray-500">No eSIM orders.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.orders.map((o) => (
                          <li
                            key={o.orderNo}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-gray-900">{o.packageName}</p>
                              <p className="font-mono text-xs text-gray-500">{o.orderNo}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
                              <span className="text-gray-500">{formatUsd(o.sellingPrice)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {data.devices.length > 0 && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <Smartphone className="h-3.5 w-3.5" /> Devices
                      </h3>
                      <ul className="space-y-1">
                        {data.devices.map((d) => (
                          <li key={d.id} className="text-sm text-gray-700">
                            {d.name}
                            <span className="text-gray-400">
                              {' '}
                              · {[d.brand, d.model].filter(Boolean).join(' ') || d.deviceType}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </TabsContent>

                {/* ── VeloxLounge: real payment history for lounge/benefit bookings. VeloxVerse
                    doesn't sell lounge "memberships" (recurring plans) — every lounge visit is
                    a one-off paid booking, so that's what shows here. ── */}
                <TabsContent value="lounge" className="space-y-4">
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Lounge &amp; benefit bookings
                    </h3>
                    {profile.isBillingLoading ? (
                      <div className="flex justify-center py-4">
                        <Spinner size="sm" />
                      </div>
                    ) : loungeBillingItems.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No lounge or benefit (dining / fast track / gym) bookings.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {loungeBillingItems.map((li) => (
                          <li
                            key={li.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-gray-900">{li.description}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(li.date)}</p>
                            </div>
                            <span
                              className={`shrink-0 font-medium ${li.direction === 'credit' ? 'text-red-600' : 'text-gray-700'}`}
                            >
                              {li.direction === 'credit' ? '−' : ''}
                              {formatUsd(li.amountUsd)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>

                {/* ── VeloxClub membership(s) ── */}
                <TabsContent value="club">
                  {profile.isClubLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner size="md" />
                    </div>
                  ) : profile.clubMemberships.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">
                      No VeloxClub membership.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {profile.clubMemberships.map((m) => (
                        <li key={m.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                              <Crown className="h-4 w-4 text-amber-500" />
                              {m.tier}
                            </span>
                            <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
                            <p>Purchased {formatDate(m.purchasedAt)} · {formatUsd(m.purchasePriceCents / 100)}</p>
                            <p>
                              Billing cycle {formatDate(m.billingCycleStart)} – {formatDate(m.billingCycleEnd)}
                            </p>
                            {m.invoiceNumber && <p>Invoice {m.invoiceNumber}</p>}
                            <p>{m.autoRenew ? 'Auto-renews' : 'Does not auto-renew'}</p>
                          </div>
                          {m.usage.length > 0 && (
                            <div className="mt-2 border-t border-gray-100 pt-2">
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                Benefit usage this cycle
                              </p>
                              <ul className="space-y-0.5 text-xs text-gray-600">
                                {m.usage.map((u, i) => (
                                  <li key={i}>
                                    {u.benefitKey} · {formatDateTime(u.consumedAt)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* ── Assist: Pick & Drop transfer bookings ── */}
                <TabsContent value="assist">
                  {profile.transfers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">
                      No transfer bookings.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.transfers.map((t) => (
                        <li
                          key={t.orderNo}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-gray-900">
                              {t.pickupName ?? 'Pickup'} → {t.dropoffName ?? 'Drop-off'}
                            </p>
                            <p className="text-xs text-gray-500">{t.orderNo}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
                            <span className="text-gray-500">
                              {formatUsd((t.salePriceCents ?? 0) / 100)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* ── Support tickets ── */}
                <TabsContent value="support">
                  {profile.tickets.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No support tickets.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.tickets.map((t) => (
                        <li key={t.id}>
                          <Link
                            to={`/dashboard/veloxverse/support/${t.id}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                          >
                            <div className="min-w-0">
                              <p className="text-gray-900">{t.subject}</p>
                              <p className="text-xs text-gray-500">
                                {t.caseId} · {formatDateTime(t.updatedAt)}
                              </p>
                            </div>
                            <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* ── Form requests (Meet & Greet, and any other public form) ── */}
                <TabsContent value="forms">
                  {profile.leads.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No form requests.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.leads.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-gray-900">{l.form_name ?? 'Form request'}</p>
                            <p className="text-xs text-gray-500">{formatDateTime(l.created_at)}</p>
                          </div>
                          <Badge variant={statusBadgeVariant(l.status)}>{l.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
