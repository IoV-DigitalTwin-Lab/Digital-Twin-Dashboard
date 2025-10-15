"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRealtimeService = createRealtimeService;
const db_1 = require("../db");
const metricsService_1 = require("./metricsService");
const rsuService_1 = require("./rsuService");
const taskService_1 = require("./taskService");
const vehicleService_1 = require("./vehicleService");
const CHANNELS = [
    'vehicle_telemetry_events',
    'rsu_metrics_events',
    'edge_task_events',
    'task_assignment_events',
    'system_alert_events',
];
function createRealtimeService(io) {
    let started = false;
    let pollingTimer;
    let listening = false;
    async function broadcastSnapshot() {
        const [vehicles, rsus, tasks, metrics] = await Promise.all([
            (0, vehicleService_1.getVehicleStates)(),
            (0, rsuService_1.getRsus)(),
            (0, taskService_1.getActiveTasks)(),
            (0, metricsService_1.getDashboardMetrics)(),
        ]);
        io.emit('dashboard:snapshot', {
            vehicles,
            rsus,
            tasks,
            metrics,
            emittedAt: new Date().toISOString(),
        });
    }
    async function setupListeners() {
        if (listening)
            return;
        listening = true;
        const pool = (0, db_1.getPool)();
        const client = await pool.connect();
        client.on('error', (err) => {
            console.error('Realtime listener error', err);
        });
        client.on('notification', (message) => {
            try {
                const payload = message.payload ? JSON.parse(message.payload) : null;
                if (!payload)
                    return;
                io.emit('db:event', {
                    channel: message.channel,
                    ...payload,
                    receivedAt: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('Failed to process notification', error);
            }
        });
        for (const channel of CHANNELS) {
            await client.query(`LISTEN ${channel}`);
        }
    }
    async function start() {
        if (started)
            return;
        started = true;
        await broadcastSnapshot();
        await setupListeners();
        pollingTimer = setInterval(async () => {
            try {
                await broadcastSnapshot();
            }
            catch (error) {
                console.error('Failed to broadcast snapshot', error);
            }
        }, 200);
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
