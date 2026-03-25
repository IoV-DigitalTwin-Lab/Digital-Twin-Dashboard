import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Drawer, Descriptions, Tag, Tabs, List, Empty, Spin } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useSocketStore } from '../../stores/socketStore'
import type { VehicleState, RsuState } from '../../types/api'
import './SimulationMap.css'

interface TaskLifecycleEvent {
  taskId: string
  vehicleId: string
  eventType: string
  simTime: number
  targetId?: string | null
  decisionType?: string | null
  posX: number
  posY: number
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

interface ActiveLink {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  type: 'metadata' | 'decision' | 'offload' | 'result'
  taskId: string
  progress: number
  color: string
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

interface SimulationMapProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  loading: boolean
  taskLifecycleEvents?: TaskLifecycleEvent[]
  activeTaskCommunications?: TaskCommunication[]
  simTime?: number
  roadNetwork?: RoadNetwork | null
}

const LINK_COLORS: Record<string, string> = {
  metadata: '#1890ff',
  decision: '#52c41a',
  offload: '#fa8c16',
  result: '#722ed1',
  DECISION: '#52c41a', // Direct from OMNeT++
  RESULT: '#722ed1',   // Direct from OMNeT++
  METADATA: '#1890ff', // Direct from OMNeT++
  OFFLOAD: '#fa8c16',  // Direct from OMNeT++
}

const LINK_LABELS: Record<string, string> = {
  metadata: 'Sending Metadata',
  decision: 'Decision Response',
  offload: 'Task Offloading',
  result: 'Result Return',
}

export function SimulationMap({
  vehicles,
  rsus,
  loading,
  taskLifecycleEvents = [],
  activeTaskCommunications = [],
  simTime = 0,
  roadNetwork = null
}: SimulationMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // View state for pan/zoom
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1500, height: 1000 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Selection state
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'vehicle' | 'rsu'; id: string } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Task lifecycle events and active links
  const [localLifecycleEvents, setLocalLifecycleEvents] = useState<TaskLifecycleEvent[]>([])
  const [activeLinks, setActiveLinks] = useState<ActiveLink[]>([])
  const { socket } = useSocketStore()

  // Prefer props, fallback to local state (for socket events)
  const lifecycleEvents = taskLifecycleEvents.length > 0 ? taskLifecycleEvents : localLifecycleEvents

  // Convert task communications to active links for animation
  useEffect(() => {
    const newLinks = activeTaskCommunications.map((comm): ActiveLink => {
      const linkType = comm.commType.toLowerCase() as ActiveLink['type']
      return {
        id: `${comm.taskId}-${comm.commType}-${comm.timestamp}`,
        fromX: comm.fromX,
        fromY: comm.fromY,
        toX: comm.toX,
        toY: comm.toY,
        type: linkType,
        taskId: comm.taskId,
        progress: 0, // Will start animation
        color: LINK_COLORS[comm.commType] || LINK_COLORS[linkType] || '#666666',
      }
    })

    if (newLinks.length === 0) return

    // Add new links to state
    setActiveLinks(prev => {
      const filtered = prev.filter(l => !newLinks.some(n => n.taskId === l.taskId && n.type === l.type))
      return [...filtered, ...newLinks]
    })

    // Start animations for new links
    newLinks.forEach(link => {
      let progress = 0
      const animationDuration = activeTaskCommunications.find(c => c.taskId === link.taskId)?.durationMs || 300
      const frameRate = 50 // ms per frame
      const progressStep = (100 / animationDuration) * frameRate

      const interval = setInterval(() => {
        progress += progressStep
        if (progress >= 100) {
          clearInterval(interval)
          setActiveLinks(prev => prev.filter(l => l.id !== link.id))
        } else {
          setActiveLinks(prev => prev.map(l => l.id === link.id ? { ...l, progress } : l))
        }
      }, frameRate)
    })
  }, [activeTaskCommunications])

  // Calculate bounds from all entities and road network
  const bounds = useMemo(() => {
    const allX = [...vehicles.map(v => v.posX || 0), ...rsus.map(r => r.posX || 0)]
    const allY = [...vehicles.map(v => v.posY || 0), ...rsus.map(r => r.posY || 0)]

    // Use road network bounds if available and there are no entities yet
    if (allX.length === 0 && roadNetwork) {
      const padding = 50
      return {
        minX: roadNetwork.bounds.minX - padding,
        maxX: roadNetwork.bounds.maxX + padding,
        minY: roadNetwork.bounds.minY - padding,
        maxY: roadNetwork.bounds.maxY + padding,
      }
    }

    // Use road network bounds as baseline if available
    if (roadNetwork && allX.length > 0) {
      const padding = 100
      return {
        minX: Math.min(Math.min(...allX), roadNetwork.bounds.minX) - padding,
        maxX: Math.max(Math.max(...allX), roadNetwork.bounds.maxX) + padding,
        minY: Math.min(Math.min(...allY), roadNetwork.bounds.minY) - padding,
        maxY: Math.max(Math.max(...allY), roadNetwork.bounds.maxY) + padding,
      }
    }

    if (allX.length === 0) return { minX: 0, maxX: 1500, minY: 0, maxY: 1000 }

    const padding = 100
    return {
      minX: Math.min(...allX) - padding,
      maxX: Math.max(...allX) + padding,
      minY: Math.min(...allY) - padding,
      maxY: Math.max(...allY) + padding,
    }
  }, [vehicles, rsus, roadNetwork])

  // Initialize view to fit all entities
  useEffect(() => {
    if (vehicles.length > 0 || rsus.length > 0) {
      setViewBox({
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      })
    }
  }, [bounds, vehicles.length, rsus.length])

  // Create animated link between entities
  const createLink = useCallback((event: TaskLifecycleEvent, type: ActiveLink['type']) => {
    const vehicleId = event.vehicleId
    const targetId = event.targetId

    const vehicle = vehicles.find(v => String(v.vehId) === vehicleId || v.label?.includes(vehicleId))
    const rsu = rsus.find(r => targetId?.includes(String(r.rsuId)) || `RSU_${r.rsuId}` === targetId)

    if (!vehicle || !rsu || vehicle.posX === null || vehicle.posY === null || rsu.posX === null || rsu.posY === null) return

    const isToRsu = type === 'metadata' || type === 'offload'

    const link: ActiveLink = {
      id: `${event.taskId}-${type}-${Date.now()}`,
      fromX: isToRsu ? vehicle.posX : rsu.posX,
      fromY: isToRsu ? vehicle.posY : rsu.posY,
      toX: isToRsu ? rsu.posX : vehicle.posX,
      toY: isToRsu ? rsu.posY : vehicle.posY,
      type,
      taskId: event.taskId,
      progress: 0,
      color: LINK_COLORS[type],
    }

    setActiveLinks(prev => [...prev, link])

    // Animate the link
    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      if (progress >= 100) {
        clearInterval(interval)
        setActiveLinks(prev => prev.filter(l => l.id !== link.id))
      } else {
        setActiveLinks(prev => prev.map(l => l.id === link.id ? { ...l, progress } : l))
      }
    }, 50)
  }, [vehicles, rsus])

  // Listen for task lifecycle events (fallback when props are empty)
  useEffect(() => {
    if (!socket || taskLifecycleEvents.length > 0) return // Skip if we have direct props

    const handleLifecycleEvent = (event: TaskLifecycleEvent) => {
      setLocalLifecycleEvents(prev => [...prev.slice(-500), event])

      // Create animated links based on event type (legacy approach)
      if (event.eventType === 'METADATA_SENT' && event.targetId) {
        createLink(event, 'metadata')
      } else if (event.eventType === 'OFFLOADING_DECISION_SENDING') {
        createLink(event, 'decision')
      } else if (event.eventType === 'TASK_OFFLOADING' && event.targetId) {
        createLink(event, 'offload')
      } else if (event.eventType === 'PROCESSING_COMPLETED' && event.targetId) {
        createLink(event, 'result')
      }
    }

    socket.on('task:lifecycle', handleLifecycleEvent)
    return () => { socket.off('task:lifecycle', handleLifecycleEvent) }
  }, [socket, createLink, taskLifecycleEvents.length])

  // Wheel handler for zoom - attached manually to support passive: false
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9

      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      setViewBox(prev => {
        const viewX = prev.x + (mouseX / rect.width) * prev.width
        const viewY = prev.y + (mouseY / rect.height) * prev.height

        const newWidth = prev.width * scaleFactor
        const newHeight = prev.height * scaleFactor

        return {
          x: viewX - (mouseX / rect.width) * newWidth,
          y: viewY - (mouseY / rect.height) * newHeight,
          width: newWidth,
          height: newHeight,
        }
      })
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return

    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const dx = (e.clientX - panStart.x) * (viewBox.width / rect.width)
    const dy = (e.clientY - panStart.y) * (viewBox.height / rect.height)

    setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }))
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Zoom controls
  const zoomIn = () => {
    setViewBox(prev => ({
      x: prev.x + prev.width * 0.1,
      y: prev.y + prev.height * 0.1,
      width: prev.width * 0.8,
      height: prev.height * 0.8,
    }))
  }

  const zoomOut = () => {
    setViewBox(prev => ({
      x: prev.x - prev.width * 0.125,
      y: prev.y - prev.height * 0.125,
      width: prev.width * 1.25,
      height: prev.height * 1.25,
    }))
  }

  const fitToView = () => {
    setViewBox({
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    })
  }

  // Entity click handler
  const handleEntityClick = (type: 'vehicle' | 'rsu', id: string) => {
    setSelectedEntity({ type, id })
    setDrawerOpen(true)
  }

  // Get selected entity data
  const selectedData = useMemo(() => {
    if (!selectedEntity) return null

    if (selectedEntity.type === 'vehicle') {
      return vehicles.find(v => String(v.vehId) === selectedEntity.id || v.label === selectedEntity.id)
    } else {
      return rsus.find(r => String(r.rsuId) === selectedEntity.id)
    }
  }, [selectedEntity, vehicles, rsus])

  // Get tasks for selected entity
  const entityTasks = useMemo(() => {
    if (!selectedEntity) return { local: [] as TaskLifecycleEvent[], offloaded: [] as TaskLifecycleEvent[], received: [] as TaskLifecycleEvent[] }

    const entityId = selectedEntity.id
    const relevantEvents = lifecycleEvents.filter(e =>
      e.vehicleId === entityId ||
      e.targetId?.includes(entityId) ||
      String(e.vehicleId) === entityId
    )

    const taskMap = new Map<string, { events: TaskLifecycleEvent[], isLocal: boolean, isOffloaded: boolean }>()

    relevantEvents.forEach(event => {
      if (!taskMap.has(event.taskId)) {
        taskMap.set(event.taskId, { events: [], isLocal: false, isOffloaded: false })
      }
      const task = taskMap.get(event.taskId)!
      task.events.push(event)

      if (event.eventType === 'DECISION_LOCAL' || event.decisionType === 'LOCAL') {
        task.isLocal = true
      }
      if (event.eventType === 'TASK_OFFLOADING' || event.decisionType === 'RSU' || event.decisionType === 'SERVICE_VEHICLE') {
        task.isOffloaded = true
      }
    })

    const local: TaskLifecycleEvent[] = []
    const offloaded: TaskLifecycleEvent[] = []
    const received: TaskLifecycleEvent[] = []

    taskMap.forEach((task) => {
      const latestEvent = task.events[task.events.length - 1]
      if (task.isLocal) {
        local.push(latestEvent)
      } else if (task.isOffloaded) {
        if (latestEvent.vehicleId === entityId || String(latestEvent.vehicleId) === entityId) {
          offloaded.push(latestEvent)
        } else {
          received.push(latestEvent)
        }
      }
    })

    return { local, offloaded, received }
  }, [selectedEntity, lifecycleEvents])

  if (loading) {
    return (
      <div className="simulation-map-container loading">
        <Spin size="large" tip="Loading simulation data..." />
      </div>
    )
  }

  return (
    <div className="simulation-map-container" ref={containerRef}>
      {/* Zoom Controls */}
      <div className="map-controls">
        <button onClick={zoomIn} title="Zoom In">+</button>
        <button onClick={zoomOut} title="Zoom Out">-</button>
        <button onClick={fitToView} title="Fit to View">&#8617;</button>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-icon vehicle-icon">🚗</span>
          <span>Vehicle ({vehicles.length})</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon rsu-icon">📡</span>
          <span>RSU ({rsus.length})</span>
        </div>
        <div className="legend-divider" />
        <div className="legend-item">
          <span className="legend-line" style={{ backgroundColor: LINK_COLORS.metadata }} />
          <span>Metadata</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ backgroundColor: LINK_COLORS.decision }} />
          <span>Decision</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ backgroundColor: LINK_COLORS.offload }} />
          <span>Offload</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ backgroundColor: LINK_COLORS.result }} />
          <span>Result</span>
        </div>
      </div>

      {/* Simulation Time Display */}
      <div className="sim-time-display">
        <span>Sim Time: {simTime.toFixed(2)}s</span>
        <span>Vehicles: {vehicles.length}</span>
        <span>RSUs: {rsus.length}</span>
        <span>Active Links: {activeLinks.length}</span>
        <span>Events: {lifecycleEvents.length}</span>
      </div>

      {/* SVG Map */}
      <svg
        ref={svgRef}
        className="simulation-map-svg"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background Grid */}
        <defs>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e0e0e0" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={bounds.minX - 1000} y={bounds.minY - 1000}
              width={bounds.maxX - bounds.minX + 2000}
              height={bounds.maxY - bounds.minY + 2000}
              fill="url(#grid)" />

        {/* Road Network */}
        {roadNetwork && (
          <g className="road-network">
            {/* Road Edges */}
            {roadNetwork.edges.map(edge => (
              edge.lanes.map(lane => {
                if (lane.points.length < 2) return null;

                // Create path from points
                const pathData = lane.points
                  .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
                  .join(' ');

                // Color based on speed
                const speedColor = lane.speed > 25 ? '#4a90e2' : lane.speed > 15 ? '#7cb342' : '#8e8e93';

                return (
                  <path
                    key={`${edge.id}-${lane.id}`}
                    d={pathData}
                    stroke={speedColor}
                    strokeWidth={lane.width}
                    fill="none"
                    opacity={0.6}
                    className="road-edge"
                    style={{
                      filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))'
                    }}
                  />
                );
              })
            ))}

            {/* Road Junctions */}
            {roadNetwork.junctions.map(junction => (
              <circle
                key={junction.id}
                cx={junction.x}
                cy={junction.y}
                r={junction.type === 'traffic_light' ? 8 : 4}
                fill={junction.type === 'traffic_light' ? '#ff6b6b' : '#666666'}
                stroke="#ffffff"
                strokeWidth="1"
                opacity={0.7}
                className="road-junction"
              />
            ))}
          </g>
        )}

        {/* RSU Coverage Areas */}
        {rsus.map(rsu => (
          rsu.posX !== null && rsu.posY !== null && (
            <circle
              key={`coverage-${rsu.rsuId}`}
              cx={rsu.posX}
              cy={rsu.posY}
              r={rsu.coverageRadiusM || 300}
              fill="rgba(24, 144, 255, 0.08)"
              stroke="rgba(24, 144, 255, 0.3)"
              strokeWidth="2"
              strokeDasharray="10,5"
            />
          )
        ))}

        {/* Active Communication Links */}
        {activeLinks.map(link => {
          const dx = link.toX - link.fromX
          const dy = link.toY - link.fromY
          const currentX = link.fromX + dx * (link.progress / 100)
          const currentY = link.fromY + dy * (link.progress / 100)

          return (
            <g key={link.id}>
              {/* Link line */}
              <line
                x1={link.fromX}
                y1={link.fromY}
                x2={currentX}
                y2={currentY}
                stroke={link.color}
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.8"
              />
              {/* Moving dot */}
              <circle
                cx={currentX}
                cy={currentY}
                r="8"
                fill={link.color}
              >
                <animate attributeName="r" values="6;10;6" dur="0.5s" repeatCount="indefinite" />
              </circle>
              {/* Label */}
              <text
                x={(link.fromX + currentX) / 2}
                y={(link.fromY + currentY) / 2 - 15}
                fill={link.color}
                fontSize="12"
                textAnchor="middle"
                fontWeight="bold"
              >
                {LINK_LABELS[link.type]}
              </text>
            </g>
          )
        })}

        {/* RSUs */}
        {rsus.map(rsu => (
          rsu.posX !== null && rsu.posY !== null && (
            <g
              key={`rsu-${rsu.rsuId}`}
              className="rsu-entity"
              transform={`translate(${rsu.posX}, ${rsu.posY})`}
              onClick={() => handleEntityClick('rsu', String(rsu.rsuId))}
              style={{ cursor: 'pointer' }}
            >
              {/* RSU Tower Icon */}
              <g transform="translate(-20, -35) scale(0.8)">
                {/* Base */}
                <rect x="15" y="45" width="20" height="25" fill="#1890ff" rx="2" />
                {/* Tower body */}
                <polygon points="25,5 10,45 40,45" fill="#1890ff" />
                {/* Antenna */}
                <line x1="25" y1="0" x2="25" y2="5" stroke="#1890ff" strokeWidth="3" />
                <circle cx="25" cy="0" r="4" fill="#52c41a">
                  <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                </circle>
                {/* Signal waves */}
                <path d="M 35,15 Q 45,25 35,35" stroke="#1890ff" fill="none" strokeWidth="2" opacity="0.6">
                  <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                </path>
                <path d="M 40,10 Q 55,25 40,40" stroke="#1890ff" fill="none" strokeWidth="2" opacity="0.4">
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                </path>
              </g>
              {/* Label */}
              <text
                y="40"
                textAnchor="middle"
                fill="#1890ff"
                fontSize="14"
                fontWeight="bold"
              >
                {rsu.label || `RSU-${rsu.rsuId}`}
              </text>
              {/* Processing indicator */}
              {rsu.latestMetric && typeof rsu.latestMetric.queueLength === 'number' && rsu.latestMetric.queueLength > 0 && (
                <circle cx="25" cy="-30" r="10" fill="#fa8c16">
                  <title>Queue: {rsu.latestMetric.queueLength}</title>
                </circle>
              )}
            </g>
          )
        ))}

        {/* Vehicles */}
        {vehicles.map(vehicle => (
          vehicle.posX !== null && vehicle.posY !== null && (
            <g
              key={`vehicle-${vehicle.vehId}`}
              className="vehicle-entity"
              transform={`translate(${vehicle.posX}, ${vehicle.posY}) rotate(${(vehicle.heading || 0)})`}
              onClick={() => handleEntityClick('vehicle', String(vehicle.vehId))}
              style={{ cursor: 'pointer' }}
            >
              {/* Car Icon */}
              <g transform="translate(-15, -10) scale(0.6)">
                {/* Car body */}
                <rect x="5" y="12" width="40" height="16" rx="3" fill="#52c41a" />
                {/* Car top */}
                <path d="M 12,12 L 18,4 L 32,4 L 38,12 Z" fill="#52c41a" />
                {/* Windows */}
                <path d="M 14,11 L 18,5 L 24,5 L 24,11 Z" fill="#a0d8a0" />
                <path d="M 26,11 L 26,5 L 32,5 L 36,11 Z" fill="#a0d8a0" />
                {/* Wheels */}
                <circle cx="13" cy="28" r="5" fill="#333" />
                <circle cx="37" cy="28" r="5" fill="#333" />
                {/* Headlights */}
                <rect x="42" y="15" width="4" height="4" rx="1" fill="#ffeb3b" />
                <rect x="42" y="21" width="4" height="4" rx="1" fill="#ffeb3b" />
              </g>
              {/* Label */}
              <text
                y="25"
                textAnchor="middle"
                fill="#333"
                fontSize="12"
                fontWeight="bold"
                transform={`rotate(${-(vehicle.heading || 0)})`}
              >
                V{vehicle.vehId}
              </text>
              {/* Task indicator */}
              {(() => {
                const payload = vehicle.payload as { processingCount?: number } | null
                const processingCount = payload?.processingCount
                return processingCount && processingCount > 0 ? (
                  <circle cx="15" cy="-15" r="8" fill="#fa8c16" transform={`rotate(${-(vehicle.heading || 0)})`}>
                    <title>Processing: {processingCount}</title>
                  </circle>
                ) : null
              })()}
            </g>
          )
        ))}
      </svg>

      {/* Entity Details Drawer */}
      <Drawer
        title={selectedEntity ? (
          <span>
            {selectedEntity.type === 'vehicle' ? '🚗 Vehicle ' : '📡 RSU '}
            {selectedEntity.id}
          </span>
        ) : 'Details'}
        placement="right"
        width={450}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {selectedData && selectedEntity?.type === 'vehicle' && (
          <VehicleDetails
            vehicle={selectedData as VehicleState}
            tasks={entityTasks}
          />
        )}
        {selectedData && selectedEntity?.type === 'rsu' && (
          <RsuDetails
            rsu={selectedData as RsuState}
            tasks={entityTasks}
          />
        )}
      </Drawer>
    </div>
  )
}

// Vehicle Details Component
function VehicleDetails({ vehicle, tasks }: {
  vehicle: VehicleState
  tasks: { local: TaskLifecycleEvent[], offloaded: TaskLifecycleEvent[], received: TaskLifecycleEvent[] }
}) {
  const payload = vehicle.payload as {
    cpuUtilization?: number
    memoryUtilization?: number
    queueLength?: number
    processingCount?: number
  } | null

  const cpuUtilization = (payload?.cpuUtilization || 0) * 100
  const memUtilization = (payload?.memoryUtilization || 0) * 100

  const cpuData = [
    { name: 'Used', value: cpuUtilization },
    { name: 'Free', value: 100 - cpuUtilization },
  ]

  const memData = [
    { name: 'Used', value: memUtilization },
    { name: 'Free', value: 100 - memUtilization },
  ]

  const COLORS = ['#fa8c16', '#52c41a']

  return (
    <div className="entity-details">
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Position X">{vehicle.posX?.toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label="Position Y">{vehicle.posY?.toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label="Speed">{vehicle.speed?.toFixed(2)} m/s</Descriptions.Item>
        <Descriptions.Item label="Heading">{vehicle.heading?.toFixed(1)}°</Descriptions.Item>
        <Descriptions.Item label="Queue">{payload?.queueLength || 0}</Descriptions.Item>
        <Descriptions.Item label="Processing">{payload?.processingCount || 0}</Descriptions.Item>
      </Descriptions>

      <div className="charts-container">
        <div className="chart-item">
          <h4>CPU Utilization</h4>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={cpuData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                label
              >
                {cpuData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Tag color="orange">Used: {cpuUtilization.toFixed(1)}%</Tag>
            <Tag color="green">Free: {(100 - cpuUtilization).toFixed(1)}%</Tag>
          </div>
        </div>

        <div className="chart-item">
          <h4>Memory Utilization</h4>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={memData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                label
              >
                {memData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Tag color="orange">Used: {memUtilization.toFixed(1)}%</Tag>
            <Tag color="green">Free: {(100 - memUtilization).toFixed(1)}%</Tag>
          </div>
        </div>
      </div>

      <Tabs
        defaultActiveKey="local"
        items={[
          {
            key: 'local',
            label: <span>Local Tasks <Tag color="blue">{tasks.local.length}</Tag></span>,
            children: (
              <TaskList tasks={tasks.local} type="local" />
            ),
          },
          {
            key: 'offloaded',
            label: <span>Offloaded <Tag color="orange">{tasks.offloaded.length}</Tag></span>,
            children: (
              <TaskList tasks={tasks.offloaded} type="offloaded" />
            ),
          },
        ]}
      />
    </div>
  )
}

// RSU Details Component
function RsuDetails({ rsu, tasks }: {
  rsu: RsuState
  tasks: { local: TaskLifecycleEvent[], offloaded: TaskLifecycleEvent[], received: TaskLifecycleEvent[] }
}) {
  const queueLength = rsu.latestMetric?.queueLength || 0

  const resourceData = [
    { name: 'CPU Available', value: rsu.latestMetric?.availableCpuCycles || 0 },
    { name: 'Memory', value: rsu.memoryMb || 0 },
    { name: 'Queue', value: queueLength },
  ]

  return (
    <div className="entity-details">
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Position X">{rsu.posX?.toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label="Position Y">{rsu.posY?.toFixed(2)}</Descriptions.Item>
        <Descriptions.Item label="Coverage">{rsu.coverageRadiusM} m</Descriptions.Item>
        <Descriptions.Item label="Queue Length">{queueLength}</Descriptions.Item>
        <Descriptions.Item label="CPU Available">{rsu.latestMetric?.availableCpuCycles?.toFixed(2)} GHz</Descriptions.Item>
        <Descriptions.Item label="Memory">{rsu.memoryMb?.toFixed(0)} MB</Descriptions.Item>
      </Descriptions>

      <div className="charts-container">
        <div className="chart-item full-width">
          <h4>RSU Resources</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={resourceData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1890ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs
        defaultActiveKey="received"
        items={[
          {
            key: 'received',
            label: <span>Received Tasks <Tag color="purple">{tasks.received.length}</Tag></span>,
            children: (
              <TaskList tasks={tasks.received} type="received" />
            ),
          },
        ]}
      />
    </div>
  )
}

// Task List Component
function TaskList({ tasks, type }: { tasks: TaskLifecycleEvent[], type: 'local' | 'offloaded' | 'received' }) {
  if (tasks.length === 0) {
    return <Empty description={`No ${type} tasks`} />
  }

  const getStatusColor = (eventType: string) => {
    if (eventType.includes('COMPLETE') || eventType.includes('SUCCESS')) return 'green'
    if (eventType.includes('FAIL')) return 'red'
    if (eventType.includes('PROCESSING')) return 'blue'
    return 'default'
  }

  return (
    <List
      size="small"
      dataSource={tasks.slice(-20)}
      renderItem={task => (
        <List.Item>
          <div className="task-item">
            <div className="task-id">{task.taskId.substring(0, 25)}...</div>
            <Tag color={getStatusColor(task.eventType)}>{task.eventType}</Tag>
            <div className="task-time">t={task.simTime.toFixed(3)}s</div>
          </div>
        </List.Item>
      )}
    />
  )
}

export default SimulationMap
