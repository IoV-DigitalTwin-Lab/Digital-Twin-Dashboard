import { Card, Flex, Skeleton, Statistic, Tag } from 'antd'
import type { TaskSummary } from '../../../types/api'

interface TasksSummaryCardProps {
  tasks: TaskSummary[]
  loading: boolean
}

export function TasksSummaryCard({ tasks, loading }: TasksSummaryCardProps) {
  const activeTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'assigned' || task.status === 'executing')
  const completedTasks = tasks.filter((task) => task.status === 'completed')
  const criticalTasks = tasks
  .filter((task) => task.deadlineSeconds !== null && task.deadlineSeconds < 180)
    .sort((a, b) => (a.deadlineSeconds ?? 0) - (b.deadlineSeconds ?? 0))
    .slice(0, 3)

  return (
    <Card title="Task Pipeline" extra={<Tag color="gold">Tasks</Tag>}>
      {loading && tasks.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Flex vertical gap={12}>
          <Statistic title="Active Tasks" value={activeTasks.length} />
          <Statistic title="Completed Tasks" value={completedTasks.length} />
          {criticalTasks.length > 0 && (
            <div>
              <Statistic title="Upcoming Deadlines" value={criticalTasks.length} />
              <Flex vertical gap={4} style={{ marginTop: 8 }}>
                {criticalTasks.map((task) => (
                  <Tag key={task.taskId} color="volcano">
                    #{task.taskId} · due in {task.deadlineSeconds?.toFixed(0)} s · {task.status}
                  </Tag>
                ))}
              </Flex>
            </div>
          )}
        </Flex>
      )}
    </Card>
  )
}
