import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { loadEnv } from './config/env';
import { createSocketServer } from './sockets/server';
import apiRouter from './routes';
// Data simulator disabled - using live Redis data from simulation
// import { createDataSimulator } from './services/dataSimulator';

loadEnv();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

createSocketServer(server);

// Dummy data simulator is DISABLED when using live Redis data
// Set DATA_SIMULATOR_ENABLED=false in .env or remove to disable
const simulatorEnabled = (process.env.DATA_SIMULATOR_ENABLED ?? 'false').toLowerCase() === 'true';

if (simulatorEnabled) {
  console.warn('WARNING: Data simulator is enabled. Disable it to use live Redis data.');
  // const simulator = createDataSimulator();
  // simulator.start().catch((error) => {
  //   console.error('Failed to start data simulator', error);
  // });
} else {
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
