import { Card, Flex, Skeleton, Statistic, Tooltip } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import type { DashboardMetrics } from '../../../types/api'

interface MetricsSummaryProps {
  metrics: DashboardMetrics | undefined
  loading: boolean
}

export function MetricsSummary({ metrics, loading }: MetricsSummaryProps) {
  return (
    <Card
      title="KPI Overview"
      actions={[
        <Tooltip key="refresh" title="Auto-refreshes from socket snapshots and REST fallback">
          <ThunderboltOutlined />
        </Tooltip>,
      ]}
    >
      {loading && !metrics ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Flex vertical gap={12}>
          <Statistic
            title="Active Vehicles"
            value={metrics?.activeVehicleCount ?? 0}
          />
          <Statistic
            title="Average Speed (m/s)"
            value={metrics?.averageVehicleSpeed ? metrics.averageVehicleSpeed.toFixed(2) : '—'}
          />
          <Statistic
            title="Active Tasks"
            value={metrics?.activeTaskCount ?? 0}
          />
          <Statistic
            title="RSU CPU Utilization (%)"
            value={
              metrics?.averageRsuCpuUtilization !== null && metrics?.averageRsuCpuUtilization !== undefined
                ? Math.round(metrics.averageRsuCpuUtilization * 100)
                : '—'
            }
          />
        </Flex>
      )}
    </Card>
  )
}
