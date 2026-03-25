import net from 'node:net';
import type { Server as SocketIOServer } from 'socket.io';

export interface SimulationBridgeService {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface VehicleUpdate {
  type: 'VEHICLE_UPDATE';
  vehicleId: string;
  posX: number;
  posY: number;
  speed: number;
  heading: number;
  cpuUtilization: number;
  memUtilization: number;
  queueLength: number;
  processingCount: number;
  simTime: number;
}

interface RsuUpdate {
  type: 'RSU_UPDATE';
  rsuId: string;
  posX: number;
  posY: number;
  cpuAvailable: number;
  memoryAvailable: number;
  queueLength: number;
  processingCount: number;
  simTime: number;
}

interface TaskLifecycleEvent {
  type: 'TASK_LIFECYCLE';
  taskId: string;
  vehicleId: string;
  eventType: string;
  simTime: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetId?: string;
  decisionType?: string;
  additionalInfo?: string;
}

interface TaskCommunication {
  type: 'TASK_COMMUNICATION';
  taskId: string;
  commType: string;
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  simTime: number;
  durationMs: number;
}

interface SimStart {
  type: 'SIM_START';
  totalTime: number;
}

interface SimEnd {
  type: 'SIM_END';
}

interface SimTime {
  type: 'SIM_TIME';
  simTime: number;
}

interface RoadNetwork {
  type: 'ROAD_NETWORK';
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  edges: Array<{
    id: string;
    lanes: Array<{
      id: string;
      points: Array<{ x: number; y: number }>;
      width: number;
      speed: number;
    }>;
  }>;
  junctions: Array<{
    id: string;
    x: number;
    y: number;
    type: string;
  }>;
  timestamp: number;
}

type SimulationMessage =
  | VehicleUpdate
  | RsuUpdate
  | TaskLifecycleEvent
  | TaskCommunication
  | SimStart
  | SimEnd
  | SimTime
  | RoadNetwork;

export function createSimulationBridge(io: SocketIOServer, port = 4001): SimulationBridgeService {
  let server: net.Server | null = null;
  let started = false;

  // Track current state for new WebSocket connections
  const vehicleStates = new Map<string, VehicleUpdate>();
  const rsuStates = new Map<string, RsuUpdate>();
  let currentSimTime = 0;
  let simulationRunning = false;
  let roadNetwork: RoadNetwork | null = null;

  function processMessage(message: SimulationMessage): void {
    console.log('[TCP BRIDGE] Received message:', message.type, message);

    switch (message.type) {
      case 'VEHICLE_UPDATE': {
        vehicleStates.set(message.vehicleId, message);

        // Emit to all connected WebSocket clients
        io.emit('sim:vehicle', {
          vehId: message.vehicleId.replace('node[', '').replace(']', ''),
          label: message.vehicleId,
          posX: message.posX,
          posY: message.posY,
          speed: message.speed,
          heading: message.heading,
          payload: {
            cpuUtilization: message.cpuUtilization,
            memUtilization: message.memUtilization,
            queueLength: message.queueLength,
            processingCount: message.processingCount,
          },
          simTime: message.simTime,
        });
        console.log(`[TCP BRIDGE] Vehicle update sent for ${message.vehicleId}`);
        break;
      }

      case 'RSU_UPDATE': {
        rsuStates.set(message.rsuId, message);

        io.emit('sim:rsu', {
          rsuId: message.rsuId.replace('RSU_', ''),
          label: message.rsuId,
          posX: message.posX,
          posY: message.posY,
          cpuAvailable: message.cpuAvailable,
          memoryAvailable: message.memoryAvailable,
          queueLength: message.queueLength,
          processingCount: message.processingCount,
          simTime: message.simTime,
        });
        console.log(`[TCP BRIDGE] RSU update sent for ${message.rsuId}`);
        break;
      }

      case 'TASK_LIFECYCLE': {
        io.emit('task:lifecycle', {
          taskId: message.taskId,
          vehicleId: message.vehicleId,
          eventType: message.eventType,
          simTime: message.simTime,
          posX: message.fromX,
          posY: message.fromY,
          targetId: message.targetId || null,
          decisionType: message.decisionType || null,
          additionalInfo: message.additionalInfo || null,
          timestamp: Date.now(),
          streamId: `direct-${Date.now()}`,
        });
        console.log(`[TCP BRIDGE] Lifecycle event: ${message.eventType} for task ${message.taskId}`);
        break;
      }

      case 'TASK_COMMUNICATION': {
        io.emit('task:communication', {
          taskId: message.taskId,
          commType: message.commType,
          fromId: message.fromId,
          toId: message.toId,
          fromX: message.fromX,
          fromY: message.fromY,
          toX: message.toX,
          toY: message.toY,
          simTime: message.simTime,
          durationMs: message.durationMs,
          timestamp: Date.now(),
        });
        console.log(`[TCP BRIDGE] Communication animation: ${message.commType} from ${message.fromId} to ${message.toId}`);
        break;
      }

      case 'SIM_START': {
        simulationRunning = true;
        vehicleStates.clear();
        rsuStates.clear();
        currentSimTime = 0;

        io.emit('sim:start', {
          totalTime: message.totalTime,
          timestamp: Date.now(),
        });
        console.log(`Simulation started (total time: ${message.totalTime}s)`);
        break;
      }

      case 'SIM_END': {
        simulationRunning = false;

        io.emit('sim:end', {
          timestamp: Date.now(),
        });
        console.log('Simulation ended');
        break;
      }

      case 'SIM_TIME': {
        currentSimTime = message.simTime;

        // Emit time update less frequently to avoid flooding
        io.emit('sim:time', {
          simTime: message.simTime,
          timestamp: Date.now(),
        });
        break;
      }

      case 'ROAD_NETWORK': {
        roadNetwork = message;

        io.emit('sim:road-network', {
          bounds: message.bounds,
          edges: message.edges,
          junctions: message.junctions,
          timestamp: Date.now(),
        });
        console.log(`[TCP BRIDGE] Road network loaded: ${message.edges.length} edges, ${message.junctions.length} junctions`);
        break;
      }
    }
  }

  function handleConnection(socket: net.Socket): void {
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`OMNeT++ simulation connected from ${remoteAddr}`);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // Messages are newline-delimited JSON
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line.length === 0) continue;

        try {
          const message = JSON.parse(line) as SimulationMessage;
          processMessage(message);
        } catch (err) {
          console.error('Failed to parse simulation message:', line, err);
        }
      }
    });

    socket.on('close', () => {
      console.log(`OMNeT++ simulation disconnected from ${remoteAddr}`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error from ${remoteAddr}:`, err.message);
    });
  }

  async function start(): Promise<void> {
    if (started) return;
    started = true;

    server = net.createServer(handleConnection);

    server.on('error', (err) => {
      console.error('Simulation bridge server error:', err);
    });

    return new Promise((resolve, reject) => {
      server!.listen(port, '0.0.0.0', () => {
        console.log(`Simulation bridge listening on port ${port} (TCP)`);
        resolve();
      });

      server!.once('error', reject);
    });
  }

  async function stop(): Promise<void> {
    if (!started) return;
    started = false;

    return new Promise((resolve) => {
      if (server) {
        server.close(() => {
          console.log('Simulation bridge stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Provide current state for new WebSocket clients
  io.on('connection', (socket) => {
    // Send current simulation state to newly connected client
    if (simulationRunning) {
      socket.emit('sim:state', {
        running: true,
        simTime: currentSimTime,
        vehicles: Array.from(vehicleStates.values()).map(v => ({
          vehId: v.vehicleId.replace('node[', '').replace(']', ''),
          label: v.vehicleId,
          posX: v.posX,
          posY: v.posY,
          speed: v.speed,
          heading: v.heading,
          payload: {
            cpuUtilization: v.cpuUtilization,
            memUtilization: v.memUtilization,
            queueLength: v.queueLength,
            processingCount: v.processingCount,
          },
          simTime: v.simTime,
        })),
        rsus: Array.from(rsuStates.values()).map(r => ({
          rsuId: r.rsuId.replace('RSU_', ''),
          label: r.rsuId,
          posX: r.posX,
          posY: r.posY,
          cpuAvailable: r.cpuAvailable,
          memoryAvailable: r.memoryAvailable,
          queueLength: r.queueLength,
          processingCount: r.processingCount,
          simTime: r.simTime,
        })),
      });
    }

    // Send road network if available
    if (roadNetwork) {
      socket.emit('sim:road-network', {
        bounds: roadNetwork.bounds,
        edges: roadNetwork.edges,
        junctions: roadNetwork.junctions,
        timestamp: Date.now(),
      });
    }
  });

  return { start, stop };
}
