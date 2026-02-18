"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRealtimeService = createRealtimeService;
const redisService_1 = require("./redisService");
function createRealtimeService(io) {
    let started = false;
    let pollingTimer;
    async function broadcastSnapshot() {
        try {
            const [vehicles, rsus, tasks, metrics] = await Promise.all([
                (0, redisService_1.getVehicleStatesFromRedis)(),
                (0, redisService_1.getRsusFromRedis)(),
                (0, redisService_1.getActiveTasksFromRedis)(),
                (0, redisService_1.getDashboardMetricsFromRedis)(),
            ]);
            io.emit('dashboard:snapshot', {
                vehicles,
                rsus,
                tasks,
                metrics,
                emittedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error broadcasting snapshot from Redis:', error);
        }
    }
    async function start() {
        if (started)
            return;
        started = true;
        console.log('Starting realtime service with Redis data source');
        await broadcastSnapshot();
        // Poll Redis every 2 seconds for live updates
        pollingTimer = setInterval(async () => {
            try {
                await broadcastSnapshot();
            }
            catch (error) {
                console.error('Failed to broadcast snapshot', error);
            }
        }, 2000);
    }
    async function stop() {
        if (!started)
            return;
        started = false;
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = undefined;
        }
    }
    return { start, stop };
}
