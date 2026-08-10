import api from '@/lib/axios'
import type {
  ApiResponse,
  CreateEmployeePayload,
  Employee,
  Paginated,
  ResetPasswordResult,
  UserStats,
} from '@/types'

export interface ListEmployeesParams {
  limit?: number
  offset?: number
}

export const employeeService = {
  getAll: async (params: ListEmployeesParams = {}): Promise<Paginated<Employee>> => {
    const res = await api.get<ApiResponse<Paginated<Employee>>>('/users', { params })
    return res.data.data
  },

  getStats: async (): Promise<UserStats> => {
    const res = await api.get<ApiResponse<UserStats>>('/users/stats')
    return res.data.data
  },

  create: async (payload: CreateEmployeePayload): Promise<Employee> => {
    const res = await api.post<ApiResponse<Employee>>('/users', payload)
    return res.data.data
  },

  toggleStatus: async (id: number): Promise<Employee> => {
    const res = await api.patch<ApiResponse<Employee>>(`/users/${id}/toggle-status`)
    return res.data.data
  },

  resetPassword: async (id: number, password?: string): Promise<ResetPasswordResult> => {
    const res = await api.post<ApiResponse<ResetPasswordResult>>(
      `/users/${id}/reset-password`,
      password ? { password } : {}
    )
    return res.data.data
  },
}
