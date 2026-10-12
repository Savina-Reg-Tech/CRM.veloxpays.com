import { describe, expect, it } from 'vitest'
import { deactivateConfirmation, isVVStaffRole, roleChangeConfirmation, vvRoleLabel, vvUserControls } from './userAccess'

const customer = { email: 'jane@example.com', role: 'USER' }
const guest = { email: 'g@example.com', role: 'GUEST' }
const staff = (role: string) => ({ email: `${role.toLowerCase()}@velox.example`, role })

describe('vvUserControls — which controls are shown', () => {
  it('a CRM admin gets no role control anywhere', () => {
    for (const target of [customer, guest, staff('ADMIN'), staff('SUPER_ADMIN'), staff('SUPPORT')]) {
      expect(vvUserControls({ crmRole: 'admin', crmEmail: 'a@crm.example', target }).canChangeRole).toBe(false)
    }
  })

  it('a CRM admin can still block a customer or guest, but not switch staff accounts on or off', () => {
    const as = (target: { email: string; role: string }) => vvUserControls({ crmRole: 'admin', crmEmail: 'a@crm.example', target })
    expect(as(customer).canToggleStatus).toBe(true)
    expect(as(guest).canToggleStatus).toBe(true)
    for (const r of ['ADMIN', 'SUPER_ADMIN', 'SUPPORT']) expect(as(staff(r)).canToggleStatus).toBe(false)
  })

  it('a CRM super admin gets both controls on every other account', () => {
    for (const target of [customer, guest, staff('ADMIN'), staff('SUPER_ADMIN'), staff('SUPPORT')]) {
      const c = vvUserControls({ crmRole: 'super_admin', crmEmail: 'root@crm.example', target })
      expect(c).toEqual({ isSelf: false, canChangeRole: true, canToggleStatus: true })
    }
  })

  it('nobody gets controls on their own account (matched by email, any case)', () => {
    const c = vvUserControls({ crmRole: 'super_admin', crmEmail: ' Root@CRM.example ', target: { email: 'root@crm.example', role: 'SUPER_ADMIN' } })
    expect(c).toEqual({ isSelf: true, canChangeRole: false, canToggleStatus: false })
  })

  it('other CRM roles get nothing', () => {
    for (const crmRole of ['support', 'employee', undefined]) {
      const c = vvUserControls({ crmRole, crmEmail: 'x@crm.example', target: customer })
      expect(c.canChangeRole).toBe(false)
      expect(c.canToggleStatus).toBe(false)
    }
  })
})

describe('labels and confirmations', () => {
  it('names every role', () => {
    expect(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER', 'GUEST'].map(vvRoleLabel)).toEqual(['Super admin', 'Admin', 'Support', 'Registered', 'Guest'])
    expect(isVVStaffRole('SUPPORT')).toBe(true)
    expect(isVVStaffRole('USER')).toBe(false)
  })

  it('uses the confirmation wording from the spec', () => {
    expect(roleChangeConfirmation('Jane Doe', 'USER', 'ADMIN')).toBe("Change Jane Doe's role from Registered to Admin? They will be signed out of VeloxVerse.")
    expect(deactivateConfirmation('Jane Doe')).toBe('Deactivate Jane Doe? They will be signed out of VeloxVerse.')
  })
})

describe('account status — Active / Blocked / Inactive', async () => {
  const { vvAccountStatus, vvBlockAction, formatBlockedDate } = await import('./userAccess')
  const { normalizeVVUser } = await import('./vvAdminService')

  it('reads the two flags together', () => {
    expect(vvAccountStatus({ isActive: true, isBlocked: false }).label).toBe('Active')
    expect(vvAccountStatus({ isActive: false, isBlocked: true, blockedAt: '2026-10-12T08:00:00.000Z' }).label).toBe('Blocked')
    expect(vvAccountStatus({ isActive: false, isBlocked: false }).label).toBe('Inactive')
  })

  it('an idle guest that was never blocked is Inactive, not Blocked', () => {
    const s = vvAccountStatus({ isActive: false, isBlocked: false, blockedAt: null })
    expect(s.status).toBe('inactive')
    expect(s.tooltip).toBeUndefined()
  })

  it('Blocked carries the date and who can undo it', () => {
    const s = vvAccountStatus({ isActive: false, isBlocked: true, blockedAt: '2026-10-12T08:00:00.000Z' })
    expect(s.variant).toBe('danger')
    expect(s.tooltip).toBe(`Blocked on ${formatBlockedDate('2026-10-12T08:00:00.000Z')}. Only an admin can unblock.`)
    expect(s.tooltip).toMatch(/2026/)
    expect(vvAccountStatus({ isActive: false, isBlocked: true, blockedAt: null }).tooltip).toBe('Blocked. Only an admin can unblock.')
  })

  it('a response without isBlocked (older VeloxVerse) means not blocked', () => {
    expect(vvAccountStatus({ isActive: false }).status).toBe('inactive')
    const u = normalizeVVUser({ id: 'u1', isActive: false } as never) as { isBlocked: boolean; blockedAt: string | null }
    expect(u.isBlocked).toBe(false)
    expect(u.blockedAt).toBeNull()
  })

  it('the button is Unblock only for a blocked account; Block stays available on an inactive guest', () => {
    expect(vvBlockAction({ isBlocked: true })).toBe('unblock')
    expect(vvBlockAction({ isBlocked: false })).toBe('block')
    expect(vvBlockAction({})).toBe('block') // inactive guest, never blocked
  })
})
