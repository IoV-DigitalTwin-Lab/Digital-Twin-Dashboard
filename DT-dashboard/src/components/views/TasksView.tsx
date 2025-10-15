import { Card, Col, List, Row, Space, Tag, Typography } from 'antd'
import type { TaskSummary } from '../../types/api'
import { TasksSummaryCard } from '../overview/cards/TasksSummaryCard'
import { TaskDeadlineChart } from '../overview/charts/TaskDeadlineChart'
import { TaskStatusPie } from '../overview/charts/TaskStatusPie'

interface TasksViewProps {
  tasks: TaskSummary[]
  loading: boolean
}

function statusTagColor(status: TaskSummary['status']) {
  switch (status) {
    case 'completed':
      return 'green'
    case 'executing':
      return 'blue'
    case 'assigned':
      return 'gold'
    case 'failed':
    case 'expired':
      return 'red'
    default:
      return 'default'
  }
}

export function TasksView({ tasks, loading }: TasksViewProps) {
  const topTasks = tasks.slice(0, 8)

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <TasksSummaryCard tasks={tasks} loading={loading} />
      </Col>
      <Col xs={24} lg={16}>
        <TaskDeadlineChart tasks={tasks} loading={loading} />
      </Col>
      <Col xs={24} lg={12}>
        <TaskStatusPie tasks={tasks} loading={loading} />
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Task Queue" loading={loading && topTasks.length === 0}>
          <List
            dataSource={topTasks}
            locale={{ emptyText: 'No active tasks' }}
            renderItem={(task) => (
              <List.Item key={task.taskId}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Typography.Text strong>{task.taskCode ?? `Task ${task.taskId}`}</Typography.Text>
                    <Tag color={statusTagColor(task.status)}>{task.status.toUpperCase()}</Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    Deadline: {task.deadlineSeconds !== null ? `${task.deadlineSeconds.toFixed(1)}s` : '—'} · CPU:{' '}
                    {task.cpuCyclesRequired.toLocaleString()} cycles · Assigned Vehicle:{' '}
                    {task.assignedVehicleId ?? '—'}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>
    </Row>
  )
}
