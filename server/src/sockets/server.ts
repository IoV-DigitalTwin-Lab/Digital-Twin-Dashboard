import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createRealtimeService } from '../services/realtime';

export function createSocketServer(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(',') ?? '*',
      methods: ['GET', 'POST'],
    },
  });

  const realtime = createRealtimeService(io);
  void realtime.start();

  io.on('connection', (socket) => {
    console.log(`Socket connected ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected ${socket.id}`);
    });
  });

  return io;
}
