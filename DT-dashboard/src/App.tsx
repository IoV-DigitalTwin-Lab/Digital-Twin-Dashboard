import { ConfigProvider, Layout, Space, Tag, Typography, theme } from 'antd'
import { useDashboardData } from './hooks/useDashboardData'
import { SimulationMap } from './components/map/SimulationMap'

const { Header, Content } = Layout
const { defaultAlgorithm } = theme

function DashboardHeader() {
  const { socketStatus, simulationState } = useDashboardData()

  return (
    <Space align="center" size={16} style={{ height: '100%', width: '100%', justifyContent: 'space-between' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        IoV Digital Twin - Task Offloading Visualization
      </Typography.Title>
      <Space>
        {simulationState.running && (
          <Tag color="blue">
            Sim: {simulationState.simTime.toFixed(2)}s
          </Tag>
        )}
        <Tag
          color={socketStatus === 'connected' ? 'green' : socketStatus === 'connecting' ? 'gold' : 'volcano'}
        >
          {socketStatus === 'connected' ? '🟢' : socketStatus === 'connecting' ? '🟡' : '🔴'} Socket {socketStatus}
        </Tag>
      </Space>
    </Space>
  )
}

export function App() {
  const {
    vehiclesQuery,
    rsusQuery,
    socketSnapshot,
    getVehicles,
    getRsus,
    taskLifecycleEvents,
    activeTaskCommunications,
    simulationState,
    roadNetwork,
  } = useDashboardData()

  const loading = vehiclesQuery.isFetching || rsusQuery.isFetching

  // Prefer direct simulation data, fallback to Redis polling
  const vehicles = getVehicles().length > 0 ? getVehicles() : (socketSnapshot?.vehicles ?? vehiclesQuery.data ?? [])
  const rsus = getRsus().length > 0 ? getRsus() : (socketSnapshot?.rsus ?? rsusQuery.data ?? [])

  return (
    <ConfigProvider
      theme={{
        algorithm: defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorBgLayout: '#f5f7fb',
          colorBgContainer: '#ffffff',
          colorText: '#0f172a',
          borderRadius: 8,
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ padding: '0 24px', borderBottom: '1px solid #e8e8e8' }}>
          <DashboardHeader />
        </Header>
        <Content style={{ padding: '16px' }}>
          <SimulationMap
            vehicles={vehicles}
            rsus={rsus}
            loading={loading}
            taskLifecycleEvents={taskLifecycleEvents}
            activeTaskCommunications={activeTaskCommunications}
            simTime={simulationState.simTime}
            roadNetwork={roadNetwork}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default App
