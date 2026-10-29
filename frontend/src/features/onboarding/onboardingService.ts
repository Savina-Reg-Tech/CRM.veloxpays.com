import api from '@/lib/axios'
import type { ApiResponse, TourStatus } from '@/types'

export type TourResult = Exclude<TourStatus, 'not_offered'>

export interface SavedTourState {
  tour_status: TourResult
  tour_version: number
  tour_seen_at: string
}

export const onboardingService = {
  /** Save the signed-in user's own tour result (completed / dismissed) for a tour version. */
  saveTourResult: async (tourStatus: TourResult, tourVersion: number): Promise<SavedTourState> => {
    const res = await api.patch<ApiResponse<SavedTourState>>('/auth/me/onboarding', { tourStatus, tourVersion })
    return res.data.data
  },
}
