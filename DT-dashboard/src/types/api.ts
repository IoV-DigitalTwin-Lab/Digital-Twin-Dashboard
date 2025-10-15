export interface VehicleAlert {
  alertId: number
  severity: 'info' | 'warning' | 'critical'
  message: string
  triggeredSimTime: number | null
  triggeredAt: string
}

export interface TaskSummary {
  taskId: number
  taskCode: string | null
  status: 'pending' | 'assigned' | 'executing' | 'completed' | 'failed' | 'expired'
  deadlineSeconds: number | null
  cpuCyclesRequired: number
  assignedVehicleId: number | null
  assignedRsuId: number | null
  latencyMs: number | null
  offloaded: boolean
  offloadTarget: string | null
  createdSimTime: number | null
  assignedSimTime: number | null
  startedSimTime: number | null
  completedSimTime: number | null
}

export interface VehicleState {
  vehId: number
  label: string | null
  vehicleType: string | null
  cpuCapacityMips: number | null
  memoryMb: number | null
  batteryCapacityWh: number | null
  maxParallelTasks: number | null
  communicationProfile: string | null
  simTime: number | null
  flocHz: number | null
  txPowerMw: number | null
  speed: number | null
  posX: number | null
  posY: number | null
  heading: number | null
  acceleration: number | null
  mac: string | null
  receivedAt: string | null
  payload: Record<string, unknown> | null
  activeTasks: TaskSummary[]
  alerts: VehicleAlert[]
}

export interface RsuAlert {
  alertId: number
  severity: 'info' | 'warning' | 'critical'
  message: string
  triggeredSimTime: number | null
  triggeredAt: string
}

export interface RsuMetric {
  id: number
  rsuId: number
  simTime: number | null
  cpuUtilization: number | null
  availableCpuCycles: number | null
  memoryUtilization: number | null
  queueLength: number | null
  connectedVehicleCount: number | null
  uplinkLoadMbps: number | null
  downlinkLoadMbps: number | null
  temperatureC: number | null
  recordedAt: string
  payload: Record<string, unknown> | null
}

export interface RsuState {
  rsuId: number
  label: string
  posX: number | null
  posY: number | null
  latitude: number | null
  longitude: number | null
  coverageRadiusM: number | null
  cpuCapacityMips: number | null
  memoryMb: number | null
  storageGb: number | null
  backhaulMbps: number | null
  deploymentHeightM: number | null
  meta: Record<string, unknown> | null
  latestMetric: RsuMetric | null
  activeAlerts: RsuAlert[]
}

export interface DashboardMetrics {
  activeVehicleCount: number
  averageVehicleSpeed: number | null
  activeTaskCount: number
  completedTaskCountLastHour: number
  activeRsuCount: number
  averageRsuCpuUtilization: number | null
}

export interface DashboardSnapshot {
  vehicles: VehicleState[]
  rsus: RsuState[]
  tasks: TaskSummary[]
  metrics: DashboardMetrics
  emittedAt: string
}
