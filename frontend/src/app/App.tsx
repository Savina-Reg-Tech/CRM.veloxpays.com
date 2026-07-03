import QueryProvider from './providers/QueryProvider'
import AuthProvider from './providers/AuthProvider'
import ToastProvider from './providers/ToastProvider'
import Router from './Router'

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <Router />
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
