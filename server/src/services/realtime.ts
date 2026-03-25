import type { Server as SocketIOServer } from 'socket.io';
import {
  getVehicleStatesFromRedis,
  getActiveTasksFromRedis,
  getRsusFromRedis,
  getDashboardMetricsFromRedis,
  getTaskLifecycleEvents
} from './redisService';

export interface RealtimeService {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createRealtimeService(io: SocketIOServer): RealtimeService {
  let started = false;
  let pollingTimer: NodeJS.Timeout | undefined;
  let lifecycleTimer: NodeJS.Timeout | undefined;
  let lastLifecycleEventId = '$'; // Start from new events only

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

  async function broadcastTaskLifecycleEvents(): Promise<void> {
    try {
      const events = await getTaskLifecycleEvents(lastLifecycleEventId, 50);

      if (events.length > 0) {
        // Update last event ID to the last event we received
        lastLifecycleEventId = events[events.length - 1].streamId;

        // Broadcast each event
        for (const event of events) {
          io.emit('task:lifecycle', event);
        }

        console.log(`Broadcasted ${events.length} task lifecycle events`);
      }
    } catch (error) {
      console.error('Error broadcasting task lifecycle events:', error);
    }
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;

    console.log('Starting realtime service with Redis data source');

    await broadcastSnapshot();

    // Poll Redis every 2 seconds for live snapshot updates
    pollingTimer = setInterval(async () => {
      try {
        await broadcastSnapshot();
      } catch (error) {
        console.error('Failed to broadcast snapshot', error);
      }
    }, 2_000);

    // Poll for task lifecycle events more frequently (every 500ms) for real-time feel
    lifecycleTimer = setInterval(async () => {
      try {
        await broadcastTaskLifecycleEvents();
      } catch (error) {
        console.error('Failed to broadcast lifecycle events', error);
      }
    }, 500);
  }

  async function stop(): Promise<void> {
    if (!started) return;
    started = false;

    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    }

    if (lifecycleTimer) {
      clearInterval(lifecycleTimer);
      lifecycleTimer = undefined;
    }
  }

  return { start, stop };
}
