import type { ColumnsType } from 'antd/es/table'
import { Card, Table, Tag, Tooltip } from 'antd'
import type { VehicleState } from '../../../types/api'

interface VehicleTableProps {
  vehicles: VehicleState[]
  loading: boolean
}

const columns: ColumnsType<VehicleState> = [
  {
    title: 'Vehicle',
    dataIndex: 'label',
    key: 'label',
    render: (_value, record) => record.label ?? `Vehicle ${record.vehId}`,
  },
  {
    title: 'Speed (m/s)',
    dataIndex: 'speed',
    key: 'speed',
    render: (value) => (value !== null && value !== undefined ? value.toFixed(2) : '—'),
  },
  {
    title: 'Task Load',
    dataIndex: 'activeTasks',
    key: 'activeTasks',
    render: (_value, record) => record.activeTasks.length,
  },
  {
    title: 'CPU Capacity (MIPS)',
    dataIndex: 'cpuCapacityMips',
    key: 'cpuCapacityMips',
    render: (value) => (value !== null && value !== undefined ? value.toLocaleString() : '—'),
  },
  {
    title: 'Updated',
    dataIndex: 'receivedAt',
    key: 'receivedAt',
    render: (value) => (value ? new Date(value).toLocaleTimeString() : '—'),
  },
  {
    title: 'Alerts',
    key: 'alerts',
    render: (_value, record) => (
      <Tooltip
        title={
          record.alerts.length > 0
            ? record.alerts.map((alert) => `${alert.severity.toUpperCase()}: ${alert.message}`).join('\n')
            : 'No active alerts'
        }
      >
        <Tag color={record.alerts.length > 0 ? 'volcano' : 'default'}>{record.alerts.length}</Tag>
      </Tooltip>
    ),
  },
]

export function VehicleTable({ vehicles, loading }: VehicleTableProps) {
  return (
    <Card title="Vehicle Telemetry" style={{ minHeight: 360 }}>
      <Table
        columns={columns}
        dataSource={vehicles.map((vehicle) => ({ ...vehicle, key: vehicle.vehId }))}
        loading={loading}
        pagination={{ pageSize: 5 }}
        size="middle"
      />
    </Card>
  )
}
