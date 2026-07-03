import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoleGuard from './RoleGuard'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// Tiny landing pages used as the route outlets so we can assert which one
// React Router actually mounted.
function ProtectedPage() {
  return <h1>Protected content</h1>
}

function FallbackPage() {
  return <h1>Fallback dashboard</h1>
}

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<RoleGuard allowedRoles={['super_admin', 'admin']} />}>
          <Route path="/admin" element={<ProtectedPage />} />
        </Route>
        <Route path="/dashboard" element={<FallbackPage />} />
      </Routes>
    </MemoryRouter>
  )
}

const makeUser = (role: User['role']): User => ({
  id: 1,
  name: 'Test',
  email: 'test@example.com',
  role,
  is_active: true,
})

describe('<RoleGuard />', () => {
  beforeEach(() => {
    // Each test should start with a fresh, empty auth store.
    useAuthStore.setState({ user: null })
  })

  it('renders the protected content when the user role is allowed', () => {
    useAuthStore.setState({ user: makeUser('admin') })
    renderWithRouter()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /dashboard when the user role is NOT allowed', () => {
    useAuthStore.setState({ user: makeUser('agent') })
    renderWithRouter()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('Fallback dashboard')).toBeInTheDocument()
  })

  it('redirects to /dashboard when there is no logged-in user', () => {
    renderWithRouter()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('Fallback dashboard')).toBeInTheDocument()
  })
})
