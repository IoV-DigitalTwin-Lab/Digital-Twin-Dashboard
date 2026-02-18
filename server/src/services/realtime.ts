import type { Server as SocketIOServer } from 'socket.io';
import { 
  getVehicleStatesFromRedis, 
  getActiveTasksFromRedis, 
  getRsusFromRedis,
  getDashboardMetricsFromRedis 
} from './redisService';

export interface RealtimeService {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createRealtimeService(io: SocketIOServer): RealtimeService {
  let started = false;
  let pollingTimer: NodeJS.Timeout | undefined;

  async function broadcastSnapshot(): Promise<void> {
    try {
      const [vehicles, rsus, tasks, metrics] = await Promise.all([
        getVehicleStatesFromRedis(),
        getRsusFromRedis(),
        getActiveTasksFromRedis(),
        getDashboardMetricsFromRedis(),
      ]);

      io.emit('dashboard:snapshot', {
        vehicles,
        rsus,
        tasks,
        metrics,
        emittedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error broadcasting snapshot from Redis:', error);
    }
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;

    console.log('Starting realtime service with Redis data source');
    
    await broadcastSnapshot();

    // Poll Redis every 2 seconds for live updates
    pollingTimer = setInterval(async () => {
      try {
        await broadcastSnapshot();
      } catch (error) {
        console.error('Failed to broadcast snapshot', error);
      }
    }, 2_000);
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
