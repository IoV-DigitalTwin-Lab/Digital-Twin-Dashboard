import { query } from '../db';

interface MetricResult {
  active_vehicle_count: number;
  average_speed: number | null;
  active_task_count: number;
  completed_task_count_last_hour: number;
  active_rsu_count: number;
  average_rsu_cpu_utilization: number | null;
}

export interface DashboardMetrics {
  activeVehicleCount: number;
  averageVehicleSpeed: number | null;
  activeTaskCount: number;
  completedTaskCountLastHour: number;
  activeRsuCount: number;
  averageRsuCpuUtilization: number | null;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { rows } = await query<MetricResult>(
    `
    WITH active_vehicle AS (
      SELECT DISTINCT vt.veh_id
      FROM vehicle_telemetry vt
      WHERE vt.received_at >= now() - interval '30 seconds' AND vt.veh_id IS NOT NULL
    ),
    latest_vehicle_speed AS (
      SELECT DISTINCT ON (vt.veh_id)
        vt.veh_id,
        vt.speed
      FROM vehicle_telemetry vt
      ORDER BY vt.veh_id, vt.sim_time DESC
    ),
    active_tasks AS (
      SELECT COUNT(*) AS count
      FROM edge_tasks et
      WHERE et.status IN ('pending','assigned','accepted','executing')
    ),
    completed_last_hour AS (
      SELECT COUNT(*) AS count
      FROM edge_tasks et
      WHERE et.status = 'completed' AND et.created_at >= now() - interval '1 hour'
    ),
    active_rsus AS (
      SELECT DISTINCT m.rsu_id
      FROM rsu_metrics m
      WHERE m.recorded_at >= now() - interval '1 minute'
    ),
    rsu_cpu AS (
      SELECT AVG(m.cpu_utilization) AS avg_cpu
      FROM (
        SELECT DISTINCT ON (m.rsu_id) m.rsu_id, m.cpu_utilization
        FROM rsu_metrics m
        ORDER BY m.rsu_id, m.sim_time DESC
      ) m
    )
    SELECT
      (SELECT COUNT(*) FROM active_vehicle) AS active_vehicle_count,
      (SELECT AVG(speed) FROM latest_vehicle_speed WHERE speed IS NOT NULL) AS average_speed,
      (SELECT count FROM active_tasks) AS active_task_count,
      (SELECT count FROM completed_last_hour) AS completed_task_count_last_hour,
      (SELECT COUNT(*) FROM active_rsus) AS active_rsu_count,
      (SELECT avg_cpu FROM rsu_cpu) AS average_rsu_cpu_utilization
    `,
  );

  const row = rows[0] ?? {
    active_vehicle_count: 0,
    average_speed: null,
    active_task_count: 0,
    completed_task_count_last_hour: 0,
    active_rsu_count: 0,
    average_rsu_cpu_utilization: null,
  };

  return {
    activeVehicleCount: Number(row.active_vehicle_count ?? 0),
    averageVehicleSpeed: row.average_speed,
    activeTaskCount: Number(row.active_task_count ?? 0),
    completedTaskCountLastHour: Number(row.completed_task_count_last_hour ?? 0),
    activeRsuCount: Number(row.active_rsu_count ?? 0),
    averageRsuCpuUtilization: row.average_rsu_cpu_utilization,
  };
}
