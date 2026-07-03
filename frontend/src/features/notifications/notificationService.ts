import api from '@/lib/axios'
import type { ApiResponse, AppNotification } from '@/types'

export const notificationsApi = {
  list: async (limit = 20): Promise<AppNotification[]> => {
    const res = await api.get<ApiResponse<AppNotification[]>>('/notifications', {
      params: { limit },
    })
    return res.data.data
  },

  unreadCount: async (): Promise<number> => {
    const res = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count')
    return res.data.data.count
  },

  markRead: async (id: number): Promise<void> => {
    await api.patch(`/notifications/${id}/read`)
  },

  markAllRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all')
  },
}
