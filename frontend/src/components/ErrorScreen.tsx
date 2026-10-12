import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

/**
 * What people see instead of a blank white page when something on the screen fails to render.
 * Deliberately dependency-free (no layout, no stores, no queries): it has to work when the rest
 * of the app is the thing that broke.
 */
export function ErrorScreen({ error, compact = false }: { error?: unknown; compact?: boolean }) {
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div role="alert" className={`flex items-center justify-center bg-gray-50 px-4 ${compact ? 'py-12' : 'min-h-screen'}`}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {notFound
            ? 'This page does not exist or has moved.'
            : 'This page could not be displayed. Reloading usually fixes it — if it keeps happening, please contact support.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Reload page
          </button>
          {!compact && (
            <a href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              Go to dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/** Router `errorElement`: a route threw while rendering or loading. */
export function RouteErrorScreen({ compact = false }: { compact?: boolean }) {
  const error = useRouteError()
  console.error('[route error]', error)
  return <ErrorScreen error={error} compact={compact} />
}

/** Last line of defence around the whole app — catches what the router's boundary cannot
 * (errors in providers, or in the router itself). */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[app error]', error, info.componentStack)
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children
  }
}
