import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import FocusTrap from 'focus-trap-react'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/features/veloxverse-admin/components/vv-audit/useMediaQuery'
import { findVisibleTarget } from './targets'
import type { TourStep } from './tourSteps'

interface Props {
  steps: TourStep[]
  /** Finished the last step. */
  onComplete: () => void
  /** Skip, close or Esc. */
  onDismiss: () => void
}

const CARD_WIDTH = 360
const GAP = 16
const PAD = 6 // spotlight padding around the target

/** Where the desktop card goes: beside the target if there is room, else below / above, else centred. */
function cardPosition(rect: DOMRect | null, cardHeight: number): CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect) return { left: Math.max(GAP, (vw - CARD_WIDTH) / 2), top: Math.max(GAP, (vh - cardHeight) / 2) }
  const clampTop = (top: number) => Math.min(Math.max(GAP, top), Math.max(GAP, vh - cardHeight - GAP))
  const clampLeft = (left: number) => Math.min(Math.max(GAP, left), Math.max(GAP, vw - CARD_WIDTH - GAP))
  if (rect.right + PAD + GAP + CARD_WIDTH <= vw - GAP) return { left: rect.right + PAD + GAP, top: clampTop(rect.top - PAD) }
  if (rect.left - PAD - GAP - CARD_WIDTH >= GAP) return { left: rect.left - PAD - GAP - CARD_WIDTH, top: clampTop(rect.top - PAD) }
  if (rect.bottom + PAD + GAP + cardHeight <= vh - GAP) return { left: clampLeft(rect.left), top: rect.bottom + PAD + GAP }
  return { left: clampLeft(rect.left), top: clampTop(rect.top - PAD - GAP - cardHeight) }
}

/**
 * Spotlight tour: dims the page, cuts out the current step's target, and shows a card beside it
 * (≥ md) or a bottom sheet (phones). Steps whose target is missing were dropped before this
 * mounts; if a target vanishes mid-tour (e.g. a resize) that step just shows without a spotlight.
 */
export default function WelcomeTour({ steps, onComplete, onDismiss }: Props) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardHeight, setCardHeight] = useState(260)
  const cardRef = useRef<HTMLDivElement>(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const titleId = useId()
  const bodyId = useId()

  const step = steps[index]
  const isLast = index === steps.length - 1
  const StepIcon = step.icon

  const next = useCallback(() => (isLast ? onComplete() : setIndex((i) => i + 1)), [isLast, onComplete])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Track the target's position while the step is showing.
  useLayoutEffect(() => {
    const el = step.target ? findVisibleTarget(step.target) : null
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(findVisibleTarget(step.target!) ? el.getBoundingClientRect() : null))
    }
    setRect(el.getBoundingClientRect())
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [index, isDesktop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, onDismiss])

  const progress = `${Math.round(((index + 1) / steps.length) * 100)}%`

  return (
    <div className="fixed inset-0 z-[80]" data-onboarding-tour>
      {/* Click shield: the page underneath can't be used while the tour is open. */}
      <div className={cn('absolute inset-0', !rect && 'bg-guide-scrim')} aria-hidden="true" />
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/80 motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px var(--color-guide-scrim)',
          }}
        />
      )}

      <FocusTrap
        focusTrapOptions={{
          initialFocus: '[data-tour-primary]',
          escapeDeactivates: false, // Esc is handled above (it dismisses the tour)
          clickOutsideDeactivates: false,
          allowOutsideClick: true,
          returnFocusOnDeactivate: true,
          fallbackFocus: () => cardRef.current ?? document.body,
        }}
      >
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          data-onboarding-tour
          className={cn(
            'absolute overflow-hidden bg-guide-surface text-guide-text shadow-2xl',
            isDesktop
              ? 'rounded-2xl motion-safe:transition-[top,left] motion-safe:duration-200'
              : 'inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
          )}
          style={isDesktop ? { width: CARD_WIDTH, ...cardPosition(rect, cardHeight) } : undefined}
        >
          {/* Header band */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-guide-band-from to-guide-band-to px-4 py-3 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/35 to-white/10 ring-1 ring-white/40">
              <StepIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-xs font-medium text-white/90">
              {step.section && <span className="block truncate text-[11px] uppercase tracking-wider text-white/75">{step.section}</span>}
              Step {index + 1} of {steps.length}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close tour"
              className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {/* Progress */}
          <div className="h-1 bg-guide-accent-soft" aria-hidden="true">
            <div className="h-full bg-guide-accent motion-safe:transition-[width] motion-safe:duration-300" style={{ width: progress }} />
          </div>

          <div className="px-5 pt-4 pb-2">
            <h2 id={titleId} className="text-base font-semibold">{step.title}</h2>
            <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-guide-muted">{step.body}</p>
          </div>

          <div className="flex items-center justify-between gap-2 px-5 pt-2 pb-4">
            <Button variant="ghost" size="sm" onClick={onDismiss} className="min-h-11">
              Skip tour
            </Button>
            <div className="flex gap-2">
              {index > 0 && (
                <Button variant="outline" size="sm" onClick={back} className="min-h-11">
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next} data-tour-primary className="min-h-11 min-w-20">
                {isLast ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Step {index + 1} of {steps.length}: {step.title}
          </p>
        </div>
      </FocusTrap>
    </div>
  )
}
