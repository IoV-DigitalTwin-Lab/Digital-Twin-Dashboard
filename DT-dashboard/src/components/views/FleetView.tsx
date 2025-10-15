import { Col, Row } from 'antd'
import type { RsuState, VehicleState } from '../../types/api'
import { FleetSummaryCard } from '../overview/cards/FleetSummaryCard'
import { FleetMapCard } from '../overview/map'
import { VehicleTable } from '../overview/tables/VehicleTable'

interface FleetViewProps {
  vehicles: VehicleState[]
  rsus: RsuState[]
  loading: boolean
}

export function FleetView({ vehicles, rsus, loading }: FleetViewProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <FleetSummaryCard vehicles={vehicles} loading={loading} />
      </Col>
      <Col xs={24} lg={16}>
        <FleetMapCard vehicles={vehicles} rsus={rsus} loading={loading} />
      </Col>
      <Col span={24}>
        <VehicleTable vehicles={vehicles} loading={loading} />
      </Col>
    </Row>
  )
}
