import { Card, Empty, Skeleton } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TaskSummary } from '../../../types/api'

interface TaskDeadlineChartProps {
  tasks: TaskSummary[]
  loading: boolean
}

function toChartData(tasks: TaskSummary[]) {
  return tasks
    .filter((task) => task.deadlineSeconds !== null)
    .filter((task) => ['pending', 'assigned', 'executing'].includes(task.status))
    .sort((a, b) => (a.deadlineSeconds ?? 0) - (b.deadlineSeconds ?? 0))
    .map((task) => ({
      id: `#${task.taskId}`,
      deadline: Math.max(task.deadlineSeconds ?? 0, 0),
      status: task.status,
    }))
}

export function TaskDeadlineChart({ tasks, loading }: TaskDeadlineChartProps) {
  const data = toChartData(tasks)

  if (loading && data.length === 0) {
    return (
      <Card title="Deadline Horizon">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card title="Deadline Horizon">
        <Empty description="No active task deadlines" />
      </Card>
    )
  }

  return (
    <Card title="Deadline Horizon" extra="seconds remaining">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="id" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, _name, payload) => [`${value.toFixed(0)} s`, payload?.payload?.status]}
            cursor={{ fill: 'rgba(22,119,255,0.08)' }}
          />
          <Bar dataKey="deadline" radius={[4, 4, 0, 0]} fill="#1677ff">
            <LabelList
              dataKey="deadline"
              position="top"
              formatter={(label) => (typeof label === 'number' ? `${label.toFixed(0)}s` : label)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
