import { Card, Col, Row, Statistic } from 'antd'
import type { RsuState, TaskSummary, VehicleState } from '../../types/api'
import { AlertsSummaryCard } from '../overview/cards/AlertsSummaryCard'

interface AlertsViewProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  tasks: TaskSummary[]
  loading: boolean
}

function collectAlertCounts(vehicles: VehicleState[], rsus: RsuState[]) {
  const vehicleAlerts = vehicles.flatMap((vehicle) => vehicle.alerts)
  const rsuAlerts = rsus.flatMap((rsu) => rsu.activeAlerts)
  const allAlerts = [...vehicleAlerts, ...rsuAlerts]

  return {
    total: allAlerts.length,
    critical: allAlerts.filter((alert) => alert.severity === 'critical').length,
    warning: allAlerts.filter((alert) => alert.severity === 'warning').length,
    info: allAlerts.filter((alert) => alert.severity === 'info').length,
  }
}

export function AlertsView({ vehicles, rsus, tasks, loading }: AlertsViewProps) {
  const counts = collectAlertCounts(vehicles, rsus)

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card title="Alert Breakdown" loading={loading && counts.total === 0}>
          <Statistic title="Total Active" value={counts.total} />
          <Statistic title="Critical" value={counts.critical} />
          <Statistic title="Warning" value={counts.warning} />
          <Statistic title="Info" value={counts.info} />
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card title="Active Alerts" style={{ minHeight: 360 }}>
          <AlertsSummaryCard vehicles={vehicles} rsus={rsus} tasks={tasks} loading={loading} />
        </Card>
      </Col>
    </Row>
  )
}
