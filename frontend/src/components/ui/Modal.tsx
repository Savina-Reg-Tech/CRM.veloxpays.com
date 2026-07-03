import { useEffect, useId, type ReactNode } from 'react'
import FocusTrap from 'focus-trap-react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <FocusTrap
      focusTrapOptions={{
        // When the modal opens the trap auto-focuses the first focusable
        // element (close button or first form field), and on close it returns
        // focus to whatever element opened the modal.
        initialFocus: false,
        escapeDeactivates: false, // we handle Escape ourselves above
        clickOutsideDeactivates: false,
        returnFocusOnDeactivate: true,
      }}
    >
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          className={cn(
            'relative w-full bg-white rounded-2xl shadow-xl z-10',
            'flex flex-col max-h-[calc(100vh-2rem)]',
            'animate-in fade-in zoom-in-95 duration-200',
            sizeClasses[size]
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-gray-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-gray-500 mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 min-h-0 overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex flex-wrap items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </FocusTrap>
  )
}
