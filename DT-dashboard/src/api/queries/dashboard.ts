import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { DashboardMetrics, RsuState, TaskSummary, VehicleState } from '../../types/api'

export function useVehiclesQuery() {
  return useQuery<VehicleState[]>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data } = await apiClient.get<VehicleState[]>('/vehicles')
      return data
    },
    refetchInterval: 10_000,
  })
}

export function useRsusQuery() {
  return useQuery<RsuState[]>({
    queryKey: ['rsus'],
    queryFn: async () => {
      const { data } = await apiClient.get<RsuState[]>('/rsus')
      return data
    },
    refetchInterval: 15_000,
  })
}

export function useTasksQuery() {
  return useQuery<TaskSummary[]>({
    queryKey: ['tasks', 'active'],
    queryFn: async () => {
      const { data } = await apiClient.get<TaskSummary[]>('/tasks')
      return data
    },
    refetchInterval: 8_000,
  })
}

export function useDashboardMetricsQuery() {
  return useQuery<DashboardMetrics>({
    queryKey: ['metrics', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardMetrics>('/metrics/dashboard')
      return data
    },
    refetchInterval: 5_000,
  })
}
