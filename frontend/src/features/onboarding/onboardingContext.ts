import { createContext, useContext } from 'react'

export interface OnboardingContextValue {
  /** Open the Quick Guide, optionally with one topic expanded (ignored if the role can't see it). */
  openGuide: (topicId?: string) => void
  /** Go to the user's home page and run the welcome tour now. */
  replayTour: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

/** No-op outside <OnboardingProvider> (e.g. isolated component tests). */
export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext) ?? { openGuide: () => {}, replayTour: () => {} }
}
