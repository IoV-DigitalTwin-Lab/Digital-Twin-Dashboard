import { query } from '../db';
import type { TaskDetail, TaskSummary } from '../types';

const ACTIVE_TASK_STATUSES = ['pending', 'assigned', 'accepted', 'executing'];

interface TaskRow {
  task_id: number;
  task_code: string | null;
  status: string;
  deadline_s: number | null;
  cpu_cycles_required: number;
  origin_vehicle_id: number | null;
  origin_rsu_id: number | null;
  data_size_mb: number | null;
  earliest_start_s: number | null;
  qos_requirement: string | null;
  created_sim_time: number | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

interface TaskAssignmentJoinRow extends TaskRow {
  assignment_id: number;
  assigned_vehicle_id: number | null;
  assigned_rsu_id: number | null;
  assigned_sim_time: number | null;
  started_sim_time: number | null;
  completed_sim_time: number | null;
  latency_ms: number | null;
  offloaded: boolean;
  offload_target: string | null;
}

function mapTaskSummary(row: TaskAssignmentJoinRow): TaskSummary {
  return {
    taskId: row.task_id,
    taskCode: row.task_code,
    status: row.status as TaskSummary['status'],
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

function mapTaskDetail(row: TaskAssignmentJoinRow): TaskDetail {
  return {
    ...mapTaskSummary(row),
    originVehicleId: row.origin_vehicle_id,
    originRsuId: row.origin_rsu_id,
    dataSizeMb: row.data_size_mb,
    earliestStartS: row.earliest_start_s,
    qosRequirement: row.qos_requirement,
    createdAt: row.created_at,
    payload: row.payload ?? null,
  };
}

export async function getActiveTasks(): Promise<TaskSummary[]> {
  const { rows } = await query<TaskAssignmentJoinRow>(
    `
    SELECT
      et.task_id,
      et.task_code,
      et.status,
      et.deadline_s,
      et.cpu_cycles_required,
      et.origin_vehicle_id,
      et.origin_rsu_id,
      et.data_size_mb,
      et.earliest_start_s,
      et.qos_requirement,
      et.created_sim_time,
      et.created_at,
      et.payload,
      ta.assignment_id,
      ta.assigned_vehicle_id,
      ta.assigned_rsu_id,
      ta.assigned_sim_time,
      ta.started_sim_time,
      ta.completed_sim_time,
      ta.latency_ms,
      ta.offloaded,
      ta.offload_target
    FROM edge_tasks et
    LEFT JOIN LATERAL (
      SELECT *
      FROM task_assignments ta
      WHERE ta.task_id = et.task_id
      ORDER BY ta.updated_at DESC NULLS LAST
      LIMIT 1
    ) AS ta ON TRUE
    WHERE et.status = ANY($1)
    ORDER BY et.deadline_s NULLS LAST, et.created_at DESC
    `,
    [ACTIVE_TASK_STATUSES],
  );

  return rows.map(mapTaskSummary);
}

export async function getTaskTimeline(limit = 100): Promise<TaskDetail[]> {
  const { rows } = await query<TaskAssignmentJoinRow>(
    `
    SELECT
      et.task_id,
      et.task_code,
      et.status,
      et.deadline_s,
      et.cpu_cycles_required,
      et.origin_vehicle_id,
      et.origin_rsu_id,
      et.data_size_mb,
      et.earliest_start_s,
      et.qos_requirement,
      et.created_sim_time,
      et.created_at,
      et.payload,
      ta.assignment_id,
      ta.assigned_vehicle_id,
      ta.assigned_rsu_id,
      ta.assigned_sim_time,
      ta.started_sim_time,
      ta.completed_sim_time,
      ta.latency_ms,
      ta.offloaded,
      ta.offload_target
    FROM edge_tasks et
    LEFT JOIN LATERAL (
      SELECT *
      FROM task_assignments ta
      WHERE ta.task_id = et.task_id
      ORDER BY ta.updated_at DESC NULLS LAST
      LIMIT 1
    ) AS ta ON TRUE
    ORDER BY et.created_at DESC
    LIMIT $1
    `,
    [limit],
  );

  return rows.map(mapTaskDetail);
}

export async function getTaskDetail(taskId: number): Promise<TaskDetail | null> {
  const { rows } = await query<TaskAssignmentJoinRow>(
    `
    SELECT
      et.task_id,
      et.task_code,
      et.status,
      et.deadline_s,
      et.cpu_cycles_required,
      et.origin_vehicle_id,
      et.origin_rsu_id,
      et.data_size_mb,
      et.earliest_start_s,
      et.qos_requirement,
      et.created_sim_time,
      et.created_at,
      et.payload,
      ta.assignment_id,
      ta.assigned_vehicle_id,
      ta.assigned_rsu_id,
      ta.assigned_sim_time,
      ta.started_sim_time,
      ta.completed_sim_time,
      ta.latency_ms,
      ta.offloaded,
      ta.offload_target
    FROM edge_tasks et
    LEFT JOIN LATERAL (
      SELECT *
      FROM task_assignments ta
      WHERE ta.task_id = et.task_id
      ORDER BY ta.updated_at DESC NULLS LAST
      LIMIT 1
    ) AS ta ON TRUE
    WHERE et.task_id = $1
    LIMIT 1
    `,
    [taskId],
  );

  if (!rows.length) {
    return null;
  }

  return mapTaskDetail(rows[0]);
}
