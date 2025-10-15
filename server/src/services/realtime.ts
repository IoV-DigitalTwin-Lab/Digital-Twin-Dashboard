import type { Server as SocketIOServer } from 'socket.io';
import { getPool } from '../db';
import { getDashboardMetrics } from './metricsService';
import { getRsus } from './rsuService';
import { getActiveTasks } from './taskService';
import { getVehicleStates } from './vehicleService';

interface NotificationPayload {
  op: string;
  table: string;
  data: unknown;
}

const CHANNELS = [
  'vehicle_telemetry_events',
  'rsu_metrics_events',
  'edge_task_events',
  'task_assignment_events',
  'system_alert_events',
];

export interface RealtimeService {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createRealtimeService(io: SocketIOServer): RealtimeService {
  let started = false;
  let pollingTimer: NodeJS.Timeout | undefined;
  let listening = false;

  async function broadcastSnapshot(): Promise<void> {
    const [vehicles, rsus, tasks, metrics] = await Promise.all([
      getVehicleStates(),
      getRsus(),
      getActiveTasks(),
      getDashboardMetrics(),
    ]);

    io.emit('dashboard:snapshot', {
      vehicles,
      rsus,
      tasks,
      metrics,
      emittedAt: new Date().toISOString(),
    });
  }

  async function setupListeners(): Promise<void> {
    if (listening) return;
    listening = true;

    const pool = getPool();
    const client = await pool.connect();

    client.on('error', (err) => {
      console.error('Realtime listener error', err);
    });

    client.on('notification', (message) => {
      try {
        const payload = message.payload ? (JSON.parse(message.payload) as NotificationPayload) : null;
        if (!payload) return;
        io.emit('db:event', {
          channel: message.channel,
          ...payload,
          receivedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to process notification', error);
      }
    });

    for (const channel of CHANNELS) {
      await client.query(`LISTEN ${channel}`);
    }
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;

    await broadcastSnapshot();
    await setupListeners();

    pollingTimer = setInterval(async () => {
      try {
        await broadcastSnapshot();
      } catch (error) {
        console.error('Failed to broadcast snapshot', error);
      }
    }, 200);
  }

  async function stop(): Promise<void> {
    if (!started) return;
    started = false;

    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }
  }

  return { start, stop };
}
