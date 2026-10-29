import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import type { RouteObject } from 'react-router-dom'
import RoleGuard from '@/routes/RoleGuard'
import { appRoutes } from '@/app/Router'
import { ALL_ROLES } from './roles'
import { SIDEBAR_CONFIG } from './sidebarConfig'
import { ROUTE_ACCESS, canAccess } from './routeAccess'
// Captured from Router.tsx *before* its RoleGuard roles moved into routeAccess.ts.
import baseline from './routeRoles.baseline.json'

/** path → roles of the nearest enclosing <RoleGuard> (null = no guard), read from the live router. */
function rolesByPath(routes: RouteObject[], roles: string[] | null = null, out: Record<string, string[] | null> = {}) {
  for (const route of routes) {
    let next = roles
    if (isValidElement(route.element) && route.element.type === RoleGuard) {
      next = [...(route.element.props as { allowedRoles: readonly string[] }).allowedRoles]
    }
    if (route.path) out[route.path] = next
    if (route.children) rolesByPath(route.children, next, out)
  }
  return out
}

const live = rolesByPath(appRoutes)

describe('route access refactor', () => {
  it('every route keeps exactly the roles it had before the refactor', () => {
    expect(live).toEqual(baseline)
  })

  it('ROUTE_ACCESS lists exactly the role-guarded routes, with the router’s roles', () => {
    const guarded = Object.fromEntries(Object.entries(live).filter(([, roles]) => roles !== null))
    expect(Object.fromEntries(Object.entries(ROUTE_ACCESS).map(([p, r]) => [p, [...r]]))).toEqual(guarded)
  })

  it('canAccess() agrees with the router for every role on every guarded route', () => {
    for (const [pattern, roles] of Object.entries(live)) {
      if (!roles) continue
      const sample = pattern.replace(/:[^/]+/g, 'x1')
      for (const role of ALL_ROLES) {
        expect(canAccess(role, sample), `${role} → ${sample}`).toBe(roles.includes(role))
      }
    }
  })

  it('canAccess() ignores query/hash and refuses unknown paths and missing roles', () => {
    expect(canAccess('admin', '/dashboard/veloxverse/lounge?tab=dining#x')).toBe(true)
    expect(canAccess('support', '/dashboard/veloxverse/lounge?tab=dining')).toBe(false)
    expect(canAccess('admin', '/dashboard/nope')).toBe(false)
    expect(canAccess(null, '/dashboard/customers')).toBe(false)
  })

  it('every sidebar link is a page its role can open', () => {
    for (const role of ALL_ROLES) {
      for (const item of SIDEBAR_CONFIG[role]) {
        expect(canAccess(role, item.path), `${role} → ${item.path}`).toBe(true)
      }
    }
  })
})
