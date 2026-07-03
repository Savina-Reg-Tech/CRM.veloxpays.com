import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../employeeService'
import type { Employee } from '@/types'

export function useToggleEmployeeStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => employeeService.toggleStatus(id),
    onMutate: async (id: number) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['employees'] })
      const prev = queryClient.getQueryData<Employee[]>(['employees'])

      queryClient.setQueryData<Employee[]>(['employees'], (old) =>
        old?.map((e) => (e.id === id ? { ...e, is_active: !e.is_active } : e))
      )
      return { prev }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['employees'], context?.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
