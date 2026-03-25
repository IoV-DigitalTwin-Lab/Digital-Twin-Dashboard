import { useEffect } from 'react'
import { useDashboardMetricsQuery, useRsusQuery, useTasksQuery, useVehiclesQuery } from '../api/queries/dashboard'
import { useSocketStore } from '../stores/socketStore'

export function useDashboardData() {
  const vehiclesQuery = useVehiclesQuery()
  const rsusQuery = useRsusQuery()
  const tasksQuery = useTasksQuery()
  const metricsQuery = useDashboardMetricsQuery()

  const connect = useSocketStore((state) => state.connect)
  const disconnect = useSocketStore((state) => state.disconnect)
  const latestSnapshot = useSocketStore((state) => state.latestSnapshot)
  const status = useSocketStore((state) => state.status)

  // Direct simulation data (from TCP bridge)
  const getVehicles = useSocketStore((state) => state.getVehicles)
  const getRsus = useSocketStore((state) => state.getRsus)
  const taskLifecycleEvents = useSocketStore((state) => state.taskLifecycleEvents)
  const activeTaskCommunications = useSocketStore((state) => state.activeTaskCommunications)
  const simulationState = useSocketStore((state) => state.simulationState)
  const roadNetwork = useSocketStore((state) => state.roadNetwork)

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    vehiclesQuery,
    rsusQuery,
    tasksQuery,
    metricsQuery,
    socketSnapshot: latestSnapshot,
    socketStatus: status,

    // Direct simulation data
    getVehicles,
    getRsus,
    taskLifecycleEvents,
    activeTaskCommunications,
    simulationState,
    roadNetwork,
  }
}
