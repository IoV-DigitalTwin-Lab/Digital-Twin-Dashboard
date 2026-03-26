import { useState } from 'react'
import { ConfigProvider, Layout, theme } from 'antd'
import { Content, Footer, Header } from 'antd/es/layout/layout'
import { DashboardLayout } from './components/layout/DashboardLayout'

const { defaultAlgorithm } = theme

export function App() {
  const [activeView, setActiveView] = useState('overview')

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
        <Header style={{ padding: '0 24px' }}>
          <DashboardLayout.Header />
        </Header>
        <Layout>
          <DashboardLayout.Sidebar activeKey={activeView} onSelect={setActiveView} />
          <Layout style={{ padding: '24px 32px 32px' }}>
            <Content>
              <DashboardLayout.Content activeKey={activeView} />
            </Content>
            <Footer style={{ textAlign: 'center', padding: '24px 0 0' }}>
              Digital Twin Dashboard © {new Date().getFullYear()} Group 22
            </Footer>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App
