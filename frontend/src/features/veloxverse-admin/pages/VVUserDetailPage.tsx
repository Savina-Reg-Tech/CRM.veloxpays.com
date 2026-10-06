import { useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Car,
  Crown,
  FileText,
  Gem,
  LifeBuoy,
  Mail,
  Receipt,
  Scale,
  Smartphone,
  Undo2,
  Wifi,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Switch from '@/components/ui/Switch'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useToast } from '@/app/providers/ToastProvider'
import { formatMoney } from '@/lib/utils'
import { useVeloxVerseCustomerProfile } from '@/features/customers/hooks/useVeloxVerseCustomerProfile'
import { CustomerActivityList } from '@/features/customers/components/CustomerActivityList'
import { useVVUserDetail, useVVSetUserStatus } from '../hooks/useVVUsers'
import { useVVCustomerLoungeVisits } from '../hooks/useVVLounge'
import VVUserAvatar from '../components/VVUserAvatar'
import { formatDate } from '../utils'
import type { AdminBillingLineItem } from '../types'
import {
  ClubMembershipCard,
  EmptyState,
  EsimOrderCard,
  FormLeadCard,
  LoungePaymentCard,
  LoungeVisitCard,
  PaymentRow,
  StatusChips,
  SupportTicketCard,
  TransferCard,
} from '../components/CustomerBookingCards'
import { CustomerActivity } from '../components/audit/CustomerActivity'
import { EventDrawer } from '../components/audit/EventDrawer'

// ── Money helpers ───────────────────────────────────────────────────

interface CurrencyBucket {
  currency: string
  spent: number
  refunded: number
  orders: number
}

/** What this customer actually paid in each currency they used, unconverted. Same classification
 * as VeloxVerse's billing.service.ts lineItemsTotals: credit grants (EARN/ADMIN_CREDIT) are not
 * spend, REFUND rows are refunds, every other debit is a purchase. */
function spendByCurrency(items: AdminBillingLineItem[]): CurrencyBucket[] {
  const map = new Map<string, CurrencyBucket>()
  for (const li of items) {
    if (li.type === 'EARN' || li.type === 'ADMIN_CREDIT') continue
    const currency = (li.currency || 'USD').toUpperCase()
    const b = map.get(currency) ?? { currency, spent: 0, refunded: 0, orders: 0 }
    if (li.type === 'REFUND') b.refunded += li.amountUsd
    else if (li.direction === 'debit') {
      b.spent += li.amountUsd
      b.orders += 1
    } else continue
    map.set(currency, b)
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent)
}

function filterByStatus<T>(items: T[], status: string, get: (i: T) => string): T[] {
  return status ? items.filter((i) => get(i) === status) : items
}

// ── Small presentational pieces ─────────────────────────────────────

function MoneyTile({
  icon: Icon,
  tint,
  label,
  value,
  sub,
  valueClass = 'text-gray-900',
}: {
  icon: ElementType
  tint: string
  label: string
  value: ReactNode
  sub?: ReactNode
  valueClass?: string
}) {
  return (
    <Card padding="sm" className="min-w-0">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <div className={`truncate text-lg font-bold ${valueClass}`}>{value}</div>
          {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
        </div>
      </div>
    </Card>
  )
}

function ServiceTile({
  icon: Icon,
  tint,
  label,
  count,
  hint,
  active,
  onClick,
}: {
  icon: ElementType
  tint: string
  label: string
  count: number | string
  hint?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        active ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-gray-900">{count}</p>
        <p className="truncate text-xs text-gray-500">{label}</p>
        {hint && <p className="truncate text-[11px] text-indigo-600">{hint}</p>}
      </div>
    </button>
  )
}

function CardList({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

function Loading({ label }: { label?: string }) {
  return (
    <div className="flex justify-center py-10">
      <Spinner size="md" label={label} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────

type TabKey = 'all' | 'esim' | 'lounge' | 'assist' | 'club' | 'payments' | 'support' | 'forms' | 'activity'
const TAB_KEYS: TabKey[] = ['all', 'esim', 'lounge', 'assist', 'club', 'payments', 'support', 'forms', 'activity']

export default function VVUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useVVUserDetail(id)
  const setStatus = useVVSetUserStatus()
  const { showToast } = useToast()
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [searchParams] = useSearchParams()
  // Audit-log screens link here with ?tab=activity.
  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab') as TabKey | null
    return t && TAB_KEYS.includes(t) ? t : 'all'
  })
  const [statusFilter, setStatusFilter] = useState('')
  const bookingsRef = useRef<HTMLDivElement | null>(null)

  // The CRM's single "customer 360" for a VeloxVerse user — every order, booking, membership,
  // payment, ticket and form request tied to this account (reached from VV Users and from
  // Customers' "View more" on a VeloxVerse row).
  const profile = useVeloxVerseCustomerProfile(data?.user.id ?? null, data?.user.email)
  const loungeQuery = useVVCustomerLoungeVisits(data?.user.id, data?.user.email)

  const billingItems = useMemo(() => profile.billing?.items ?? [], [profile.billing])
  const billingTotals = profile.billing?.totals
  const buckets = useMemo(() => spendByCurrency(billingItems), [billingItems])
  // Totals arrive converted into the customer's billing currency. Older VeloxVerse builds didn't
  // send that currency — then the totals are only meaningful if everything was paid in one
  // currency; otherwise show the per-currency breakdown rather than a mixed-currency sum.
  const totalsCurrency = billingTotals?.currency ?? (buckets.length === 1 ? buckets[0].currency : null)
  const skipped = billingTotals?.skippedCurrencies ?? []

  // eSIM order date / payment method / invoice live on the billing ledger, not the order list.
  const paymentByOrderNo = useMemo(() => {
    const map = new Map<string, AdminBillingLineItem>()
    for (const li of billingItems) if (li.direction === 'debit' && !map.has(li.orderNo)) map.set(li.orderNo, li)
    return map
  }, [billingItems])

  const loungeVisits = useMemo(
    () =>
      [...(loungeQuery.data ?? [])].sort(
        (a, b) => new Date(b.visitDate ?? b.createdAt).getTime() - new Date(a.visitDate ?? a.createdAt).getTime()
      ),
    [loungeQuery.data]
  )
  const loungeBillingItems = billingItems.filter((li) => li.service === 'LOUNGE' || li.service === 'BENEFIT')
  const loungeCount = loungeQuery.isError ? loungeBillingItems.length : loungeVisits.length
  const upcomingLounge = loungeVisits.filter(
    (v) => v.status === 'confirmed' && v.visitDate && new Date(v.visitDate) >= new Date(new Date().toDateString())
  ).length
  const activeTransfers = profile.transfers.filter((t) => ['PENDING', 'CONFIRMED', 'APPROVED'].includes(t.status)).length
  const openTickets = profile.tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
  const activeClub = profile.clubMemberships.find((m) => m.status === 'ACTIVE')

  const goTo = (key: TabKey) => {
    setTab(key)
    setStatusFilter('')
    bookingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Blocking goes through a confirm step: VeloxVerse claws back the referrer's reward when a
  // referred account is blocked. Re-activating applies straight away.
  const handleToggle = (isActive: boolean) => {
    if (isActive) void handleStatus(true)
    else setConfirmBlock(true)
  }

  const handleStatus = async (isActive: boolean) => {
    if (!data) return
    try {
      await setStatus.mutateAsync({ id: data.user.id, isActive })
      setConfirmBlock(false)
      showToast({ type: 'success', title: 'Status updated', message: `Account ${isActive ? 'activated' : 'deactivated'}.` })
    } catch (e) {
      showToast({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : 'Failed to update status.' })
    }
  }

  // Never a converted cross-currency total: a customer who paid in several currencies gets one
  // line per currency. The server's converted totals are used only when there's a single currency.
  const money = (v: number | undefined, pick: (b: CurrencyBucket) => number): ReactNode => {
    if (profile.isBillingLoading) return '…'
    if (buckets.length > 1) {
      return (
        <span className="flex flex-col text-base leading-snug">
          {buckets.map((b) => <span key={b.currency}>{formatMoney(pick(b), b.currency)}</span>)}
        </span>
      )
    }
    if (buckets.length === 1) return formatMoney(pick(buckets[0]), buckets[0].currency)
    return formatMoney(v ?? 0, totalsCurrency ?? undefined)
  }

  const pointsBalance = profile.points?.balance

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
        <Loading label="Loading user…" />
      ) : !data ? (
        <Card>
          <p className="py-12 text-center text-sm text-gray-500">User not found.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ── Profile header ── */}
          <Card padding="none" className="overflow-hidden">
            <div className="h-16 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="-mt-8 rounded-full ring-4 ring-white">
                  <VVUserAvatar user={data.user} size="xl" />
                </div>
                <div className="min-w-0 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold text-gray-900">{data.user.fullName || 'Guest User'}</h1>
                    <Badge variant={data.user.role === 'GUEST' ? 'warning' : 'neutral'}>
                      {data.user.role === 'GUEST' ? 'Guest' : 'Registered'}
                    </Badge>
                    {data.user.isVerified && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                    {activeClub && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                        <Crown className="h-3 w-3" /> {activeClub.tier}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 truncate text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {data.user.email}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Joined {formatDate(data.user.createdAt)}
                    {totalsCurrency && <> · Billing currency {totalsCurrency}</>}
                    {data.user.role === 'GUEST' && data.user.guestExpiresAt && (
                      <span className="text-amber-600"> · Guest expires {formatDate(data.user.guestExpiresAt)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className={`text-xs font-medium ${data.user.isActive ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {data.user.isActive ? 'Active' : 'Inactive'}
                </span>
                <Switch checked={data.user.isActive} disabled={setStatus.isPending} onChange={handleToggle} />
              </div>
            </div>
          </Card>

          {/* ── Money ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MoneyTile
              icon={Banknote}
              tint="bg-emerald-50 text-emerald-600"
              label="Total spent"
              value={money(billingTotals?.spentUsd, (b) => b.spent)}
              sub={billingTotals ? `${billingTotals.orderCount} order${billingTotals.orderCount === 1 ? '' : 's'}` : undefined}
            />
            <MoneyTile
              icon={Undo2}
              tint="bg-red-50 text-red-600"
              label="Total refunded"
              value={money(billingTotals?.refundsUsd, (b) => b.refunded)}
              valueClass={billingTotals && billingTotals.refundsUsd > 0 ? 'text-red-600' : 'text-gray-900'}
            />
            <MoneyTile icon={Scale} tint="bg-blue-50 text-blue-600" label="Net spend" value={money(billingTotals?.netUsd, (b) => b.spent - b.refunded)} />
            <MoneyTile
              icon={Gem}
              tint="bg-fuchsia-50 text-fuchsia-600"
              label="Points balance"
              value={profile.isPointsLoading ? '…' : profile.isPointsError ? '—' : (pointsBalance?.balance ?? 0).toLocaleString()}
              sub={pointsBalance ? `${pointsBalance.lifetimeEarned.toLocaleString()} earned lifetime` : undefined}
            />
          </div>

          {/* What was actually paid, per currency — never summed across currencies. */}
          {(buckets.length > 0 || skipped.length > 0) && (
            <Card padding="sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Paid by currency</h2>
                {skipped.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Totals above exclude {skipped.join(', ')} (no exchange rate)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {buckets.map((b) => (
                  <div key={b.currency} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-gray-700 ring-1 ring-gray-200">{b.currency}</span>
                      <span className="text-[11px] text-gray-500">{b.orders} order{b.orders === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-1.5 text-base font-bold text-gray-900">{formatMoney(b.spent, b.currency)}</p>
                    {b.refunded > 0 && (
                      <p className="text-xs text-red-600">−{formatMoney(b.refunded, b.currency)} refunded</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Service overview: click to jump to that service's bookings ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ServiceTile icon={Wifi} tint="bg-blue-50 text-blue-600" label="eSIM orders" count={data.orders.length} active={tab === 'esim'} onClick={() => goTo('esim')} />
            <ServiceTile
              icon={Armchair}
              tint="bg-indigo-50 text-indigo-600"
              label="Lounge & benefits"
              count={loungeQuery.isLoading ? '…' : loungeCount}
              hint={upcomingLounge ? `${upcomingLounge} upcoming` : undefined}
              active={tab === 'lounge'}
              onClick={() => goTo('lounge')}
            />
            <ServiceTile
              icon={Car}
              tint="bg-amber-50 text-amber-600"
              label="Pick & Drop"
              count={profile.transfers.length}
              hint={activeTransfers ? `${activeTransfers} active` : undefined}
              active={tab === 'assist'}
              onClick={() => goTo('assist')}
            />
            <ServiceTile icon={Crown} tint="bg-yellow-50 text-yellow-600" label="VeloxClub" count={profile.clubMemberships.length} hint={activeClub ? 'Active member' : undefined} active={tab === 'club'} onClick={() => goTo('club')} />
            <ServiceTile icon={LifeBuoy} tint="bg-rose-50 text-rose-600" label="Support tickets" count={profile.tickets.length} hint={openTickets ? `${openTickets} open` : undefined} active={tab === 'support'} onClick={() => goTo('support')} />
            <ServiceTile icon={FileText} tint="bg-teal-50 text-teal-600" label="Form requests" count={profile.leads.length} active={tab === 'forms'} onClick={() => goTo('forms')} />
          </div>

          {/* ── Bookings ── */}
          <div ref={bookingsRef} className="scroll-mt-4">
            <Card padding="sm">
              {profile.isError ? (
                <p className="py-4 text-center text-sm text-red-600">
                  Could not load full VeloxVerse activity. Check that the VeloxVerse bridge is running.
                </p>
              ) : profile.isLoading ? (
                <Loading label="Loading bookings…" />
              ) : (
                <Tabs
                  defaultValue="all"
                  value={tab}
                  onChange={(v) => {
                    setTab(v as TabKey)
                    setStatusFilter('')
                  }}
                >
                  <TabsList className="flex-nowrap overflow-x-auto">
                    <TabsTrigger value="all" className="shrink-0">Timeline ({profile.activity.length})</TabsTrigger>
                    <TabsTrigger value="esim" className="shrink-0">eSIM ({data.orders.length})</TabsTrigger>
                    <TabsTrigger value="lounge" className="shrink-0">Lounge &amp; benefits ({loungeCount})</TabsTrigger>
                    <TabsTrigger value="assist" className="shrink-0">Pick &amp; Drop ({profile.transfers.length})</TabsTrigger>
                    <TabsTrigger value="club" className="shrink-0">VeloxClub ({profile.clubMemberships.length})</TabsTrigger>
                    <TabsTrigger value="payments" className="shrink-0">Payments ({billingItems.length})</TabsTrigger>
                    <TabsTrigger value="support" className="shrink-0">Support ({profile.tickets.length})</TabsTrigger>
                    <TabsTrigger value="forms" className="shrink-0">Forms ({profile.leads.length})</TabsTrigger>
                    <TabsTrigger value="activity" className="shrink-0">Activity log</TabsTrigger>
                  </TabsList>

                  <div className="pt-4">
                    <TabsContent value="all">
                      <CustomerActivityList items={profile.activity} />
                    </TabsContent>

                    <TabsContent value="esim" className="space-y-3">
                      {data.orders.length === 0 ? (
                        <EmptyState icon={Wifi} text="No eSIM orders." />
                      ) : (
                        <>
                          <StatusChips statuses={data.orders.map((o) => o.status)} value={statusFilter} onChange={setStatusFilter} />
                          <CardList>
                            {filterByStatus(data.orders, statusFilter, (o) => o.status).map((o) => (
                              <EsimOrderCard key={o.orderNo} order={o} payment={paymentByOrderNo.get(o.orderNo)} />
                            ))}
                          </CardList>
                        </>
                      )}
                      {data.devices.length > 0 && (
                        <section className="pt-2">
                          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <Smartphone className="h-3.5 w-3.5" /> Devices
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {data.devices.map((d) => (
                              <span key={d.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                                {d.name}
                                <span className="text-gray-400"> · {[d.brand, d.model].filter(Boolean).join(' ') || d.deviceType}</span>
                                {d.esimCompatible === false && <span className="text-red-500"> · not eSIM-ready</span>}
                              </span>
                            ))}
                          </div>
                        </section>
                      )}
                    </TabsContent>

                    <TabsContent value="lounge" className="space-y-3">
                      {loungeQuery.isLoading ? (
                        <Loading label="Loading lounge bookings…" />
                      ) : loungeQuery.isError ? (
                        <>
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Lounge booking details are unavailable right now — showing the payments for these bookings instead.
                          </p>
                          {loungeBillingItems.length === 0 ? (
                            <EmptyState icon={Armchair} text="No lounge or benefit bookings." />
                          ) : (
                            <CardList>{loungeBillingItems.map((li) => <LoungePaymentCard key={li.id} li={li} />)}</CardList>
                          )}
                        </>
                      ) : loungeVisits.length === 0 ? (
                        <EmptyState icon={Armchair} text="No lounge, dining, fast track or fitness bookings." />
                      ) : (
                        <>
                          <StatusChips statuses={loungeVisits.map((v) => v.status)} value={statusFilter} onChange={setStatusFilter} />
                          <CardList>
                            {filterByStatus(loungeVisits, statusFilter, (v) => v.status).map((v) => (
                              <LoungeVisitCard key={v.id} v={v} />
                            ))}
                          </CardList>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="assist" className="space-y-3">
                      {profile.transfers.length === 0 ? (
                        <EmptyState icon={Car} text="No Pick & Drop bookings." />
                      ) : (
                        <>
                          <StatusChips statuses={profile.transfers.map((t) => t.status)} value={statusFilter} onChange={setStatusFilter} />
                          <CardList>
                            {filterByStatus(profile.transfers, statusFilter, (t) => t.status).map((t) => (
                              <TransferCard key={t.orderNo} t={t} />
                            ))}
                          </CardList>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="club">
                      {profile.isClubLoading ? (
                        <Loading />
                      ) : profile.clubMemberships.length === 0 ? (
                        <EmptyState icon={Crown} text="No VeloxClub membership." />
                      ) : (
                        <CardList>{profile.clubMemberships.map((m) => <ClubMembershipCard key={m.id} m={m} />)}</CardList>
                      )}
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-3">
                      {profile.isBillingLoading ? (
                        <Loading />
                      ) : profile.isBillingError ? (
                        <p className="py-4 text-center text-sm text-red-600">Could not load payment history.</p>
                      ) : billingItems.length === 0 ? (
                        <EmptyState icon={Receipt} text="No payments or refunds." />
                      ) : (
                        <>
                          <StatusChips statuses={billingItems.map((li) => li.service)} value={statusFilter} onChange={setStatusFilter} />
                          <CardList>
                            {filterByStatus(billingItems, statusFilter, (li) => li.service).map((li) => (
                              <PaymentRow key={li.id} li={li} />
                            ))}
                          </CardList>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="support" className="space-y-3">
                      {profile.tickets.length === 0 ? (
                        <EmptyState icon={LifeBuoy} text="No support tickets." />
                      ) : (
                        <>
                          <StatusChips statuses={profile.tickets.map((t) => t.status)} value={statusFilter} onChange={setStatusFilter} />
                          <CardList>
                            {filterByStatus(profile.tickets, statusFilter, (t) => t.status).map((t) => (
                              <SupportTicketCard key={t.id} t={t} />
                            ))}
                          </CardList>
                        </>
                      )}
                    </TabsContent>

                    {/* Everything this customer did and every error they hit, from the VeloxVerse
                        customer-journey audit log (detail kept a few days). */}
                    <TabsContent value="activity">
                      <CustomerActivity kind="user" id={data.user.id} />
                    </TabsContent>

                    <TabsContent value="forms">
                      {profile.leads.length === 0 ? (
                        <EmptyState icon={FileText} text="No form requests." />
                      ) : (
                        <CardList>{profile.leads.map((l) => <FormLeadCard key={l.id} lead={l} />)}</CardList>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </Card>
          </div>
        </div>
      )}

      <EventDrawer />

      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)} title="Deactivate account?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{data?.user.email} will no longer be able to sign in.</p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            If this user was referred, the referrer's referral reward will be clawed back.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmBlock(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void handleStatus(false)} loading={setStatus.isPending}>Deactivate</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
