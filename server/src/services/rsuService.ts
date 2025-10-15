import { query } from '../db';
import type { RsuAlert, RsuMetric, RsuSpec, RsuState } from '../types';

interface RsuRow {
  rsu_id: number;
  label: string;
  latitude: number | null;
  longitude: number | null;
  pos_x: number | null;
  pos_y: number | null;
  coverage_radius_m: number | null;
  cpu_capacity_mips: number | null;
  memory_mb: number | null;
  storage_gb: number | null;
  backhaul_mbps: number | null;
  deployment_height_m: number | null;
  meta: Record<string, unknown> | null;
}

interface MetricRow {
  id: number;
  rsu_id: number;
  sim_time: number | null;
  cpu_utilization: number | null;
  available_cpu_cycles: number | null;
  memory_utilization: number | null;
  queue_length: number | null;
  connected_vehicle_count: number | null;
  uplink_load_mbps: number | null;
  downlink_load_mbps: number | null;
  temperature_c: number | null;
  recorded_at: string;
  payload: Record<string, unknown> | null;
}

interface AlertRow {
  alert_id: number;
  rsu_id: number | null;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_sim_time: number | null;
  triggered_at: string;
}

function mapRsuRow(row: RsuRow): RsuSpec {
  return {
    rsuId: row.rsu_id,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
    posX: row.pos_x,
    posY: row.pos_y,
    coverageRadiusM: row.coverage_radius_m,
    cpuCapacityMips: row.cpu_capacity_mips,
    memoryMb: row.memory_mb,
    storageGb: row.storage_gb,
    backhaulMbps: row.backhaul_mbps,
    deploymentHeightM: row.deployment_height_m,
    meta: row.meta ?? null,
  };
}

function mapMetricRow(row: MetricRow): RsuMetric {
  return {
    id: row.id,
    rsuId: row.rsu_id,
    simTime: row.sim_time,
    cpuUtilization: row.cpu_utilization,
    availableCpuCycles: row.available_cpu_cycles,
    memoryUtilization: row.memory_utilization,
    queueLength: row.queue_length,
    connectedVehicleCount: row.connected_vehicle_count,
    uplinkLoadMbps: row.uplink_load_mbps,
    downlinkLoadMbps: row.downlink_load_mbps,
    temperatureC: row.temperature_c,
    recordedAt: row.recorded_at,
    payload: row.payload ?? null,
  };
}

function mapAlertRow(row: AlertRow): RsuAlert {
  return {
    alertId: row.alert_id,
    severity: row.severity,
    message: row.message,
    triggeredSimTime: row.triggered_sim_time,
    triggeredAt: row.triggered_at,
  };
}

export async function getRsus(): Promise<RsuState[]> {
  const { rows } = await query<RsuRow>(
    `
    SELECT
      r.rsu_id,
      r.label,
      r.latitude,
      r.longitude,
      r.pos_x,
      r.pos_y,
      r.coverage_radius_m,
      r.cpu_capacity_mips,
      r.memory_mb,
      r.storage_gb,
      r.backhaul_mbps,
      r.deployment_height_m,
      r.meta
    FROM rsus r
    ORDER BY r.rsu_id
    `,
  );

  if (!rows.length) {
    return [];
  }

  const states: RsuState[] = rows.map((row) => ({
    ...mapRsuRow(row),
    latestMetric: null,
    activeAlerts: [],
  }));

  const rsuIndex = new Map<number, RsuState>(states.map((state) => [state.rsuId, state]));

  const metricRows = await query<MetricRow>(
    `
    SELECT DISTINCT ON (m.rsu_id)
      m.id,
      m.rsu_id,
      m.sim_time,
      m.cpu_utilization,
      m.available_cpu_cycles,
      m.memory_utilization,
      m.queue_length,
      m.connected_vehicle_count,
      m.uplink_load_mbps,
      m.downlink_load_mbps,
      m.temperature_c,
      m.recorded_at,
      m.payload
    FROM rsu_metrics m
    ORDER BY m.rsu_id, m.sim_time DESC
    `,
  );

  for (const row of metricRows.rows) {
    const state = rsuIndex.get(row.rsu_id);
    if (!state) continue;
    state.latestMetric = mapMetricRow(row);
  }

  const alertRows = await query<AlertRow>(
    `
    SELECT
      sa.alert_id,
      sa.rsu_id,
      sa.severity,
      sa.message,
      sa.triggered_sim_time,
      sa.triggered_at
    FROM system_alerts sa
    WHERE sa.rsu_id IS NOT NULL AND sa.acknowledged IS FALSE
    ORDER BY sa.triggered_at DESC
    `,
  );

  for (const row of alertRows.rows) {
    if (!row.rsu_id) continue;
    const state = rsuIndex.get(row.rsu_id);
    if (!state) continue;
    state.activeAlerts.push(mapAlertRow(row));
  }

  return states;
}

export async function getRsu(rsuId: number): Promise<RsuState | null> {
  const states = await getRsus();
  return states.find((state) => state.rsuId === rsuId) ?? null;
}
