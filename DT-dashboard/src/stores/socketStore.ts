import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type { DashboardSnapshot } from '../types/api'

interface SocketState {
  socket: Socket | null
  latestSnapshot: DashboardSnapshot | null
  status: 'disconnected' | 'connecting' | 'connected'
  connect: () => void
  disconnect: () => void
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  latestSnapshot: null,
  status: 'disconnected',
  connect: () => {
    if (get().socket) {
      return
    }

    set({ status: 'connecting' })

    const socket = io(SOCKET_URL)

    socket.on('connect', () => {
      set({ status: 'connected' })
    })

    socket.on('disconnect', () => {
      set({ status: 'disconnected', socket: null })
    })

    socket.on('dashboard:snapshot', (payload: DashboardSnapshot) => {
      set({ latestSnapshot: payload })
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection failed', error)
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
}))
