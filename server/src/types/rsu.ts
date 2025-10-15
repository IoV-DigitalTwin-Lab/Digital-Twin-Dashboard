export interface RsuSpec {
  rsuId: number;
  label: string;
  posX: number | null;
  posY: number | null;
  latitude: number | null;
  longitude: number | null;
  coverageRadiusM: number | null;
  cpuCapacityMips: number | null;
  memoryMb: number | null;
  storageGb: number | null;
  backhaulMbps: number | null;
  deploymentHeightM: number | null;
  meta: Record<string, unknown> | null;
}

export interface RsuMetric {
  id: number;
  rsuId: number;
  simTime: number | null;
  cpuUtilization: number | null;
  availableCpuCycles: number | null;
  memoryUtilization: number | null;
  queueLength: number | null;
  connectedVehicleCount: number | null;
  uplinkLoadMbps: number | null;
  downlinkLoadMbps: number | null;
  temperatureC: number | null;
  recordedAt: string;
  payload: Record<string, unknown> | null;
}

export interface RsuState extends RsuSpec {
  latestMetric: RsuMetric | null;
  activeAlerts: RsuAlert[];
}

export interface RsuAlert {
  alertId: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredSimTime: number | null;
  triggeredAt: string;
}
