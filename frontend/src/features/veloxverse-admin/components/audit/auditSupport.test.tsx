import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROLE_CREATION_RIGHTS, getRoleHome } from '@/config/roles'
import { SIDEBAR_CONFIG } from '@/config/sidebarConfig'
import { roleRequiresVerification } from '@/config/verificationDocs'
import type { User, UserRole } from '@/types'
import { AuditTabs, CustomerCell, MaskedNote } from './AuditUI'

function signIn(role: UserRole) {
  useAuthStore.setState({ user: { id: 1, name: 'Staff', email: 'staff@example.com', role } as unknown as User })
}

afterEach(() => useAuthStore.setState({ user: null }))

describe('support role config (Phase 2)', () => {
  it('lands support staff on the audit log and gives them only that in the sidebar', () => {
    expect(getRoleHome('support')).toBe('/dashboard/veloxverse/audit-logs')
    expect(SIDEBAR_CONFIG.support.map((i) => i.path)).toEqual(['/dashboard/veloxverse/audit-logs'])
  })

  it('only super admins and admins can create support accounts; support creates nobody', () => {
    expect(ROLE_CREATION_RIGHTS.super_admin).toContain('support')
    expect(ROLE_CREATION_RIGHTS.admin).toContain('support')
    expect(ROLE_CREATION_RIGHTS.employee).not.toContain('support')
    expect(ROLE_CREATION_RIGHTS.support).toEqual([])
  })

  it('support staff are internal — no document verification', () => {
    expect(roleRequiresVerification('support')).toBe(false)
  })
})

describe('audit UI by role', () => {
  const customer = { id: 'a5d5977b-28c8-470e-8e41-e2e3c32d2507', email: 'j***@e***.com', name: 'J. D.', role: 'USER' }

  it('hides the Settings tab and shows the masking note for support', () => {
    signIn('support')
    render(<MemoryRouter><AuditTabs /><MaskedNote /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stuck customers' })).toBeInTheDocument()
    expect(screen.getByText(/masked for support/i)).toBeInTheDocument()
  })

  it('shows Settings and no masking note for admins', () => {
    signIn('admin')
    render(<MemoryRouter><AuditTabs /><MaskedNote /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByText(/masked for support/i)).not.toBeInTheDocument()
  })

  it('links support to the audit-only customer timeline, admins to the full profile', () => {
    signIn('support')
    const { unmount } = render(<MemoryRouter><CustomerCell customer={customer} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', `/dashboard/veloxverse/audit-logs/customers/${customer.id}`)
    // Masked values are rendered exactly as VeloxVerse sent them.
    expect(screen.getByText('j***@e***.com')).toBeInTheDocument()
    unmount()

    signIn('super_admin')
    render(<MemoryRouter><CustomerCell customer={{ ...customer, email: 'jane.doe@example.com' }} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', `/dashboard/veloxverse/users/${customer.id}?tab=activity`)
  })
})
