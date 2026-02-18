import { Card, Empty, Skeleton, Space, Tag, Typography } from 'antd'
import type { RsuState, VehicleState } from '../../../types/api'

const MAP_BOUNDS = {
  minX: 0,
  maxX: 2700,
  minY: 0,
  maxY: 3100,
}

const MAP_WIDTH = MAP_BOUNDS.maxX - MAP_BOUNDS.minX
const MAP_HEIGHT = MAP_BOUNDS.maxY - MAP_BOUNDS.minY

function toCanvasCoords(x: number | null, y: number | null) {
  if (x === null || y === null) {
    return null
  }

  const normalizedX = (x - MAP_BOUNDS.minX) / MAP_WIDTH
  const normalizedY = 1 - (y - MAP_BOUNDS.minY) / MAP_HEIGHT

  return {
    x: normalizedX,
    y: normalizedY,
  }
}

const GRID_LINES = Array.from({ length: 7 }, (_, index) => index / 6)

interface FleetMapCardProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  loading: boolean
}

export function FleetMapCard({ vehicles, rsus, loading }: FleetMapCardProps) {
  const validVehicles = vehicles.filter((vehicle) => vehicle.posX !== null && vehicle.posY !== null)
  const validRsus = rsus.filter((rsu) => rsu.posX !== null && rsu.posY !== null)

  const hasData = validVehicles.length > 0 || validRsus.length > 0

  return (
    <Card
      title="Fleet Map"
      extra={
        <Space size={8}>
          <Tag color="#1677ff">Vehicles</Tag>
          <Tag color="#722ed1">RSUs</Tag>
        </Space>
      }
    >
      {loading && !hasData ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !hasData ? (
        <Empty description="No positional data" />
      ) : (
        <div style={{ width: '100%', height: 360 }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="100" height="100" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
            {GRID_LINES.map((position) => (
              <line
                key={`v-${position}`}
                x1={position * 100}
                y1={0}
                x2={position * 100}
                y2={100}
                stroke="#e2e8f0"
                strokeWidth="0.5"
              />
            ))}
            {GRID_LINES.map((position) => (
              <line
                key={`h-${position}`}
                x1={0}
                y1={position * 100}
                x2={100}
                y2={position * 100}
                stroke="#e2e8f0"
                strokeWidth="0.5"
              />
            ))}

            {validRsus.map((rsu) => {
              const coords = toCanvasCoords(rsu.posX, rsu.posY)
              if (!coords) return null

              const coverage = rsu.coverageRadiusM ?? 0
              const coveragePercent = Math.min(Math.max(coverage / MAP_WIDTH, 0), 1) * 100

              return (
                <g key={`rsu-${rsu.rsuId}`}>
                  <circle
                    cx={coords.x * 100}
                    cy={coords.y * 100}
                    r={coveragePercent}
                    fill="rgba(114, 46, 209, 0.08)"
                    stroke="rgba(114, 46, 209, 0.35)"
                    strokeWidth="0.6"
                  />
                  <circle
                    cx={coords.x * 100}
                    cy={coords.y * 100}
                    r={2.2}
                    fill="#722ed1"
                    stroke="#fff"
                    strokeWidth="0.6"
                  />
                  <text
                    x={coords.x * 100 + 2.6}
                    y={coords.y * 100 - 2}
                    fontSize={3}
                    fill="#45208f"
                  >
                    {rsu.label}
                  </text>
                </g>
              )
            })}

            {validVehicles.map((vehicle) => {
              const coords = toCanvasCoords(vehicle.posX, vehicle.posY)
              if (!coords) return null

              return (
                <g key={`veh-${vehicle.vehId}`}>
                  <circle
                    cx={coords.x * 100}
                    cy={coords.y * 100}
                    r={1.8}
                    fill="#1677ff"
                    stroke="#ffffff"
                    strokeWidth="0.5"
                  />
                  <text
                    x={coords.x * 100 + 2.2}
                    y={coords.y * 100 + 1}
                    fontSize={2.6}
                    fill="#0f172a"
                  >
                    {vehicle.label ?? `V${vehicle.vehId}`}
                  </text>
                </g>
              )
            })}
          </svg>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Coordinates normalized using Erlangen map bounds (0,0) to (2700,3100). Coverage circles are illustrative rather than scale-accurate.
          </Typography.Text>
        </div>
      )}
    </Card>
  )
}
