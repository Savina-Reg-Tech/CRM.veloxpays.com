import { useEffect, useId, type ReactNode } from 'react'
import FocusTrap from 'focus-trap-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Mobile sheet pinned to the bottom of the screen: scrolls inside itself, sticky footer that
 * clears the iPhone home bar. Esc and the backdrop close it; focus is trapped and returned. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const titleId = useId()

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
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-gray-900/40" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl',
            className
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </div>
      </div>
    </FocusTrap>
  )
}
