import api from '@/lib/axios'
import type {
  ApiResponse,
  VeloxEsimCustomer,
  VeloxEsimCustomerList,
  VeloxEsimIntegrationHealth,
} from '@/types'

export interface ListVeloxEsimParams {
  page?: number
  limit?: number
  search?: string
}

export const veloxEsimApi = {
  health: async (): Promise<VeloxEsimIntegrationHealth> => {
    const res = await api.get<ApiResponse<VeloxEsimIntegrationHealth>>('/velox-esim/health')
    return res.data.data
  },

  list: async (params: ListVeloxEsimParams = {}): Promise<VeloxEsimCustomerList> => {
    const res = await api.get<ApiResponse<VeloxEsimCustomerList>>('/velox-esim/customers', {
      params: {
        page: params.page,
        limit: params.limit,
        search: params.search || undefined,
      },
    })
    return res.data.data
  },

  getById: async (id: string): Promise<VeloxEsimCustomer> => {
    const res = await api.get<ApiResponse<{ customer: VeloxEsimCustomer }>>(
      `/velox-esim/customers/${encodeURIComponent(id)}`
    )
    return res.data.data.customer
  },
}
