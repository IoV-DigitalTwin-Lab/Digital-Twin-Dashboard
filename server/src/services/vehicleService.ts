import { query } from '../db';
import type { TaskSummary, VehicleAlert, VehicleState } from '../types';

interface VehicleRow {
  veh_id: number;
  label: string | null;
  vehicle_type: string | null;
  cpu_capacity_mips: number | null;
  memory_mb: number | null;
  battery_capacity_wh: number | null;
  max_parallel_tasks: number | null;
  communication_profile: string | null;
  meta: Record<string, unknown> | null;
  sim_time: number | null;
  floc_hz: number | null;
  tx_power_mw: number | null;
  speed: number | null;
  pos_x: number | null;
  pos_y: number | null;
  heading: number | null;
  acceleration: number | null;
  mac: string | null;
  received_at: string | null;
  payload: Record<string, unknown> | null;
}

interface ActiveTaskRow {
  veh_id: number;
  task_id: number;
  task_code: string | null;
  task_status: string;
  cpu_cycles_required: number;
  deadline_s: number | null;
  assigned_rsu_id: number | null;
  latency_ms: number | null;
  offloaded: boolean;
  offload_target: string | null;
  created_sim_time: number | null;
  assigned_sim_time: number | null;
  started_sim_time: number | null;
  completed_sim_time: number | null;
  assigned_vehicle_id: number | null;
}

interface AlertRow {
  alert_id: number;
  veh_id: number | null;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_sim_time: number | null;
  triggered_at: string;
}

const ACTIVE_ASSIGNMENT_STATUSES = ['pending', 'accepted', 'executing'];

function mapVehicleRow(row: VehicleRow): VehicleState {
  return {
    vehId: row.veh_id,
    label: row.label ?? null,
    vehicleType: row.vehicle_type ?? null,
    cpuCapacityMips: row.cpu_capacity_mips ?? null,
    memoryMb: row.memory_mb ?? null,
    batteryCapacityWh: row.battery_capacity_wh ?? null,
    maxParallelTasks: row.max_parallel_tasks ?? null,
    communicationProfile: row.communication_profile ?? null,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    simTime: row.sim_time ?? null,
    flocHz: row.floc_hz ?? null,
    txPowerMw: row.tx_power_mw ?? null,
    speed: row.speed ?? null,
    posX: row.pos_x ?? null,
    posY: row.pos_y ?? null,
    heading: row.heading ?? null,
    acceleration: row.acceleration ?? null,
    mac: row.mac ?? null,
    receivedAt: row.received_at ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    activeTasks: [],
    alerts: [],
  };
}

function mapTaskRow(row: ActiveTaskRow): TaskSummary {
  return {
    taskId: row.task_id,
    taskCode: row.task_code,
    status: row.task_status as TaskSummary['status'],
    deadlineSeconds: row.deadline_s,
    cpuCyclesRequired: row.cpu_cycles_required,
    assignedVehicleId: row.assigned_vehicle_id,
    assignedRsuId: row.assigned_rsu_id,
    latencyMs: row.latency_ms,
    offloaded: row.offloaded,
    offloadTarget: row.offload_target,
    createdSimTime: row.created_sim_time,
    assignedSimTime: row.assigned_sim_time,
    startedSimTime: row.started_sim_time,
    completedSimTime: row.completed_sim_time,
  };
}

function mapAlertRow(row: AlertRow): VehicleAlert {
  return {
    alertId: row.alert_id,
    severity: row.severity,
    message: row.message,
    triggeredSimTime: row.triggered_sim_time,
    triggeredAt: row.triggered_at,
  };
}

export async function getVehicleStates(): Promise<VehicleState[]> {
  const { rows } = await query<VehicleRow>(
    `
    SELECT
      v.veh_id,
      v.label,
      v.vehicle_type,
      v.cpu_capacity_mips,
      v.memory_mb,
      v.battery_capacity_wh,
      v.max_parallel_tasks,
      v.communication_profile,
      v.meta,
      latest.sim_time,
      latest.floc_hz,
      latest.tx_power_mw,
      latest.speed,
      latest.pos_x,
      latest.pos_y,
      latest.heading,
      latest.acceleration,
      latest.mac,
      latest.received_at,
      latest.payload
    FROM vehicles v
    LEFT JOIN LATERAL (
      SELECT
        vt.sim_time,
        vt.floc_hz,
        vt.tx_power_mw,
        vt.speed,
        vt.pos_x,
        vt.pos_y,
        vt.heading,
        vt.acceleration,
        vt.mac,
        vt.received_at,
        vt.payload
      FROM vehicle_telemetry vt
      WHERE vt.veh_id = v.veh_id
      ORDER BY vt.sim_time DESC
      LIMIT 1
    ) AS latest ON TRUE
    ORDER BY v.veh_id
    `,
  );

  const vehicles = rows.map(mapVehicleRow);
  const vehicleIndex = new Map<number, VehicleState>(vehicles.map((v) => [v.vehId, v]));

  const taskRows = await query<ActiveTaskRow>(
    `
    SELECT
      ta.assigned_vehicle_id AS veh_id,
      et.task_id,
      et.task_code,
      et.cpu_cycles_required,
      et.deadline_s,
      ta.status AS task_status,
      ta.assigned_rsu_id,
      ta.latency_ms,
      ta.offloaded,
      ta.offload_target,
      et.created_sim_time,
      ta.assigned_sim_time,
      ta.started_sim_time,
      ta.completed_sim_time,
      ta.assigned_vehicle_id
    FROM task_assignments ta
    INNER JOIN edge_tasks et ON et.task_id = ta.task_id
    WHERE ta.status = ANY($1)
    `,
    [ACTIVE_ASSIGNMENT_STATUSES],
  );

  for (const row of taskRows.rows) {
    if (!row.veh_id) continue;
    const vehicle = vehicleIndex.get(row.veh_id);
    if (!vehicle) continue;
    vehicle.activeTasks.push(mapTaskRow(row));
  }

  const alertRows = await query<AlertRow>(
    `
    SELECT
      sa.alert_id,
      sa.veh_id,
      sa.severity,
      sa.message,
      sa.triggered_sim_time,
      sa.triggered_at
    FROM system_alerts sa
    WHERE sa.veh_id IS NOT NULL AND sa.acknowledged IS FALSE
    ORDER BY sa.triggered_at DESC
    `,
  );

  for (const row of alertRows.rows) {
    if (!row.veh_id) continue;
    const vehicle = vehicleIndex.get(row.veh_id);
    if (!vehicle) continue;
    vehicle.alerts.push(mapAlertRow(row));
  }

  return vehicles;
}

export async function getVehicleState(vehId: number): Promise<VehicleState | null> {
  const vehicles = await getVehicleStates();
  return vehicles.find((v) => v.vehId === vehId) ?? null;
}
