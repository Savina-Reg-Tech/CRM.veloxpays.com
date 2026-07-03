import api from '@/lib/axios'
import type {
  ApiResponse,
  Customer,
  CustomerPayload,
  Paginated,
  ServiceCatalogItem,
} from '@/types'

export interface ListCustomersParams {
  limit?: number
  offset?: number
}

export const customerService = {
  getAll: async (params: ListCustomersParams = {}): Promise<Paginated<Customer>> => {
    const res = await api.get<ApiResponse<Paginated<Customer>>>('/customers', { params })
    return res.data.data
  },

  getById: async (id: number): Promise<Customer> => {
    const res = await api.get<ApiResponse<Customer>>(`/customers/${id}`)
    return res.data.data
  },

  create: async (payload: CustomerPayload): Promise<Customer> => {
    const res = await api.post<ApiResponse<Customer>>('/customers', payload)
    return res.data.data
  },

  update: async (id: number, payload: CustomerPayload): Promise<Customer> => {
    const res = await api.patch<ApiResponse<Customer>>(`/customers/${id}`, payload)
    return res.data.data
  },

  remove: async (id: number): Promise<{ id: number; deleted_at: string }> => {
    const res = await api.delete<ApiResponse<{ id: number; deleted_at: string }>>(
      `/customers/${id}`
    )
    return res.data.data
  },
}

export const serviceCatalogClient = {
  list: async (): Promise<ServiceCatalogItem[]> => {
    const res = await api.get<ApiResponse<ServiceCatalogItem[]>>('/services')
    return res.data.data
  },
}
