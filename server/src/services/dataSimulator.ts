import type { PoolClient } from 'pg'
import { getPool } from '../db'

const VEHICLE_BOUNDS = {
  minX: -100,
  maxX: 200,
  minY: -200,
  maxY: 100,
}

const DEFAULT_INTERVAL_MS = 5_000

type TaskStatus = 'pending' | 'assigned' | 'executing' | 'completed' | 'failed' | 'expired'

type AlertSeverity = 'info' | 'warning' | 'critical'

interface DataSimulatorOptions {
  intervalMs?: number
}

export interface DataSimulator {
  start: () => Promise<void>
  stop: () => Promise<void>
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function wrapCoordinate(value: number, min: number, max: number) {
  const span = max - min
  if (span <= 0) return value
  let wrapped = value
  while (wrapped < min) {
    wrapped += span
  }
  while (wrapped > max) {
    wrapped -= span
  }
  return wrapped
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeAngle(angle: number) {
  let normalized = angle % 360
  if (normalized < 0) {
    normalized += 360
  }
  return normalized
}

function formatMac(vehId: number) {
  const suffix = vehId.toString().padStart(2, '0').slice(-2)
  return `AA:BB:CC:DD:EE:${suffix}`
}

function pickRandom<T>(items: T[]): T {
  return items[randomInt(0, Math.max(items.length - 1, 0))]
}

async function simulateVehicles(client: PoolClient) {
  const { rows } = await client.query(
    `
      SELECT
        v.veh_id,
        latest.sim_time,
        latest.pos_x,
        latest.pos_y,
        latest.speed,
        latest.heading
      FROM vehicles v
      LEFT JOIN LATERAL (
        SELECT sim_time, pos_x, pos_y, speed, heading
        FROM vehicle_telemetry vt
        WHERE vt.veh_id = v.veh_id
        ORDER BY vt.sim_time DESC
        LIMIT 1
      ) AS latest ON TRUE
      ORDER BY v.veh_id
    `,
  )

  for (const row of rows) {
    const baseSimTime = typeof row.sim_time === 'number' ? Number(row.sim_time) : randomBetween(110, 140)
    const nextSimTime = baseSimTime + randomBetween(0.5, 2.5)

    const startX = typeof row.pos_x === 'number' ? Number(row.pos_x) : randomBetween(VEHICLE_BOUNDS.minX, VEHICLE_BOUNDS.maxX)
    const startY = typeof row.pos_y === 'number' ? Number(row.pos_y) : randomBetween(VEHICLE_BOUNDS.minY, VEHICLE_BOUNDS.maxY)

    const baseHeading = typeof row.heading === 'number' ? Number(row.heading) : randomBetween(0, 360)
    const heading = normalizeAngle(baseHeading + randomBetween(-25, 25))

    const speed = clamp(randomBetween(8, 24), 0, 35)
    const distance = speed * (nextSimTime - baseSimTime) * 0.65
    const radians = (heading * Math.PI) / 180

    const proposedX = startX + Math.cos(radians) * distance
    const proposedY = startY + Math.sin(radians) * distance

    const posX = wrapCoordinate(proposedX, VEHICLE_BOUNDS.minX, VEHICLE_BOUNDS.maxX)
    const posY = wrapCoordinate(proposedY, VEHICLE_BOUNDS.minY, VEHICLE_BOUNDS.maxY)

    const acceleration = randomBetween(-1.5, 1.5)
    const flocHz = randomBetween(4.6, 5.4)
    const txPower = randomBetween(110, 130)

    const payload = {
      lane: `L${randomInt(1, 6)}`,
      batteryPercent: clamp(78 + randomBetween(-12, 12), 30, 100),
      cpuLoad: clamp(randomBetween(0.35, 0.9), 0, 1),
    }

    await client.query(
      `
        INSERT INTO vehicle_telemetry
          (veh_id, sim_time, floc_hz, tx_power_mw, speed, pos_x, pos_y, heading, acceleration, mac, payload, received_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
      `,
      [
        row.veh_id,
        nextSimTime,
        flocHz,
        txPower,
        speed,
        posX,
        posY,
        heading,
        acceleration,
        formatMac(row.veh_id),
        JSON.stringify(payload),
      ],
    )
  }

  return rows.map((row) => row.veh_id as number)
}

async function simulateRsus(client: PoolClient, simClock: number) {
  const { rows } = await client.query(
    `
      SELECT rsu_id, cpu_capacity_mips, coverage_radius_m
      FROM rsus
      ORDER BY rsu_id
    `,
  )

  for (const row of rows) {
    const cpuUtil = clamp(randomBetween(0.25, 0.88), 0, 0.95)
    const cpuCapacity = typeof row.cpu_capacity_mips === 'number' ? Number(row.cpu_capacity_mips) : 10_000
    const availableCycles = Math.max(cpuCapacity * (1 - cpuUtil), 0)
    const memoryUtil = clamp(randomBetween(0.3, 0.85), 0, 0.98)
    const queueLength = randomInt(0, 9)
    const connections = randomInt(0, 12)
    const uplink = randomBetween(40, 210)
    const downlink = randomBetween(30, 180)
    const temperature = randomBetween(36, 55)

    const payload = {
      simulated: true,
      coverage: row.coverage_radius_m ?? null,
    }

    await client.query(
      `
        INSERT INTO rsu_metrics
          (rsu_id, sim_time, cpu_utilization, available_cpu_cycles, memory_utilization, queue_length,
           connected_vehicle_count, uplink_load_mbps, downlink_load_mbps, temperature_c, payload, recorded_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
      `,
      [
        row.rsu_id,
        simClock,
        cpuUtil,
        availableCycles,
        memoryUtil,
        queueLength,
        connections,
        uplink,
        downlink,
        temperature,
        JSON.stringify(payload),
      ],
    )
  }

  return rows.map((row) => row.rsu_id as number)
}

function advanceTaskStatus(current: TaskStatus): TaskStatus {
  const roll = Math.random()

  switch (current) {
    case 'pending':
      return roll > 0.55 ? 'assigned' : 'pending'
    case 'assigned':
      if (roll < 0.15) return 'pending'
      return roll > 0.6 ? 'executing' : 'assigned'
    case 'executing':
      if (roll < 0.12) return 'failed'
      return roll > 0.7 ? 'completed' : 'executing'
    case 'failed':
      return roll > 0.6 ? 'pending' : 'failed'
    case 'expired':
      return roll > 0.5 ? 'pending' : 'expired'
    case 'completed':
    default:
      return roll > 0.9 ? 'pending' : 'completed'
  }
}

async function simulateTasks(client: PoolClient, simClock: number, vehicleIds: number[], rsuIds: number[]) {
  const { rows } = await client.query(
    `
      SELECT
        assignment_id,
        task_id,
        status,
        assigned_vehicle_id,
        assigned_rsu_id,
        assigned_sim_time,
        started_sim_time,
        completed_sim_time
      FROM task_assignments
      ORDER BY assignment_id
    `,
  )

  for (const row of rows) {
    const currentStatus = row.status as TaskStatus
    const nextStatus = advanceTaskStatus(currentStatus)

    if (nextStatus === currentStatus) {
      continue
    }

    const assignmentId = row.assignment_id as number
    const taskId = row.task_id as number

    if (nextStatus === 'pending') {
      await client.query(
        `
          UPDATE task_assignments
          SET status = $1,
              assigned_vehicle_id = NULL,
              assigned_rsu_id = NULL,
              assigned_sim_time = NULL,
              started_sim_time = NULL,
              completed_sim_time = NULL,
              latency_ms = NULL,
              offloaded = FALSE,
              offload_target = NULL,
              updated_at = now()
          WHERE assignment_id = $2
        `,
        [nextStatus, assignmentId],
      )
    } else if (nextStatus === 'assigned') {
      const vehicleId = row.assigned_vehicle_id ?? (vehicleIds.length > 0 ? pickRandom(vehicleIds) : null)
      const rsuId = row.assigned_rsu_id ?? (rsuIds.length > 0 ? pickRandom(rsuIds) : null)

      await client.query(
        `
          UPDATE task_assignments
          SET status = $1,
              assigned_vehicle_id = $2,
              assigned_rsu_id = $3,
              assigned_sim_time = $4,
              started_sim_time = NULL,
              completed_sim_time = NULL,
              latency_ms = NULL,
              offloaded = FALSE,
              offload_target = NULL,
              updated_at = now()
          WHERE assignment_id = $5
        `,
        [nextStatus, vehicleId, rsuId, simClock, assignmentId],
      )
    } else if (nextStatus === 'executing') {
      await client.query(
        `
          UPDATE task_assignments
          SET status = $1,
              started_sim_time = COALESCE(started_sim_time, $2),
              offloaded = TRUE,
              offload_target = COALESCE(offload_target, CONCAT('RSU-', assigned_rsu_id)),
              updated_at = now()
          WHERE assignment_id = $3
        `,
        [nextStatus, simClock, assignmentId],
      )
    } else if (nextStatus === 'completed') {
      await client.query(
        `
          UPDATE task_assignments
          SET status = $1,
              completed_sim_time = $2,
              latency_ms = $3,
              updated_at = now()
          WHERE assignment_id = $4
        `,
        [nextStatus, simClock, randomInt(60, 135), assignmentId],
      )
    } else if (nextStatus === 'failed' || nextStatus === 'expired') {
      await client.query(
        `
          UPDATE task_assignments
          SET status = $1,
              completed_sim_time = $2,
              latency_ms = $3,
              offloaded = FALSE,
              offload_target = NULL,
              updated_at = now()
          WHERE assignment_id = $4
        `,
        [nextStatus, simClock, randomInt(90, 160), assignmentId],
      )
    }

    await client.query(
      `
        UPDATE edge_tasks
        SET status = $1, updated_at = now()
        WHERE task_id = $2
      `,
      [nextStatus, taskId],
    )
  }

  const { rows: counts } = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM edge_tasks WHERE status IN ('pending','assigned','executing')`,
  )

  const activeCount = Number(counts[0]?.count ?? '0')
  const shouldSpawn = activeCount < 6 || Math.random() > 0.7

  if (shouldSpawn && vehicleIds.length > 0 && rsuIds.length > 0) {
    const takenVehicle = pickRandom(vehicleIds)
    const takenRsu = pickRandom(rsuIds)
    const taskCode = `TASK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

    const { rows: newTaskRows } = await client.query<{ task_id: number }>(
      `
        INSERT INTO edge_tasks
          (task_code, origin_vehicle_id, origin_rsu_id, cpu_cycles_required, data_size_mb, deadline_s,
           earliest_start_s, qos_requirement, created_sim_time, status, payload)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10::jsonb)
        RETURNING task_id
      `,
      [
        taskCode,
        takenVehicle,
        takenRsu,
        randomInt(400_000_000, 1_600_000_000),
        randomBetween(10, 60),
        randomBetween(90, 240),
        randomBetween(60, 120),
        'latency<120ms',
        simClock,
        JSON.stringify({ simulated: true }),
      ],
    )

    const newTaskId = newTaskRows[0].task_id

    await client.query(
      `
        INSERT INTO task_assignments
          (task_id, assigned_vehicle_id, assigned_rsu_id, assigned_sim_time, status, offloaded, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, 'pending', FALSE, now(), now())
      `,
      [newTaskId, takenVehicle, takenRsu, simClock],
    )
  }

  await client.query(`
    DELETE FROM edge_tasks
    WHERE status IN ('completed', 'failed', 'expired')
      AND created_at < now() - interval '10 minutes'
  `)
}

function randomSeverity(): AlertSeverity {
  const roll = Math.random()
  if (roll > 0.75) return 'critical'
  if (roll > 0.4) return 'warning'
  return 'info'
}

async function simulateAlerts(client: PoolClient, simClock: number, vehicleIds: number[], rsuIds: number[]) {
  if (Math.random() > 0.55) {
    const severity = randomSeverity()
    const vehicleId = vehicleIds.length > 0 && Math.random() > 0.4 ? pickRandom(vehicleIds) : null
    const rsuId = rsuIds.length > 0 && Math.random() > 0.6 ? pickRandom(rsuIds) : null

    const category = severity === 'critical' ? 'resource' : severity === 'warning' ? 'deadline' : 'telemetry'
    const message =
      severity === 'critical'
        ? 'RSU saturation detected'
        : severity === 'warning'
        ? 'Task deadline approaching'
        : 'Vehicle telemetry update'

    const detail = {
      simulated: true,
      metric: randomBetween(0, 1),
    }

    await client.query(
      `
        INSERT INTO system_alerts
          (severity, category, message, detail, veh_id, rsu_id, triggered_sim_time, triggered_at, acknowledged)
        VALUES
          ($1, $2, $3, $4::jsonb, $5, $6, $7, now(), FALSE)
      `,
      [severity, category, message, JSON.stringify(detail), vehicleId, rsuId, simClock],
    )
  }

  await client.query(
    `
      UPDATE system_alerts
      SET acknowledged = TRUE, acknowledged_at = now()
      WHERE acknowledged = FALSE AND triggered_at < now() - interval '4 minutes'
        AND severity <> 'critical'
    `,
  )

  await client.query(
    `
      DELETE FROM system_alerts
      WHERE triggered_at < now() - interval '15 minutes'
    `,
  )
}

export function createDataSimulator(options: DataSimulatorOptions = {}): DataSimulator {
  const intervalMs = options.intervalMs ?? Number(process.env.DATA_SIMULATOR_INTERVAL_MS ?? DEFAULT_INTERVAL_MS)
  const pool = getPool()
  let timer: NodeJS.Timeout | null = null
  let running = false
  let started = false

  async function runTick() {
    if (running) {
      return
    }

    running = true
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      const simClock = Date.now() / 1000
      const vehicleIds = await simulateVehicles(client)
      const rsuIds = await simulateRsus(client, simClock)
      await simulateTasks(client, simClock, vehicleIds, rsuIds)
      await simulateAlerts(client, simClock, vehicleIds, rsuIds)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Data simulator tick failed', error)
    } finally {
      client.release()
      running = false
    }
  }

  return {
    async start() {
      if (started) {
        return
      }

      started = true
      await runTick()
      timer = setInterval(() => {
        void runTick()
      }, intervalMs)
      console.log(`Data simulator running (interval ${intervalMs} ms)`) // eslint-disable-line no-console
    },
    async stop() {
      if (!started) {
        return
      }

      if (timer) {
        clearInterval(timer)
        timer = null
      }

      started = false
    },
  }
}
