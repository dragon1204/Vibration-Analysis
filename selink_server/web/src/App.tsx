import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, Drawer, Grid, Layout, Menu, Spin, Space, Typography, Dropdown } from 'antd'
import {
  DashboardOutlined, AlertOutlined, ApiOutlined, SettingOutlined, FileTextOutlined, ExperimentOutlined,
  MenuOutlined, UserOutlined, LogoutOutlined, ThunderboltFilled, ClockCircleOutlined,
} from '@ant-design/icons'
import { useAuth } from './auth'
import { logout } from './api/client'
import Login from './pages/Login'

const Overview = lazy(() => import('./pages/Overview'))
const Live = lazy(() => import('./pages/Live'))
const Diagnosis = lazy(() => import('./pages/Diagnosis'))
const MachineDetail = lazy(() => import('./pages/MachineDetail'))
const Trends = lazy(() => import('./pages/Trends'))
const Spectrum = lazy(() => import('./pages/Spectrum'))
const Events = lazy(() => import('./pages/Events'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const Accuracy = lazy(() => import('./pages/Accuracy'))
const Reports = lazy(() => import('./pages/Reports'))
const Devices = lazy(() => import('./pages/Devices'))
const Settings = lazy(() => import('./pages/Settings'))

const MENU = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/events', icon: <AlertOutlined />, label: 'Cảnh báo' },
  { key: '/accuracy', icon: <ExperimentOutlined />, label: 'Kiểm chứng sai số' },
  { key: '/reports', icon: <FileTextOutlined />, label: 'Báo cáo' },
  { key: '/devices', icon: <ApiOutlined />, label: 'Thiết bị' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
]

export default function App() {
  const { ready, loggedIn, me } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const screens = Grid.useBreakpoint()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!ready) return <Spin style={{ marginTop: '40vh', width: '100%' }} size="large" />
  if (!loggedIn) return <Login />
  const selected = MENU.find((m) => m.key !== '/' && loc.pathname.startsWith(m.key))?.key || '/'
  const menu = (
    <Menu className="app-menu" theme="dark" mode="inline" selectedKeys={[selected]} items={MENU}
      onClick={(e) => { nav(e.key); setOpen(false) }} />
  )
  return (
    <Layout className="app-shell">
      {screens.md ? (
        <Layout.Sider className="app-sidebar" collapsible breakpoint="lg" width={236} collapsedWidth={76}>
          <div className="brand"><div className="brand-mark"><ThunderboltFilled /></div><div><div className="brand-title">SMART MOTOR</div><div className="brand-subtitle">Predictive care</div></div></div>
          {menu}
          <div className="sidebar-health"><strong><span className="pulse-dot" />Hệ thống đang hoạt động</strong>Edge & cloud monitoring</div>
        </Layout.Sider>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)} placement="left" width={230}
          styles={{ body: { padding: 0, background: '#07111f' } }}>
          <div className="brand"><div className="brand-mark"><ThunderboltFilled /></div><div><div className="brand-title">SMART MOTOR</div><div className="brand-subtitle">Predictive care</div></div></div>
          {menu}
        </Drawer>
      )}
      <Layout>
        <Layout.Header className="app-header">
          {!screens.md && <Button icon={<MenuOutlined />} onClick={() => setOpen(true)} />}
          <div className="header-copy"><div className="header-eyebrow">Trung tâm vận hành</div><div className="header-title">Giám sát & chẩn đoán rung động cơ</div></div>
          <div className="header-clock hide-mobile"><ClockCircleOutlined /> {now.toLocaleTimeString('vi-VN')} · {now.toLocaleDateString('vi-VN')}</div>
          <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: () => logout() }] }}>
            <Space style={{ cursor: 'pointer' }}><UserOutlined />{me?.name || me?.email}<Typography.Text type="secondary">({me?.role})</Typography.Text></Space>
          </Dropdown>
        </Layout.Header>
        <Layout.Content>
          <Suspense fallback={<Spin style={{ margin: 48 }} />}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
              <Route path="/machines/:id/live" element={<Live />} />
              <Route path="/machines/:id/diagnosis" element={<Diagnosis />} />
              <Route path="/machines/:id/trends" element={<Trends />} />
              <Route path="/machines/:id/maintenance" element={<Maintenance />} />
              <Route path="/points/:id/spectrum" element={<Spectrum />} />
              <Route path="/events" element={<Events />} />
              <Route path="/accuracy" element={<Accuracy />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
