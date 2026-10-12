import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/axios'
import { AppErrorBoundary, RouteErrorScreen } from '@/components/ErrorScreen'
import type { User } from '@/types'

const user = (id: number) => ({ id, name: 'Staff', email: `s${id}@example.com`, role: 'admin' }) as unknown as User

afterEach(() => {
  queryClient.clear()
  useAuthStore.setState({ user: null })
  vi.restoreAllMocks()
})

describe('cached data never outlives the session', () => {
  it('signing out empties the query cache', () => {
    useAuthStore.setState({ user: user(1) })
    queryClient.setQueryData(['customers'], [{ id: 1, name: 'Private customer' }])
    useAuthStore.getState().clearAuth()
    expect(queryClient.getQueryData(['customers'])).toBeUndefined()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('a different user signing in does not inherit the previous cache', () => {
    useAuthStore.setState({ user: user(1) })
    queryClient.setQueryData(['customers'], ['a'])
    useAuthStore.getState().setUser(user(2))
    expect(queryClient.getQueryData(['customers'])).toBeUndefined()
  })

  it("refreshing the same user's profile keeps the cache", () => {
    useAuthStore.setState({ user: user(1) })
    queryClient.setQueryData(['customers'], ['a'])
    useAuthStore.getState().setUser({ ...user(1), name: 'Renamed' } as User)
    expect(queryClient.getQueryData(['customers'])).toEqual(['a'])
  })
})

describe('expired session', () => {
  const failWith = (status: number, url: string) => {
    const handlers = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<never> }> }).handlers
    return handlers[handlers.length - 1].rejected({ response: { status, data: {} }, config: { url, method: 'get' } }).catch(() => undefined)
  }

  it('a 401 on a VeloxVerse page ends the session (was: empty tables)', async () => {
    useAuthStore.setState({ user: user(1) })
    queryClient.setQueryData(['vv-users'], ['x'])
    await failWith(401, '/vv-admin/admin/users')
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryData(['vv-users'])).toBeUndefined()
  })

  it('a VeloxVerse-side failure (502) does not log anyone out', async () => {
    useAuthStore.setState({ user: user(1) })
    await failWith(502, '/vv-admin/admin/users')
    expect(useAuthStore.getState().user).not.toBeNull()
  })

  it('a wrong password on the login form is not treated as an expired session', async () => {
    useAuthStore.setState({ user: user(1) })
    await failWith(401, '/auth/login')
    expect(useAuthStore.getState().user).not.toBeNull()
  })
})

describe('error boundaries', () => {
  const Boom = () => {
    throw new Error('render exploded')
  }

  it('a page that throws shows a message instead of a blank screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteErrorScreen /> }])
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    // No stack trace or internal error text is shown to the visitor.
    expect(screen.queryByText(/render exploded/)).toBeNull()
  })

  it('the app-level boundary catches errors outside the router', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })
})

describe('VeloxVerse refuses the CRM connection', () => {
  const reject = (response: unknown, url: string) => {
    const handlers = (api.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<never> }> }).handlers
    return handlers[handlers.length - 1].rejected({ response, config: { url, method: 'get' } }).catch(() => undefined)
  }
  const succeed = (url: string) => {
    const handlers = (api.interceptors.response as unknown as { handlers: Array<{ fulfilled: (r: unknown) => unknown }> }).handlers
    return handlers[handlers.length - 1].fulfilled({ status: 200, config: { url, method: 'get' }, data: {} })
  }

  it('shows the message, keeps the admin signed in, and clears once VeloxVerse answers again', async () => {
    const { useBridgeStatusStore } = await import('@/store/bridgeStatusStore')
    useAuthStore.setState({ user: user(1) })
    await reject(
      { status: 502, data: { code: 'VELOXVERSE_BRIDGE_REJECTED', message: 'VeloxVerse rejected the CRM connection — contact the administrator' } },
      '/vv-admin/admin/users'
    )
    expect(useBridgeStatusStore.getState().rejectedMessage).toBe('VeloxVerse rejected the CRM connection — contact the administrator')
    expect(useAuthStore.getState().user).not.toBeNull()

    succeed('/vv-admin/admin/users')
    expect(useBridgeStatusStore.getState().rejectedMessage).toBeNull()
  })

  it('an ordinary VeloxVerse outage (502 without the code) does not raise it', async () => {
    const { useBridgeStatusStore } = await import('@/store/bridgeStatusStore')
    await reject({ status: 502, data: { message: 'VeloxVerse service is not available.' } }, '/vv-admin/admin/users')
    expect(useBridgeStatusStore.getState().rejectedMessage).toBeNull()
  })
})
