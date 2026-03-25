import { useEffect, useRef, useState } from 'react'
import { Card, Badge, Tag, Space, Statistic, Row, Col } from 'antd'
import { useSocketStore } from '../../stores/socketStore'
import type { VehicleState, RsuState } from '../../types/api'

interface TaskLifecycleEvent {
  taskId: string
  vehicleId: string
  eventType: string
  simTime: number
  targetId?: string
  decisionType?: string
  posX: number
  posY: number
  additionalInfo?: string
  timestamp: number
  streamId: string
}

interface RealtimeMapViewProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  loading: boolean
}

// Event color mapping
const EVENT_COLORS: Record<string, string> = {
  TASK_CREATED: '#52c41a',
  METADATA_SENT: '#1890ff',
  DECISION_LOCAL: '#722ed1',
  DECISION_OFFLOAD: '#fa8c16',
  OFFLOADING_DECISION_IN_PROCESS: '#faad14',
  OFFLOADING_DECISION_SENDING: '#13c2c2',
  TASK_OFFLOADING: '#eb2f96',
  PROCESSING_STARTED: '#2f54eb',
  PROCESSING_COMPLETED: '#52c41a',
  COMPLETE_ON_TIME: '#52c41a',
  COMPLETE_LATE: '#faad14',
  TASK_FAILED: '#f5222d',
}

export function RealtimeMapView({ vehicles, rsus, loading }: RealtimeMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lifecycleEvents, setLifecycleEvents] = useState<TaskLifecycleEvent[]>([])
  const [recentEvents, setRecentEvents] = useState<TaskLifecycleEvent[]>([])
  const { socket } = useSocketStore()

  // Listen for task lifecycle events from WebSocket
  useEffect(() => {
    if (!socket) return

    const handleLifecycleEvent = (event: TaskLifecycleEvent) => {
      setLifecycleEvents(prev => [...prev.slice(-200), event]) // Keep last 200 events
      setRecentEvents(prev => [event, ...prev.slice(0, 9)]) // Keep last 10 for display
    }

    socket.on('task:lifecycle', handleLifecycleEvent)

    return () => {
      socket.off('task:lifecycle', handleLifecycleEvent)
    }
  }, [socket])

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 1
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Calculate scale and offset to fit all entities
    const allPositions = [
      ...vehicles.map(v => ({ x: v.posX || 0, y: v.posY || 0 })),
      ...rsus.map(r => ({ x: r.posX || 0, y: r.posY || 0 })),
    ]

    if (allPositions.length === 0) return

    const minX = Math.min(...allPositions.map(p => p.x))
    const maxX = Math.max(...allPositions.map(p => p.x))
    const minY = Math.min(...allPositions.map(p => p.y))
    const maxY = Math.max(...allPositions.map(p => p.y))

    const padding = 50
    const scaleX = (width - 2 * padding) / (maxX - minX || 1)
    const scaleY = (height - 2 * padding) / (maxY - minY || 1)
    const scale = Math.min(scaleX, scaleY)

    const toCanvasX = (x: number) => (x - minX) * scale + padding
    const toCanvasY = (y: number) => height - ((y - minY) * scale + padding) // Invert Y axis

    // Draw RSUs
    rsus.forEach(rsu => {
      if (rsu.posX === null || rsu.posY === null) return

      const x = toCanvasX(rsu.posX)
      const y = toCanvasY(rsu.posY)

      // Draw coverage radius
      ctx.strokeStyle = '#1890ff'
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, (rsu.coverageRadiusM || 250) * scale, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Draw RSU icon
      ctx.fillStyle = '#1890ff'
      ctx.beginPath()
      ctx.moveTo(x, y - 15)
      ctx.lineTo(x - 10, y + 5)
      ctx.lineTo(x + 10, y + 5)
      ctx.closePath()
      ctx.fill()

      // Draw label
      ctx.fillStyle = '#000'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(rsu.label || `RSU-${rsu.rsuId}`, x, y + 25)
    })

    // Draw vehicles
    vehicles.forEach(vehicle => {
      if (vehicle.posX === null || vehicle.posY === null) return

      const x = toCanvasX(vehicle.posX)
      const y = toCanvasY(vehicle.posY)

      // Draw vehicle as circle
      ctx.fillStyle = '#52c41a'
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fill()

      // Draw vehicle direction indicator
      if (vehicle.heading !== null) {
        const heading = vehicle.heading * (Math.PI / 180) - Math.PI / 2 // Convert to radians
        ctx.strokeStyle = '#52c41a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(heading) * 15, y + Math.sin(heading) * 15)
        ctx.stroke()
      }

      // Draw label
      ctx.fillStyle = '#000'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(vehicle.label || `V${vehicle.vehId}`, x, y - 15)
    })

    // Draw recent lifecycle events as animated lines/indicators
    lifecycleEvents.slice(-50).forEach((event, index) => {
      const age = lifecycleEvents.length - index
      const alpha = Math.max(0, 1 - age / 50)

      const x = toCanvasX(event.posX)
      const y = toCanvasY(event.posY)

      // Draw event marker
      ctx.fillStyle = EVENT_COLORS[event.eventType] || '#999'
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.globalAlpha = 1

      // Draw connection line if there's a target
      if (event.targetId && event.targetId.startsWith('RSU_')) {
        const targetRsu = rsus.find(r => `RSU_${r.rsuId}` === event.targetId)
        if (targetRsu && targetRsu.posX && targetRsu.posY) {
          const tx = toCanvasX(targetRsu.posX)
          const ty = toCanvasY(targetRsu.posY)

          ctx.strokeStyle = EVENT_COLORS[event.eventType] || '#999'
          ctx.globalAlpha = alpha * 0.5
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        }
      }
    })
  }, [vehicles, rsus, lifecycleEvents])

  // Statistics
  const totalEvents = lifecycleEvents.length
  const eventsByType = lifecycleEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="Active Vehicles" value={vehicles.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Active RSUs" value={rsus.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Total Events" value={totalEvents} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Recent Events"
              value={lifecycleEvents.filter((e, i) => i >= lifecycleEvents.length - 10).length}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        <Col span={16} style={{ height: '100%' }}>
          <Card title="Real-Time Map" style={{ height: '100%' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: 'calc(100% - 50px)',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
              }}
            />
          </Card>
        </Col>

        <Col span={8} style={{ height: '100%' }}>
          <Card title="Live Task Events" style={{ height: '100%', overflow: 'auto' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {recentEvents.map((event, index) => (
                <Card key={event.streamId} size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Tag color={EVENT_COLORS[event.eventType] || 'default'}>{event.eventType}</Tag>
                      <Badge count={`V${event.vehicleId}`} />
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Task: {event.taskId.substring(0, 20)}...
                    </div>
                    {event.targetId && (
                      <div style={{ fontSize: 12, color: '#666' }}>Target: {event.targetId}</div>
                    )}
                    {event.decisionType && (
                      <div style={{ fontSize: 12, color: '#666' }}>Decision: {event.decisionType}</div>
                    )}
                    {event.additionalInfo && (
                      <div style={{ fontSize: 11, color: '#999' }}>{event.additionalInfo}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#999' }}>
                      Sim Time: {event.simTime.toFixed(3)}s
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
