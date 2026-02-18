"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const server_1 = require("./sockets/server");
const routes_1 = __importDefault(require("./routes"));
// Data simulator disabled - using live Redis data from simulation
// import { createDataSimulator } from './services/dataSimulator';
(0, env_1.loadEnv)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const server = node_http_1.default.createServer(app);
(0, server_1.createSocketServer)(server);
// Dummy data simulator is DISABLED when using live Redis data
// Set DATA_SIMULATOR_ENABLED=false in .env or remove to disable
const simulatorEnabled = (process.env.DATA_SIMULATOR_ENABLED ?? 'false').toLowerCase() === 'true';
if (simulatorEnabled) {
    console.warn('WARNING: Data simulator is enabled. Disable it to use live Redis data.');
    // const simulator = createDataSimulator();
    // simulator.start().catch((error) => {
    //   console.error('Failed to start data simulator', error);
    // });
}
else {
    console.log('Data simulator disabled - using live Redis data from simulation');
}
server.listen(port, host, () => {
    console.log(`API listening on http://${host}:${port}`);
    console.log(`Data source: ${simulatorEnabled ? 'Dummy Simulator (PostgreSQL)' : 'Live Redis'}`);
});
let shuttingDown = false;
const shutdown = async () => {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    console.log('Shutting down...');
    server.close(() => {
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
