import type { ReactNode } from 'react'
import { Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  AlertOutlined,
  AreaChartOutlined,
  CarOutlined,
  ClusterOutlined,
  RadarChartOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useDashboardData } from '../../hooks/useDashboardData'
import { OverviewGrid } from '../overview/OverviewGrid'
import { AlertsView, FleetView, RsuView, TasksView } from '../views/index'

const { Sider, Content: AntContent } = Layout

const menuItems: MenuProps['items'] = [
  {
    key: 'overview',
    icon: <AreaChartOutlined />,
    label: 'Overview',
  },
  {
    key: 'fleet',
    icon: <CarOutlined />,
    label: 'Fleet',
  },
  {
    key: 'rsus',
    icon: <ClusterOutlined />,
    label: 'RSUs',
  },
  {
    key: 'tasks',
    icon: <RadarChartOutlined />,
    label: 'Tasks',
  },
  {
    key: 'alerts',
    icon: <AlertOutlined />,
    label: 'Alerts',
  },
]

function DashboardHeader() {
  const { socketStatus } = useDashboardData()

  return (
    <Space align="center" size={16} style={{ height: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Task Offloading Digital Twin
      </Typography.Title>
      <Tag
        color={socketStatus === 'connected' ? 'green' : socketStatus === 'connecting' ? 'gold' : 'volcano'}
      >
        Socket {socketStatus}
      </Tag>
    </Space>
  )
}

interface DashboardSidebarProps {
  activeKey: string
  onSelect: (key: string) => void
}

function DashboardSidebar({ activeKey, onSelect }: DashboardSidebarProps) {
  return (
    <Sider width={220} theme="light" style={{ background: '#ffffff' }}>
      <div style={{ padding: '16px 16px 8px' }}>
        <Typography.Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Navigation
        </Typography.Text>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[activeKey]}
        items={menuItems}
        style={{ borderInlineEnd: 'none' }}
        onClick={({ key }) => onSelect(String(key))}
      />
    </Sider>
  )
}

interface DashboardContentProps {
  activeKey: string
}

function DashboardContent({ activeKey }: DashboardContentProps) {
  const { vehiclesQuery, rsusQuery, tasksQuery, metricsQuery, socketSnapshot } = useDashboardData()

  return (
    <AntContent style={{ background: 'transparent' }}>
      {(() => {
        const loading =
          vehiclesQuery.isFetching ||
          rsusQuery.isFetching ||
          tasksQuery.isFetching ||
          metricsQuery.isFetching

        const vehicles = socketSnapshot?.vehicles ?? vehiclesQuery.data ?? []
        const rsus = socketSnapshot?.rsus ?? rsusQuery.data ?? []
        const tasks = socketSnapshot?.tasks ?? tasksQuery.data ?? []

        let view: ReactNode

        switch (activeKey) {
          case 'fleet':
            view = <FleetView vehicles={vehicles} rsus={rsus} loading={loading} />
            break
          case 'rsus':
            view = <RsuView rsus={rsus} vehicles={vehicles} tasks={tasks} loading={loading} />
            break
          case 'tasks':
            view = <TasksView tasks={tasks} loading={loading} />
            break
          case 'alerts':
            view = <AlertsView vehicles={vehicles} rsus={rsus} tasks={tasks} loading={loading} />
            break
          default:
            view = (
              <OverviewGrid
                queries={{ vehiclesQuery, rsusQuery, tasksQuery, metricsQuery }}
                socketSnapshot={socketSnapshot}
              />
            )
            break
        }

        return view
      })()}
    </AntContent>
  )
}

export const DashboardLayout = {
  Header: DashboardHeader,
  Sidebar: DashboardSidebar,
  Content: DashboardContent,
}
