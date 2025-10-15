import { Card, Empty, Skeleton } from 'antd'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RsuState } from '../../../types/api'

interface RsuPerformanceChartProps {
  rsus: RsuState[]
  loading: boolean
}

function toChartData(rsus: RsuState[]) {
  return rsus.map((rsu) => ({
    label: rsu.label,
    cpu: rsu.latestMetric ? Math.round((rsu.latestMetric.cpuUtilization ?? 0) * 100) : 0,
    connections: rsu.latestMetric?.connectedVehicleCount ?? 0,
  }))
}

export function RsuPerformanceChart({ rsus, loading }: RsuPerformanceChartProps) {
  const data = toChartData(rsus)

  if (loading && data.length === 0) {
    return (
      <Card title="RSU Performance">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card title="RSU Performance">
        <Empty description="No RSU metrics available" />
      </Card>
    )
  }

  return (
    <Card title="RSU Performance" extra="CPU % vs connections">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={[0, 100]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="cpu" stroke="#1677ff" strokeWidth={2} dot />
          <Line yAxisId="right" type="monotone" dataKey="connections" stroke="#52c41a" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
