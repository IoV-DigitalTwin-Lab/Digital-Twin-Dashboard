import { Empty, Flex, List, Skeleton, Space, Tag, Typography } from 'antd'
import type { RsuState, TaskSummary, VehicleState } from '../../../types/api'

interface AlertsSummaryCardProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  tasks: TaskSummary[]
  loading: boolean
}

interface AlertRow {
  key: string
  type: 'vehicle' | 'rsu' | 'task'
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
}

function normalizeAlerts(vehicles: VehicleState[], rsus: RsuState[]): AlertRow[] {
  const vehicleAlerts: AlertRow[] = vehicles.flatMap((vehicle) =>
    vehicle.alerts.map((alert) => ({
      key: `vehicle-${alert.alertId}`,
      type: 'vehicle',
      title: vehicle.label ?? `Vehicle ${vehicle.vehId}`,
      message: alert.message,
      severity: alert.severity,
      timestamp: alert.triggeredAt,
    })),
  )

  const rsuAlerts: AlertRow[] = rsus.flatMap((rsu) =>
    rsu.activeAlerts.map((alert) => ({
      key: `rsu-${alert.alertId}`,
      type: 'rsu',
      title: rsu.label,
      message: alert.message,
      severity: alert.severity,
      timestamp: alert.triggeredAt,
    })),
  )

  return [...vehicleAlerts, ...rsuAlerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function severityColor(severity: AlertRow['severity']) {
  switch (severity) {
    case 'critical':
      return 'red'
    case 'warning':
      return 'orange'
    default:
      return 'blue'
  }
}

export function AlertsSummaryCard({ vehicles, rsus, loading }: AlertsSummaryCardProps) {
  const alerts = normalizeAlerts(vehicles, rsus)

  if (loading && alerts.length === 0) {
    return <Skeleton active paragraph={{ rows: 4 }} />
  }

  if (alerts.length === 0) {
    return <Empty description="No active alerts" />
  }

  return (
    <List
      dataSource={alerts}
      renderItem={(item) => (
        <List.Item key={item.key} style={{ alignItems: 'flex-start' }}>
          <Space align="start" style={{ width: '100%' }}>
            <Tag color={severityColor(item.severity)}>{item.severity.toUpperCase()}</Tag>
            <Flex vertical style={{ flex: 1 }}>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Typography.Text type="secondary">{new Date(item.timestamp).toLocaleString()}</Typography.Text>
              <Typography.Paragraph style={{ marginBottom: 0 }}>{item.message}</Typography.Paragraph>
            </Flex>
          </Space>
        </List.Item>
      )}
    />
  )
}
