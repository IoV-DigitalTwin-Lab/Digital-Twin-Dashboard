"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveTasks = getActiveTasks;
exports.getTaskTimeline = getTaskTimeline;
exports.getTaskDetail = getTaskDetail;
const db_1 = require("../db");
const ACTIVE_TASK_STATUSES = ['pending', 'assigned', 'accepted', 'executing'];
function mapTaskSummary(row) {
    return {
        taskId: row.task_id,
        taskCode: row.task_code,
        status: row.status,
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
function mapTaskDetail(row) {
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
async function getActiveTasks() {
    const { rows } = await (0, db_1.query)(`
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
    `, [ACTIVE_TASK_STATUSES]);
    return rows.map(mapTaskSummary);
}
async function getTaskTimeline(limit = 100) {
    const { rows } = await (0, db_1.query)(`
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
    `, [limit]);
    return rows.map(mapTaskDetail);
}
async function getTaskDetail(taskId) {
    const { rows } = await (0, db_1.query)(`
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
    `, [taskId]);
    if (!rows.length) {
        return null;
    }
    return mapTaskDetail(rows[0]);
}
