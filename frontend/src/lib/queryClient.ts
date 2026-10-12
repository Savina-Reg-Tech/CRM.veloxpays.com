import { QueryClient } from '@tanstack/react-query'

/**
 * The app's single react-query cache. Lives in its own module so non-React code can reach it —
 * in particular the auth store, which empties it whenever the signed-in user changes (see
 * store/authStore.ts): cached customers, notifications and VeloxVerse data belong to one
 * session and must never be shown to the next person on the same browser.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60, // 1 minute
    },
  },
})
