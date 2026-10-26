import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  action?: ToastAction
}

interface ToastInput {
  type: ToastType
  title: string
  message?: string
  /** A button in the toast (e.g. "Open it"); clicking it also closes the toast. */
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 4000
/** Toasts with an action stay longer so there's time to use it. */
const ACTION_TOAST_DURATION_MS = 8000

function ToastView({
  toast,
  onClose,
}: {
  toast: ToastItem
  onClose: (id: string) => void
}) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border shadow-lg px-4 py-3 flex items-start gap-3 bg-white',
        toast.type === 'success'
          ? 'border-emerald-200'
          : toast.type === 'info'
            ? 'border-sky-200'
            : 'border-red-200'
      )}
    >
      <div className="shrink-0 pt-0.5">
        {toast.type === 'success' ? (
          <CheckCircle2 size={18} className="text-emerald-600" />
        ) : toast.type === 'info' ? (
          <Info size={18} className="text-sky-600" />
        ) : (
          <AlertCircle size={18} className="text-red-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-600 mt-0.5">{toast.message}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onClose(toast.id)
            }}
            className="mt-1.5 text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => removeToast(id), toast.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS)
  }, [removeToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[60] w-[min(92vw,360px)] space-y-2">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
