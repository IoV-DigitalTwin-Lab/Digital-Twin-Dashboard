import type { TaskSummary } from './task';

export interface VehicleSpec {
  vehId: number;
  label: string | null;
  vehicleType: string | null;
  cpuCapacityMips: number | null;
  memoryMb: number | null;
  batteryCapacityWh: number | null;
  maxParallelTasks: number | null;
  communicationProfile: string | null;
  meta: Record<string, unknown> | null;
}

export interface VehicleState extends VehicleSpec {
  simTime: number | null;
  flocHz: number | null;
  txPowerMw: number | null;
  speed: number | null;
  posX: number | null;
  posY: number | null;
  heading: number | null;
  acceleration: number | null;
  mac: string | null;
  receivedAt: string | null;
  payload: Record<string, unknown> | null;
  activeTasks: TaskSummary[];
  alerts: VehicleAlert[];
}

export interface VehicleAlert {
  alertId: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredSimTime: number | null;
  triggeredAt: string;
}
