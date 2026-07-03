import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Clock,
  Globe,
  Mail,
  ShoppingBag,
  Smartphone,
  Sofa,
  Car,
  Headphones,
  Wallet,
  UserCheck,
  UserRound,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import type { VVAdminUser } from '@/features/veloxverse-admin/types'
import { formatUsd, formatDate, formatDateTime, statusBadgeVariant } from '@/features/veloxverse-admin/utils'
import { useVeloxVerseCustomerProfile } from '../hooks/useVeloxVerseCustomerProfile'
import type { CustomerActivityItem } from '../utils/veloxverseActivity'

interface Props {
  open: boolean
  onClose: () => void
  user: VVAdminUser | null
}

const KIND_ICON: Record<CustomerActivityItem['kind'], typeof Smartphone> = {
  ESIM: Smartphone,
  LOUNGE: Sofa,
  TRANSFER: Car,
  SUPPORT: Headphones,
  MEMBERSHIP: Sofa,
}

function ActivityRow({ item }: { item: CustomerActivityItem }) {
  const Icon = KIND_ICON[item.kind]
  return (
    <li className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
          {item.isPending && !item.isCancelled && (
            <Badge variant="warning">Action needed</Badge>
          )}
        </div>
        {item.subtitle && <p className="text-xs text-gray-500">{item.subtitle}</p>}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">{item.kind}</p>
      </div>
      {item.amountUsd != null && (
        <span className="shrink-0 text-sm font-medium text-gray-900">
          {formatUsd(item.amountUsd)}
        </span>
      )}
    </li>
  )
}

export default function VeloxVerseCustomerDetailModal({ open, onClose, user }: Props) {
  const navigate = useNavigate()
  const profile = useVeloxVerseCustomerProfile(user?.id ?? null, user?.email)

  if (!user) return null

  const isGuest = user.role === 'GUEST'
  const displayName = user.fullName || user.email

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={displayName}
      description={`VeloxVerse ${isGuest ? 'guest' : 'registered user'} · ${user.email}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onClose()
              navigate(`/dashboard/veloxverse/users/${user.id}`)
            }}
          >
            Open in VV Users
          </Button>
        </>
      }
    >
      <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1 text-sm">
        {/* Account type explainer */}
        <div
          className={`rounded-xl border px-4 py-3 ${
            isGuest
              ? 'border-amber-200 bg-amber-50'
              : 'border-sky-200 bg-sky-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {isGuest ? (
              <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {isGuest ? 'Guest account' : 'Registered user'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                {isGuest ? (
                  <>
                    Passwordless OTP login with no saved profile name. Guests can browse, search
                    services, and place orders; activity below includes bookings, cancellations,
                    and refunds tied to this email.
                    {user.guestExpiresAt && (
                      <> Session window ends {formatDate(user.guestExpiresAt)}.</>
                    )}
                  </>
                ) : (
                  <>
                    Full VeloxVerse account with verified identity. Below you can see wallet
                    balance, every service they ordered or cancelled, pending actions, and support
                    tickets — all loaded live from VeloxVerse.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {profile.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label="Loading customer activity…" />
          </div>
        ) : profile.isError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Could not load VeloxVerse profile. Check that the VeloxVerse bridge is running.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs">Wallet</span>
                </div>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {formatUsd(profile.detail?.wallet.balance ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-xs">Orders</span>
                </div>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {profile.detail?.orders.length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Pending</span>
                </div>
                <p className="mt-1 text-lg font-bold text-amber-600">{profile.pendingCount}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs">Status</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {user.isActive ? 'Active' : 'Inactive'}
                  <span className="ml-1 font-normal text-gray-500">
                    · {user.isVerified ? 'Verified' : 'Unverified'}
                  </span>
                </p>
              </div>
            </div>

            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">
                  Activity ({profile.activity.length})
                </TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="support">
                  Support ({profile.tickets.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="pt-4">
                {profile.activity.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">
                    No orders, bookings, or tickets yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {profile.activity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="services" className="space-y-4 pt-4">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    eSIM orders
                  </h3>
                  {(profile.detail?.orders ?? []).length === 0 ? (
                    <p className="text-gray-500">No eSIM orders.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.detail!.orders.map((o) => (
                        <li
                          key={o.orderNo}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{o.packageName}</p>
                            <p className="font-mono text-xs text-gray-500">{o.orderNo}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={statusBadgeVariant(o.status)}>{o.status}</Badge>
                            <span className="text-gray-700">{formatUsd(o.sellingPrice)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Lounge memberships
                  </h3>
                  {profile.memberships.length === 0 ? (
                    <p className="text-gray-500">No lounge memberships.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.memberships.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{m.tier}</p>
                            <p className="text-xs text-gray-500">
                              {m.visitsRemaining} visits left · valid to {formatDate(m.validTo)}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariant(m.status)}>{m.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Transfer bookings
                  </h3>
                  {profile.transfers.length === 0 ? (
                    <p className="text-gray-500">No transfer bookings.</p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.transfers.map((t) => (
                        <li
                          key={t.orderNo}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {t.pickupLocation} → {t.dropoffLocation}
                            </p>
                            <p className="text-xs text-gray-500">{t.orderNo}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge>
                            <span className="text-gray-700">
                              {formatUsd(t.amountCents / 100)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {(profile.detail?.devices ?? []).length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Devices
                    </h3>
                    <ul className="space-y-1">
                      {profile.detail!.devices.map((d) => (
                        <li key={d.id} className="text-gray-700">
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

              <TabsContent value="support" className="pt-4">
                {profile.tickets.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">No support tickets.</p>
                ) : (
                  <ul className="space-y-2">
                    {profile.tickets.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={`/dashboard/veloxverse/support/${t.id}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 transition-colors hover:bg-gray-50"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{t.subject}</p>
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
            </Tabs>

            <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <Mail className="h-3.5 w-3.5" />
              Joined {formatDate(user.createdAt)} · Role {user.role}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
