import { Card, Col, Row } from 'antd'
import type { RsuState, TaskSummary, VehicleState } from '../../types/api'
import { RsuSummaryCard } from '../overview/cards/RsuSummaryCard'
import { RsuPerformanceChart } from '../overview/charts/RsuPerformanceChart'
import { AlertsSummaryCard } from '../overview/cards/AlertsSummaryCard'

interface RsuViewProps {
  rsus: RsuState[]
  vehicles: VehicleState[]
  tasks: TaskSummary[]
  loading: boolean
}

export function RsuView({ rsus, vehicles, tasks, loading }: RsuViewProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <RsuSummaryCard rsus={rsus} loading={loading} />
      </Col>
      <Col xs={24} lg={16}>
        <RsuPerformanceChart rsus={rsus} loading={loading} />
      </Col>
      <Col span={24}>
        <Card title="Active Alerts" style={{ minHeight: 360 }}>
          <AlertsSummaryCard vehicles={vehicles} rsus={rsus} tasks={tasks} loading={loading} />
        </Card>
      </Col>
    </Row>
  )
}
