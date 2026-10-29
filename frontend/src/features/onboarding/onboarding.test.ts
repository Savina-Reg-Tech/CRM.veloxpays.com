import { describe, it, expect, afterEach } from 'vitest'
import { ALL_ROLES } from '@/config/roles'
import { canAccess } from '@/config/routeAccess'
import type { User, UserRole } from '@/types'
import { CURRENT_TOUR_VERSION, shouldOfferTour } from './tourConfig'
import { GUIDE_TOPICS, guideTopicsForRole, matchesGuideSearch, topicShareUrl } from './guideTopics'
import { tourStepsForRole } from './tourSteps'
import { findVisibleTarget, isAnyDialogOpen, navTarget } from './targets'
import { SIDEBAR_CONFIG } from '@/config/sidebarConfig'

type Me = Pick<User, 'role' | 'account_status' | 'tour_status' | 'tour_version'>
const me = (over: Partial<Me> = {}): Me => ({ role: 'admin', account_status: 'active', tour_status: null, tour_version: null, ...over })

describe('shouldOfferTour', () => {
  it('offers to new staff (no decision yet) on their home page', () => {
    expect(shouldOfferTour(me(), '/dashboard/admin')).toBe(true)
    expect(shouldOfferTour(me({ role: 'employee' }), '/dashboard/me')).toBe(true)
    expect(shouldOfferTour(me({ role: 'support' }), '/dashboard/veloxverse/audit-logs')).toBe(true)
  })

  it('only on the home page', () => {
    expect(shouldOfferTour(me(), '/dashboard/customers')).toBe(false)
  })

  it('never to staff backfilled as not_offered', () => {
    expect(shouldOfferTour(me({ tour_status: 'not_offered' }), '/dashboard/admin')).toBe(false)
  })

  it('not again for the current version, but again once the version goes up', () => {
    for (const tour_status of ['completed', 'dismissed'] as const) {
      expect(shouldOfferTour(me({ tour_status, tour_version: CURRENT_TOUR_VERSION }), '/dashboard/admin')).toBe(false)
      expect(shouldOfferTour(me({ tour_status, tour_version: CURRENT_TOUR_VERSION - 1 }), '/dashboard/admin')).toBe(true)
    }
  })

  it('not when the profile did not come from /auth/me (no tour fields)', () => {
    expect(shouldOfferTour({ role: 'admin', account_status: 'active' }, '/dashboard/admin')).toBe(false)
    expect(shouldOfferTour(null, '/dashboard/admin')).toBe(false)
  })

  it('agent and affiliate are switched off for now', () => {
    expect(shouldOfferTour(me({ role: 'agent' }), '/dashboard/me')).toBe(false)
    expect(shouldOfferTour(me({ role: 'affiliate' }), '/dashboard/me')).toBe(false)
  })

  it('not while an account still owes verification', () => {
    expect(shouldOfferTour(me({ role: 'employee', account_status: 'pending' }), '/dashboard/me')).toBe(false)
  })
})

/** topic id → roles that see it, computed from canAccess() via guideTopicsForRole(). */
const topicRoles = () =>
  Object.fromEntries(
    GUIDE_TOPICS.map((t) => [t.id, ALL_ROLES.filter((role) => guideTopicsForRole(role).some((v) => v.id === t.id))]),
  )

describe('Quick Guide topics', () => {
  it('topic → roles (generated from canAccess)', () => {
    expect(topicRoles()).toMatchSnapshot()
  })

  it('every topic page and link is a real role-guarded route', () => {
    for (const topic of GUIDE_TOPICS) {
      for (const to of [topic.page, ...topic.links.map((l) => l.to)].filter(Boolean) as string[]) {
        expect(ALL_ROLES.some((role) => canAccess(role, to)), to).toBe(true)
      }
    }
  })

  it('links a role cannot open are removed from the topics it can see', () => {
    const verification = guideTopicsForRole('employee').find((t) => t.id === 'verification')!
    expect(verification.links.map((l) => l.to)).toEqual(['/dashboard/verification'])
    for (const role of ALL_ROLES as readonly UserRole[]) {
      for (const topic of guideTopicsForRole(role)) {
        for (const link of topic.links) expect(canAccess(role, link.to), `${role} → ${link.to}`).toBe(true)
      }
    }
  })

  it('search matches titles, steps and keywords, and needs every word', () => {
    const ids = (q: string) => GUIDE_TOPICS.filter((t) => matchesGuideSearch(t, q)).map((t) => t.id)
    expect(ids('')).toHaveLength(GUIDE_TOPICS.length)
    expect(ids('iccid')).toEqual(['esim'])
    expect(ids('residency')).toContain('app-users')
    expect(ids('mailinator')).toEqual(['forms-leads'])
    expect(ids('esim zzz-no-match')).toEqual([])
  })

  it('topic ids are unique', () => {
    expect(new Set(GUIDE_TOPICS.map((t) => t.id)).size).toBe(GUIDE_TOPICS.length)
  })

  it('share links point at the topic page with ?guide=', () => {
    const loc = { origin: 'https://crm.example', pathname: '/dashboard/me' }
    expect(topicShareUrl(GUIDE_TOPICS.find((t) => t.id === 'staff')!, loc)).toBe('https://crm.example/dashboard/employees?guide=staff')
    expect(topicShareUrl(GUIDE_TOPICS.find((t) => t.id === 'getting-around')!, loc)).toBe('https://crm.example/dashboard/me?guide=getting-around')
  })
})

describe('tour steps', () => {
  const ids = (role: UserRole) => tourStepsForRole(role).map((s) => s.id)

  it('cover every page in the role\'s sidebar, in sidebar order, between the intro and the header', () => {
    for (const role of ALL_ROLES) {
      const pageIds = SIDEBAR_CONFIG[role].map((item) => navTarget(item.path))
      expect(ids(role).filter((id) => id.startsWith('nav:'))).toEqual(pageIds)
      expect(ids(role).slice(0, 3)).toEqual(['welcome', 'menu-button', 'sidebar'])
      expect(ids(role).slice(-2)).toEqual(['notifications', 'user-menu'])
    }
    expect(ids('admin').filter((id) => id.startsWith('nav:'))).toHaveLength(24)
  })

  it('every sidebar page has tour text', () => {
    for (const role of ALL_ROLES) {
      for (const step of tourStepsForRole(role)) expect(step.body.length, step.id).toBeGreaterThan(20)
    }
  })

  it('only include pages the role can open', () => {
    expect(ids('support')).not.toContain(navTarget('/dashboard/customers'))
    expect(ids('support')).toContain(navTarget('/dashboard/veloxverse/audit-logs'))
    expect(ids('employee')).toEqual(expect.arrayContaining([navTarget('/dashboard/customers'), navTarget('/dashboard/employees'), navTarget('/dashboard/me')]))
    expect(ids('employee')).not.toContain(navTarget('/dashboard/veloxverse/payments'))
  })
})

describe('tour targets', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const place = (id: string, rect: Partial<DOMRect>) => {
    const el = document.createElement('div')
    el.dataset.tour = id
    el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect
    document.body.appendChild(el)
    return el
  }

  it('finds a showable target and skips missing, zero-size or off-canvas ones', () => {
    const shown = place('a', { top: 10, left: 10, right: 110, bottom: 40, width: 100, height: 30 })
    place('b', {})
    place('c', { top: 10, left: -300, right: -20, bottom: 40, width: 280, height: 30 })
    // Below the fold in a scrolling sidebar: still shown (the tour scrolls to it).
    const below = place('d', { top: 2000, left: 10, right: 110, bottom: 2030, width: 100, height: 30 })
    expect(findVisibleTarget('a')).toBe(shown)
    expect(findVisibleTarget('d')).toBe(below)
    expect(findVisibleTarget('b')).toBeNull()
    expect(findVisibleTarget('c')).toBeNull()
    expect(findVisibleTarget('missing')).toBeNull()
  })

  it('sees open dialogs, but not the tour itself', () => {
    document.body.innerHTML = '<div role="dialog" data-onboarding-tour aria-modal="true"></div>'
    expect(isAnyDialogOpen()).toBe(false)
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-modal="true"></div>')
    expect(isAnyDialogOpen()).toBe(true)
  })
})
