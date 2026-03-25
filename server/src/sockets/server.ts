import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createRealtimeService } from '../services/realtime';
import { createSimulationBridge } from '../services/simulationBridge';

export function createSocketServer(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(',') ?? '*',
      methods: ['GET', 'POST'],
    },
  });

  const realtime = createRealtimeService(io);
  void realtime.start();

  // Start the TCP simulation bridge for direct OMNeT++ communication
  const simBridgePort = Number(process.env.SIM_BRIDGE_PORT || 4001);
  const simBridge = createSimulationBridge(io, simBridgePort);
  void simBridge.start().catch((err) => {
    console.error('Failed to start simulation bridge:', err);
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected ${socket.id}`);
    });
  });

  return io;
}
