import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type { DashboardSnapshot, VehicleState, RsuState } from '../types/api'

interface TaskLifecycleEvent {
  taskId: string
  vehicleId: string
  eventType: string
  simTime: number
  posX: number
  posY: number
  targetId?: string | null
  decisionType?: string | null
  additionalInfo?: string | null
  timestamp: number
  streamId: string
}

interface TaskCommunication {
  taskId: string
  commType: string
  fromId: string
  toId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  simTime: number
  durationMs: number
  timestamp: number
}

interface SimulationState {
  running: boolean
  simTime: number
  totalTime: number
}

interface RoadNetwork {
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  edges: Array<{
    id: string
    lanes: Array<{
      id: string
      points: Array<{ x: number; y: number }>
      width: number
      speed: number
    }>
  }>
  junctions: Array<{
    id: string
    x: number
    y: number
    type: string
  }>
}

interface SocketState {
  socket: Socket | null
  latestSnapshot: DashboardSnapshot | null
  status: 'disconnected' | 'connecting' | 'connected'

  // Direct simulation state (from TCP bridge)
  directVehicles: Map<string, VehicleState>
  directRsus: Map<string, RsuState>
  taskLifecycleEvents: TaskLifecycleEvent[]
  activeTaskCommunications: TaskCommunication[]
  simulationState: SimulationState
  roadNetwork: RoadNetwork | null

  connect: () => void
  disconnect: () => void
  getVehicles: () => VehicleState[]
  getRsus: () => RsuState[]
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  latestSnapshot: null,
  status: 'disconnected',

  // Direct simulation state
  directVehicles: new Map(),
  directRsus: new Map(),
  taskLifecycleEvents: [],
  activeTaskCommunications: [],
  simulationState: { running: false, simTime: 0, totalTime: 0 },
  roadNetwork: null,

  connect: () => {
    if (get().socket) {
      return
    }

    set({ status: 'connecting' })

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      set({ status: 'connected' })
    })

    socket.on('disconnect', () => {
      set({ status: 'disconnected', socket: null })
    })

    // Redis polling snapshot (fallback)
    socket.on('dashboard:snapshot', (payload: DashboardSnapshot) => {
      set({ latestSnapshot: payload })
    })

    // Direct vehicle update from OMNeT++
    socket.on('sim:vehicle', (vehicle: VehicleState) => {
      const vehicles = new Map(get().directVehicles)
      vehicles.set(vehicle.label || `V${vehicle.vehId}`, vehicle)
      set({ directVehicles: vehicles })
    })

    // Direct RSU update from OMNeT++
    socket.on('sim:rsu', (rsu: RsuState) => {
      const rsus = new Map(get().directRsus)
      rsus.set(rsu.label || `RSU_${rsu.rsuId}`, rsu)
      set({ directRsus: rsus })
    })

    // Task lifecycle events (for event log and markers)
    socket.on('task:lifecycle', (event: TaskLifecycleEvent) => {
      const events = get().taskLifecycleEvents
      // Keep last 200 events
      const newEvents = [...events.slice(-199), event]
      set({ taskLifecycleEvents: newEvents })
    })

    // Task communication (for animated lines)
    socket.on('task:communication', (comm: TaskCommunication) => {
      const comms = get().activeTaskCommunications
      const newComms = [...comms, comm]
      set({ activeTaskCommunications: newComms })

      // Remove communication after animation duration
      setTimeout(() => {
        const currentComms = get().activeTaskCommunications
        set({
          activeTaskCommunications: currentComms.filter(
            (c) => c.timestamp !== comm.timestamp || c.taskId !== comm.taskId
          ),
        })
      }, comm.durationMs + 100)
    })

    // Simulation control events
    socket.on('sim:start', (data: { totalTime: number }) => {
      set({
        simulationState: { running: true, simTime: 0, totalTime: data.totalTime },
        directVehicles: new Map(),
        directRsus: new Map(),
        taskLifecycleEvents: [],
        activeTaskCommunications: [],
      })
    })

    socket.on('sim:end', () => {
      set({
        simulationState: { ...get().simulationState, running: false },
      })
    })

    socket.on('sim:time', (data: { simTime: number }) => {
      set({
        simulationState: { ...get().simulationState, simTime: data.simTime },
      })
    })

    // Road network data
    socket.on('sim:road-network', (network: RoadNetwork) => {
      set({ roadNetwork: network })
      console.log('Road network loaded:', network.edges.length, 'edges')
    })

    // Initial state for new connection
    socket.on('sim:state', (state: { running: boolean; simTime: number; vehicles: VehicleState[]; rsus: RsuState[] }) => {
      const vehicles = new Map<string, VehicleState>()
      const rsus = new Map<string, RsuState>()

      for (const v of state.vehicles) {
        vehicles.set(v.label || `V${v.vehId}`, v)
      }
      for (const r of state.rsus) {
        rsus.set(r.label || `RSU_${r.rsuId}`, r)
      }

      set({
        simulationState: { running: state.running, simTime: state.simTime, totalTime: 0 },
        directVehicles: vehicles,
        directRsus: rsus,
      })
    })

    socket.on('db:event', (event) => {
      console.debug('db:event', event)
    })

    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    socket?.disconnect()
    set({ socket: null, status: 'disconnected' })
  },

  // Helper to get vehicles (prefer direct, fallback to snapshot)
  getVehicles: () => {
    const { directVehicles, latestSnapshot } = get()
    if (directVehicles.size > 0) {
      return Array.from(directVehicles.values())
    }
    return latestSnapshot?.vehicles ?? []
  },

  // Helper to get RSUs (prefer direct, fallback to snapshot)
  getRsus: () => {
    const { directRsus, latestSnapshot } = get()
    if (directRsus.size > 0) {
      return Array.from(directRsus.values())
    }
    return latestSnapshot?.rsus ?? []
  },
}))
