import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { loadEnv } from './config/env';
import { createSocketServer } from './sockets/server';
import apiRouter from './routes';
import { createDataSimulator } from './services/dataSimulator';

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

const simulatorEnabled = (process.env.DATA_SIMULATOR_ENABLED ?? 'true').toLowerCase() !== 'false';
const simulator = simulatorEnabled ? createDataSimulator() : null;

if (simulator) {
  simulator
    .start()
    .catch((error) => {
      console.error('Failed to start data simulator', error);
    });
}

server.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

let shuttingDown = false;

const shutdown = async () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log('Shutting down...');
  if (simulator) {
    await simulator.stop();
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
