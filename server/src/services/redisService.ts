import { getRedisClient } from '../config/redis';
import type { VehicleState, TaskSummary, RsuState, RsuMetric } from '../types';

/**
 * Service to read live simulation data from Redis
 * Maps Redis hash data to Dashboard types
 */

interface RedisVehicleState {
  pos_x?: string;
  pos_y?: string;
  speed?: string;
  heading?: string;
  cpu_available?: string;
  cpu_utilization?: string;
  mem_available?: string;
  mem_utilization?: string;
  queue_length?: string;
  processing_count?: string;
  last_update?: string;
}

interface RedisTaskState {
  vehicle_id?: string;
  status?: string;
  created_time?: string;
  deadline?: string;
  decision_type?: string;
  target_id?: string;
}

interface RedisRsuState {
  cpu_available?: string;
  memory_available?: string;
  queue_length?: string;
  processing_count?: string;
  update_time?: string;  // Note: RSU uses "update_time" not "last_update"
  pos_x?: string;
  pos_y?: string;
}

/**
 * Get all vehicle states from Redis
 */
export async function getVehicleStatesFromRedis(): Promise<VehicleState[]> {
  const redis = getRedisClient();
  const vehicles: VehicleState[] = [];

  try {
    // Find all vehicle keys using SCAN
    const vehicleKeys: string[] = [];
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'vehicle:*:state',
        'COUNT',
        100
      );
      cursor = nextCursor;
      vehicleKeys.push(...keys);
    } while (cursor !== '0');

    // Fetch each vehicle's state
    for (const key of vehicleKeys) {
      const vehicleId = extractVehicleId(key);
      if (!vehicleId) continue;

      const data = await redis.hgetall(key) as RedisVehicleState;
      
      if (Object.keys(data).length === 0) continue;

      const vehicle: VehicleState = {
        vehId: parseInt(vehicleId.replace('node[', '').replace(']', ''), 10),
        label: vehicleId,
        vehicleType: 'sedan', // Default, not in Redis
        cpuCapacityMips: data.cpu_available ? parseFloat(data.cpu_available) : null,
        memoryMb: data.mem_available ? parseFloat(data.mem_available) : null,
        batteryCapacityWh: null,
        maxParallelTasks: null,
        communicationProfile: null,
        meta: null,
        simTime: data.last_update ? parseFloat(data.last_update) : null,
        flocHz: null,
        txPowerMw: null,
        speed: data.speed ? parseFloat(data.speed) : null,
        posX: data.pos_x ? parseFloat(data.pos_x) : null,
        posY: data.pos_y ? parseFloat(data.pos_y) : null,
        heading: data.heading ? parseFloat(data.heading) : null,
        acceleration: null,
        mac: null,
        receivedAt: new Date().toISOString(),
        payload: {
          cpuUtilization: data.cpu_utilization ? parseFloat(data.cpu_utilization) : null,
          memoryUtilization: data.mem_utilization ? parseFloat(data.mem_utilization) : null,
          queueLength: data.queue_length ? parseInt(data.queue_length, 10) : null,
          processingCount: data.processing_count ? parseInt(data.processing_count, 10) : null,
        },
        activeTasks: [],
        alerts: [],
      };

      vehicles.push(vehicle);
    }

    return vehicles;
  } catch (error) {
    console.error('Error fetching vehicles from Redis:', error);
    return [];
  }
}

/**
 * Get all active tasks from Redis
 */
export async function getActiveTasksFromRedis(): Promise<TaskSummary[]> {
  const redis = getRedisClient();
  const tasks: TaskSummary[] = [];

  try {
    // Find all task keys
    const taskKeys: string[] = [];
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'task:*:state',
        'COUNT',
        100
      );
      cursor = nextCursor;
      taskKeys.push(...keys);
    } while (cursor !== '0');

    // Fetch each task's state
    for (const key of taskKeys) {
      const taskId = extractTaskId(key);
      if (!taskId) continue;

      const data = await redis.hgetall(key) as RedisTaskState;
      
      if (Object.keys(data).length === 0) continue;

      // Only include active tasks
      const status = (data.status || 'PENDING').toUpperCase();
      if (!['PENDING', 'ASSIGNED', 'EXECUTING', 'ACCEPTED'].includes(status)) {
        continue;
      }

      const task: TaskSummary = {
        taskId: parseInt(taskId, 10),
        taskCode: taskId,
        status: mapRedisTaskStatus(status),
        deadlineSeconds: data.deadline ? parseFloat(data.deadline) : null,
        cpuCyclesRequired: 0, // Not stored in Redis state
        assignedVehicleId: data.vehicle_id ? parseVehicleIdFromString(data.vehicle_id) : null,
        assignedRsuId: data.target_id && data.decision_type === 'RSU' ? parseRsuIdFromString(data.target_id) : null,
        latencyMs: null,
        offloaded: data.decision_type === 'RSU' || data.decision_type === 'V2V',
        offloadTarget: data.target_id || null,
        createdSimTime: data.created_time ? parseFloat(data.created_time) : null,
        assignedSimTime: null,
        startedSimTime: null,
        completedSimTime: null,
      };

      tasks.push(task);
    }

    return tasks;
  } catch (error) {
    console.error('Error fetching tasks from Redis:', error);
    return [];
  }
}

/**
 * Get all RSU states from Redis
 */
export async function getRsusFromRedis(): Promise<RsuState[]> {
  const redis = getRedisClient();
  const rsus: RsuState[] = [];

  try {
    // Find all RSU keys - note: simulation uses "rsu:*:resources" not "rsu:*:state"
    const rsuKeys: string[] = [];
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'rsu:*:resources',
        'COUNT',
        100
      );
      cursor = nextCursor;
      rsuKeys.push(...keys);
    } while (cursor !== '0');

    // Fetch each RSU's state
    for (const key of rsuKeys) {
      const rsuId = extractRsuIdFromResourcesKey(key);
      if (!rsuId) continue;

      const data = await redis.hgetall(key) as RedisRsuState;
      
      if (Object.keys(data).length === 0) continue;

      const rsuIdNum = parseRsuIdFromString(rsuId);
      if (rsuIdNum === null) continue;

      const metric: RsuMetric = {
        id: rsuIdNum,
        rsuId: rsuIdNum,
        simTime: data.update_time ? parseFloat(data.update_time) : null,
        cpuUtilization: null,
        availableCpuCycles: data.cpu_available ? parseFloat(data.cpu_available) : null,
        memoryUtilization: null,
        queueLength: data.queue_length ? parseInt(data.queue_length, 10) : null,
        connectedVehicleCount: null,
        uplinkLoadMbps: null,
        downlinkLoadMbps: null,
        temperatureC: null,
        recordedAt: new Date().toISOString(),
        payload: null,
      };

      const rsu: RsuState = {
        rsuId: rsuIdNum,
        label: `RSU-${rsuIdNum}`,
        posX: data.pos_x ? parseFloat(data.pos_x) : null,
        posY: data.pos_y ? parseFloat(data.pos_y) : null,
        latitude: null,
        longitude: null,
        coverageRadiusM: 250, // Default
        cpuCapacityMips: null,
        memoryMb: data.memory_available ? parseFloat(data.memory_available) : null,
        storageGb: null,
        backhaulMbps: null,
        deploymentHeightM: null,
        meta: null,
        latestMetric: metric,
        activeAlerts: [],
      };

      rsus.push(rsu);
    }

    return rsus;
  } catch (error) {
    console.error('Error fetching RSUs from Redis:', error);
    return [];
  }
}

/**
 * Get dashboard metrics from Redis
 */
export interface DashboardMetrics {
  activeVehicleCount: number;
  averageVehicleSpeed: number | null;
  activeTaskCount: number;
  completedTaskCountLastHour: number;
  activeRsuCount: number;
  averageRsuCpuUtilization: number | null;
}

export async function getDashboardMetricsFromRedis(): Promise<DashboardMetrics> {
  const [vehicles, tasks, rsus] = await Promise.all([
    getVehicleStatesFromRedis(),
    getActiveTasksFromRedis(),
    getRsusFromRedis(),
  ]);

  const avgSpeed = vehicles.length > 0
    ? vehicles.reduce((sum, v) => sum + (v.speed || 0), 0) / vehicles.length
    : null;

  const avgCpu = rsus.length > 0 && rsus.some(r => r.latestMetric?.cpuUtilization)
    ? rsus
        .filter(r => r.latestMetric?.cpuUtilization !== null)
        .reduce((sum, r) => sum + (r.latestMetric?.cpuUtilization || 0), 0) / 
        rsus.filter(r => r.latestMetric?.cpuUtilization !== null).length
    : null;

  return {
    activeVehicleCount: vehicles.length,
    averageVehicleSpeed: avgSpeed,
    activeTaskCount: tasks.length,
    completedTaskCountLastHour: 0, // Redis doesn't track historical completed tasks
    activeRsuCount: rsus.length,
    averageRsuCpuUtilization: avgCpu,
  };
}

/**
 * Get count of active vehicles in Redis
 */
export async function getActiveVehicleCountFromRedis(): Promise<number> {
  const redis = getRedisClient();
  
  try {
    let count = 0;
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'vehicle:*:state',
        'COUNT',
        100
      );
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');

    return count;
  } catch (error) {
    console.error('Error counting vehicles from Redis:', error);
    return 0;
  }
}

/**
 * Get count of active tasks in Redis
 */
export async function getActiveTaskCountFromRedis(): Promise<number> {
  const redis = getRedisClient();
  
  try {
    let count = 0;
    let cursor = '0';
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'task:*:state',
        'COUNT',
        100
      );
      cursor = nextCursor;
      
      // Filter only active tasks
      for (const key of keys) {
        const data = await redis.hgetall(key) as RedisTaskState;
        const status = (data.status || 'PENDING').toUpperCase();
        if (['PENDING', 'ASSIGNED', 'EXECUTING', 'ACCEPTED'].includes(status)) {
          count++;
        }
      }
    } while (cursor !== '0');

    return count;
  } catch (error) {
    console.error('Error counting tasks from Redis:', error);
    return 0;
  }
}

// Helper functions

function extractVehicleId(key: string): string | null {
  const match = key.match(/^vehicle:(.+):state$/);
  return match ? match[1] : null;
}

function extractTaskId(key: string): string | null {
  const match = key.match(/^task:(.+):state$/);
  return match ? match[1] : null;
}

function extractRsuIdFromResourcesKey(key: string): string | null {
  const match = key.match(/^rsu:(.+):resources$/);
  return match ? match[1] : null;
}

function parseVehicleIdFromString(vehicleId: string): number | null {
  const match = vehicleId.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : null;
}

function parseRsuIdFromString(rsuId: string): number | null {
  // Handle both "RSU_0" and "rsu[0]" formats
  let match = rsuId.match(/RSU_(\d+)/);
  if (match) return parseInt(match[1], 10);
  
  match = rsuId.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : null;
}

function mapRedisTaskStatus(redisStatus: string): TaskSummary['status'] {
  const statusMap: Record<string, TaskSummary['status']> = {
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    ACCEPTED: 'accepted',
    EXECUTING: 'executing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'expired',
  };
  
  return statusMap[redisStatus] || 'pending';
}
