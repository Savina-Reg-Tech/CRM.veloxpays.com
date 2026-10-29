import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FocusTrap from 'focus-trap-react'
import { BookOpen, ChevronDown, ArrowRight, Link2, PlayCircle, Search, X } from 'lucide-react'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { guideTopicsForRole, matchesGuideSearch, topicShareUrl, type GuideTopic } from './guideTopics'

interface Props {
  open: boolean
  role: UserRole
  /** Expanded topic id, or null. Ids the role can't see are never rendered. */
  expanded: string | null
  onExpandedChange: (id: string | null) => void
  onClose: () => void
  onReplayTour: () => void
}

/** Right-hand drawer (≥ md) / full-height sheet (phones) with how-to topics for the user's role. */
export default function QuickGuide({ open, role, expanded, onExpandedChange, onClose, onReplayTour }: Props) {
  const titleId = useId()
  const searchId = useId()
  const [search, setSearch] = useState('')
  const topics = useMemo(() => guideTopicsForRole(role), [role])
  const sections = useMemo(() => {
    const out: { name: string; topics: GuideTopic[] }[] = []
    for (const topic of topics.filter((t) => matchesGuideSearch(t, search))) {
      const last = out[out.length - 1]
      if (last?.name === topic.section) last.topics.push(topic)
      else out.push({ name: topic.section, topics: [topic] })
    }
    return out
  }, [topics, search])

  // Each opening starts with an empty search.
  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true }}>
      <div className="fixed inset-0 z-[70]">
        <button type="button" aria-label="Close Quick Guide" tabIndex={-1} onClick={onClose} className="absolute inset-0 hidden bg-guide-scrim md:block" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="absolute inset-0 flex flex-col bg-guide-surface text-guide-text shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:max-w-full"
        >
          <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-guide-band-from to-guide-band-to px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/35 to-white/10 ring-1 ring-white/40">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold">Quick Guide</h2>
              <p className="text-xs text-white/85">How to do the everyday things in the CRM.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Quick Guide"
              className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="shrink-0 border-b border-guide-border px-4 py-3">
            <label htmlFor={searchId} className="sr-only">Search the Quick Guide</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guide-muted" aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the guide, e.g. refund, country, eSIM"
                className="block min-h-11 w-full rounded-lg border border-guide-border bg-guide-surface pl-9 pr-3 text-base text-guide-text placeholder:text-guide-muted focus:border-guide-accent focus:outline-none focus:ring-2 focus:ring-guide-accent-soft sm:text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {sections.length === 0 && (
              <p className="px-1 py-8 text-center text-sm text-guide-muted" role="status">
                Nothing matches “{search.trim()}”. Try another word.
              </p>
            )}
            {sections.map((section) => (
              <section key={section.name} className="mb-5 last:mb-0" aria-label={section.name}>
                <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-guide-muted">{section.name}</h3>
                <ul className="space-y-2">
                  {section.topics.map((topic) => (
                    <TopicItem
                      key={topic.id}
                      topic={topic}
                      expanded={expanded === topic.id}
                      onToggle={() => onExpandedChange(expanded === topic.id ? null : topic.id)}
                      onNavigate={onClose}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="shrink-0 border-t border-guide-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onReplayTour}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-guide-border text-sm font-medium text-guide-text hover:bg-guide-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guide-accent"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" /> Replay welcome tour
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  )
}

function TopicItem({ topic, expanded, onToggle, onNavigate }: { topic: GuideTopic; expanded: boolean; onToggle: () => void; onNavigate: () => void }) {
  const panelId = useId()
  const { showToast } = useToast()

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(topicShareUrl(topic))
      showToast({ type: 'success', title: 'Link copied' })
    } catch {
      showToast({ type: 'error', title: 'Could not copy the link' })
    }
  }

  return (
    <li className={cn('rounded-xl border border-guide-border', expanded && 'bg-guide-subtle')}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guide-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{topic.title}</span>
          <span className="block text-xs text-guide-muted">{topic.summary}</span>
        </span>
        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-guide-muted motion-safe:transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>
      {expanded && (
        <div id={panelId} className="px-3 pb-3">
          <ol className="space-y-2">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-guide-accent-soft text-[11px] font-semibold text-guide-accent" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {topic.links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-guide-accent-soft px-3 text-sm font-medium text-guide-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guide-accent"
              >
                Go to {link.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ))}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-guide-muted hover:text-guide-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guide-accent"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Copy link
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
