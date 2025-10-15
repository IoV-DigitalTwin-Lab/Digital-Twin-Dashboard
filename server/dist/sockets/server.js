"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
const socket_io_1 = require("socket.io");
const realtime_1 = require("../services/realtime");
function createSocketServer(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_ORIGIN?.split(',') ?? '*',
            methods: ['GET', 'POST'],
        },
    });
    const realtime = (0, realtime_1.createRealtimeService)(io);
    void realtime.start();
    io.on('connection', (socket) => {
        console.log(`Socket connected ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`Socket disconnected ${socket.id}`);
        });
    });
    return io;
}
