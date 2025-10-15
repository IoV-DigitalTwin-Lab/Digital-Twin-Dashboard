import { Card, Flex, Progress, Skeleton, Statistic, Tag } from 'antd'
import type { VehicleState } from '../../../types/api'

interface FleetSummaryCardProps {
  vehicles: VehicleState[]
  loading: boolean
}

export function FleetSummaryCard({ vehicles, loading }: FleetSummaryCardProps) {
  const activeVehicles = vehicles.length
  const avgSpeed =
    vehicles.length === 0 ? null : vehicles.reduce((sum, v) => sum + (v.speed ?? 0), 0) / vehicles.length
  const avgTaskLoad =
    vehicles.length === 0
      ? null
      : vehicles.reduce((sum, v) => sum + v.activeTasks.length, 0) / vehicles.length

  return (
    <Card title="Fleet Snapshot" extra={<Tag color="blue">Vehicles</Tag>}>
      {loading && vehicles.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Flex vertical gap={12}>
          <Statistic title="Connected Vehicles" value={activeVehicles} />
          <Statistic
            title="Average Speed (m/s)"
            value={avgSpeed !== null ? avgSpeed.toFixed(2) : '—'}
          />
          <div>
            <Statistic title="Average Task Load" value={avgTaskLoad !== null ? avgTaskLoad.toFixed(1) : '—'} />
            {avgTaskLoad !== null && (
              <Progress
                percent={Math.min(Math.round((avgTaskLoad / 3) * 100), 100)}
                size="small"
                status="active"
                strokeColor="#1677ff"
              />
            )}
          </div>
        </Flex>
      )}
    </Card>
  )
}
