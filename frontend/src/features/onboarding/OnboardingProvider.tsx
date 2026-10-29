import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/features/auth/authService'
import { getRoleHome } from '@/config/roles'
import type { User } from '@/types'
import { OnboardingContext } from './onboardingContext'
import { AUTO_TOUR_ROLES, CURRENT_TOUR_VERSION, shouldOfferTour } from './tourConfig'
import { onboardingService, type TourResult } from './onboardingService'
import { tourStepsForRole, type TourStep } from './tourSteps'
import { findVisibleTarget, isAnyDialogOpen } from './targets'
import { guideTopicsForRole } from './guideTopics'
import WelcomeTour from './WelcomeTour'
import QuickGuide from './QuickGuide'

/** How often (ms) we check that no dialog is open, and how many calm checks in a row start the tour. */
export const CALM_CHECK_MS = 400
const CALM_CHECKS = 2

interface RunningTour {
  steps: TourStep[]
  userId: number
  pathname: string
}

export const tourMeQueryKey = (userId: number | undefined) => ['auth', 'me', 'tour', userId] as const

/**
 * Welcome tour + Quick Guide for everything inside AppLayout.
 *
 * Tour: starts by itself once per app session, on the user's home page, only after the fresh
 * GET /auth/me says it should (tourConfig.shouldOfferTour) and no dialog/drawer is open. Finish
 * saves 'completed', Skip/Esc saves 'dismissed'; a route change, sign-out or expired session
 * mid-tour just ends it and saves nothing.
 *
 * Guide: opened from the avatar menu or by ?guide=<topic-id> on any page. An unknown id, or one
 * the role can't see, opens the guide with nothing expanded.
 */
export default function OnboardingProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [guideOpen, setGuideOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tour, setTour] = useState<RunningTour | null>(null)
  const [replayRequested, setReplayRequested] = useState(false)
  /** User id the tour was already offered to in this app session (saved or not). */
  const [offeredTo, setOfferedTo] = useState<number | null>(null)
  const previousPath = useRef(location.pathname)

  const home = getRoleHome(user?.role)
  const onHome = !!user && location.pathname === home

  // Fresh tour state — the persisted profile may be stale (another device, a re-login).
  const me = useQuery({
    queryKey: tourMeQueryKey(user?.id),
    queryFn: authService.getMe,
    enabled: !!user && AUTO_TOUR_ROLES[user.role] && onHome && offeredTo !== user.id,
    staleTime: Infinity,
    retry: false,
  })

  const autoStart = !!user && !!me.data && me.data.id === user.id && offeredTo !== user.id && shouldOfferTour(me.data, location.pathname)
  const wantsTour = !tour && !guideOpen && onHome && (autoStart || replayRequested)

  // Start once nothing else (dialog, drawer, the guide) is open for a moment.
  useEffect(() => {
    if (!wantsTour || !user) return
    let calm = 0
    const timer = window.setInterval(() => {
      calm = isAnyDialogOpen() ? 0 : calm + 1
      if (calm < CALM_CHECKS) return
      window.clearInterval(timer)
      const steps = tourStepsForRole(user.role).filter((step) => !step.target || findVisibleTarget(step.target))
      setOfferedTo(user.id)
      setReplayRequested(false)
      setTour({ steps, userId: user.id, pathname: location.pathname })
    }, CALM_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [wantsTour, user, location.pathname])

  // A different (or no) user: start from a closed guide and no pending replay.
  useEffect(() => {
    setGuideOpen(false)
    setReplayRequested(false)
  }, [user?.id])

  // Leaving the page, signing out or an expired session (401 clears the user) ends the tour unsaved.
  useEffect(() => {
    if (tour && (!user || user.id !== tour.userId || location.pathname !== tour.pathname)) setTour(null)
  }, [tour, user, location.pathname])

  // A pending replay is dropped if the user leaves the home page before it starts.
  useEffect(() => {
    if (previousPath.current === home && location.pathname !== home) setReplayRequested(false)
    previousPath.current = location.pathname
  }, [home, location.pathname])

  const finishTour = useCallback(
    (result: TourResult) => {
      const userId = tour?.userId
      setTour(null)
      if (userId == null) return
      onboardingService
        .saveTourResult(result, CURRENT_TOUR_VERSION)
        .then((saved) => queryClient.setQueryData<User>(tourMeQueryKey(userId), (old) => (old ? { ...old, ...saved } : old)))
        .catch(() => {
          // Not saved: it is offered again on the next app load. Nothing to tell the user.
        })
    },
    [tour, queryClient],
  )

  // ?guide=<id>: open the guide, then drop the parameter so Back / refresh don't reopen it.
  const guideParam = searchParams.get('guide')
  useEffect(() => {
    if (guideParam === null || !user) return
    const visible = guideTopicsForRole(user.role).some((topic) => topic.id === guideParam)
    setExpanded(visible ? guideParam : null)
    setGuideOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('guide')
        return next
      },
      { replace: true },
    )
  }, [guideParam, user, setSearchParams])

  const openGuide = useCallback(
    (topicId?: string) => {
      const visible = !!topicId && guideTopicsForRole(user?.role).some((topic) => topic.id === topicId)
      setExpanded(visible ? topicId! : null)
      setGuideOpen(true)
    },
    [user?.role],
  )

  const replayTour = useCallback(() => {
    if (!user) return
    setGuideOpen(false)
    setReplayRequested(true)
    if (location.pathname !== home) navigate(home)
  }, [user, home, location.pathname, navigate])

  const value = useMemo(() => ({ openGuide, replayTour }), [openGuide, replayTour])

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {user && (
        <QuickGuide
          open={guideOpen}
          role={user.role}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onClose={() => setGuideOpen(false)}
          onReplayTour={replayTour}
        />
      )}
      {tour && tour.steps.length > 0 && (
        <WelcomeTour steps={tour.steps} onComplete={() => finishTour('completed')} onDismiss={() => finishTour('dismissed')} />
      )}
    </OnboardingContext.Provider>
  )
}
