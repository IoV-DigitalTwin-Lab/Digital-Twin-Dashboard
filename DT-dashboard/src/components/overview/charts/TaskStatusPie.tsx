import { Card, Empty, Skeleton } from 'antd'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TaskSummary } from '../../../types/api'

interface TaskStatusPieProps {
  tasks: TaskSummary[]
  loading: boolean
}

const STATUS_COLORS: Record<TaskSummary['status'], string> = {
  pending: '#faad14',
  assigned: '#13c2c2',
  executing: '#1677ff',
  completed: '#52c41a',
  failed: '#f5222d',
  expired: '#595959',
}

function toChartData(tasks: TaskSummary[]) {
  const grouped = new Map<TaskSummary['status'], number>()

  for (const task of tasks) {
    grouped.set(task.status, (grouped.get(task.status) ?? 0) + 1)
  }

  return Array.from(grouped.entries()).map(([status, value]) => ({ status, value }))
}

export function TaskStatusPie({ tasks, loading }: TaskStatusPieProps) {
  const data = toChartData(tasks)

  if (loading && data.length === 0) {
    return (
      <Card title="Task Status Distribution">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card title="Task Status Distribution">
        <Empty description="No task data" />
      </Card>
    )
  }

  return (
    <Card title="Task Status Distribution">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [value, name]} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}
