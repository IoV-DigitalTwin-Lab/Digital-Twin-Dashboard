import { Card, Col, Row, Skeleton, Typography } from 'antd'
import type { UseQueryResult } from '@tanstack/react-query'
import type { DashboardMetrics, DashboardSnapshot, RsuState, TaskSummary, VehicleState } from '../../types/api'
import { MetricsSummary } from './cards/MetricsSummary'
import { FleetSummaryCard } from './cards/FleetSummaryCard'
import { RsuSummaryCard } from './cards/RsuSummaryCard'
import { TasksSummaryCard } from './cards/TasksSummaryCard'
import { AlertsSummaryCard } from './cards/AlertsSummaryCard'
import { TaskDeadlineChart } from './charts/TaskDeadlineChart'
import { RsuPerformanceChart } from './charts/RsuPerformanceChart'
import { TaskStatusPie } from './charts/TaskStatusPie'
import { VehicleTable } from './tables/VehicleTable'
import { FleetMapCard } from './map'

interface OverviewGridProps {
  queries: {
    vehiclesQuery: UseQueryResult<VehicleState[]>
    rsusQuery: UseQueryResult<RsuState[]>
    tasksQuery: UseQueryResult<TaskSummary[]>
    metricsQuery: UseQueryResult<DashboardMetrics>
  }
  socketSnapshot: DashboardSnapshot | null
}

export function OverviewGrid({ queries, socketSnapshot }: OverviewGridProps) {
  const { vehiclesQuery, rsusQuery, tasksQuery, metricsQuery } = queries

  const loading =
    vehiclesQuery.isFetching ||
    rsusQuery.isFetching ||
    tasksQuery.isFetching ||
    metricsQuery.isFetching

  const metrics = socketSnapshot?.metrics ?? metricsQuery.data
  const vehicles = socketSnapshot?.vehicles ?? vehiclesQuery.data ?? []
  const rsus = socketSnapshot?.rsus ?? rsusQuery.data ?? []
  const tasks = socketSnapshot?.tasks ?? tasksQuery.data ?? []

  if (!metrics && loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  return (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          Network Overview
        </Typography.Title>
        <Typography.Text type="secondary">
          Live view of task offloading, fleet state, and edge infrastructure performance
        </Typography.Text>
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <MetricsSummary metrics={metrics} loading={loading} />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <FleetSummaryCard vehicles={vehicles} loading={loading} />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <RsuSummaryCard rsus={rsus} loading={loading} />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <TasksSummaryCard tasks={tasks} loading={loading} />
          </Col>
        </Row>
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <TaskDeadlineChart tasks={tasks} loading={loading} />
          </Col>
          <Col xs={24} lg={12}>
            <RsuPerformanceChart rsus={rsus} loading={loading} />
          </Col>
        </Row>
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <TaskStatusPie tasks={tasks} loading={loading} />
          </Col>
          <Col xs={24} md={12}>
            <VehicleTable vehicles={vehicles} loading={loading} />
          </Col>
        </Row>
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <FleetMapCard vehicles={vehicles} rsus={rsus} loading={loading} />
          </Col>
          <Col xs={24} xl={10}>
            <Card style={{ minHeight: 360 }}>
              <AlertsSummaryCard
                vehicles={vehicles}
                rsus={rsus}
                tasks={tasks}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>
      </Col>
    </Row>
  )
}
