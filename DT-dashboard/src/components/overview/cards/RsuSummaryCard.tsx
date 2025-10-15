import { Card, Flex, Progress, Skeleton, Statistic, Tag } from 'antd'
import type { RsuState } from '../../../types/api'

interface RsuSummaryCardProps {
  rsus: RsuState[]
  loading: boolean
}

export function RsuSummaryCard({ rsus, loading }: RsuSummaryCardProps) {
  const activeRsuCount = rsus.length
  const avgCpu =
    rsus.length === 0
      ? null
      : rsus.reduce((sum, rsu) => sum + (rsu.latestMetric?.cpuUtilization ?? 0), 0) / rsus.length
  const alertsCount = rsus.reduce((sum, rsu) => sum + rsu.activeAlerts.length, 0)

  return (
    <Card title="RSU Performance" extra={<Tag color="purple">Edge Nodes</Tag>}>
      {loading && rsus.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Flex vertical gap={12}>
          <Statistic title="Active RSUs" value={activeRsuCount} />
          <Statistic
            title="Average CPU Utilization (%)"
            value={avgCpu !== null ? Math.round(avgCpu * 100) : '—'}
          />
          <div>
            <Statistic title="Active Alerts" value={alertsCount} />
            {avgCpu !== null && (
              <Progress
                percent={Math.min(Math.round(avgCpu * 100), 100)}
                size="small"
                strokeColor={avgCpu > 0.7 ? '#f5222d' : '#52c41a'}
                status={avgCpu > 0.8 ? 'exception' : 'active'}
              />
            )}
          </div>
        </Flex>
      )}
    </Card>
  )
}
