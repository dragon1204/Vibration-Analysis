import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Drawer, Dropdown, Grid, Input, Layout, Menu, Spin } from 'antd'
import {
  AlertOutlined, BellFilled, DashboardOutlined, DatabaseOutlined, FieldTimeOutlined, FileTextOutlined,
  LineChartOutlined, LogoutOutlined, MenuOutlined, RobotOutlined, SearchOutlined, SettingOutlined,
  FundProjectionScreenOutlined, UnorderedListOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { useRealtime } from './api/realtime'
import { api, logout } from './api/client'
import Login from './pages/Login'

const Overview = lazy(() => import('./pages/Overview'))
const Machines = lazy(() => import('./pages/Machines'))
const Live = lazy(() => import('./pages/Live'))
const Diagnosis = lazy(() => import('./pages/Diagnosis'))
const MachineDetail = lazy(() => import('./pages/MachineDetail'))
const Trends = lazy(() => import('./pages/Trends'))
const Spectrum = lazy(() => import('./pages/Spectrum'))
const Events = lazy(() => import('./pages/Events'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const Rul = lazy(() => import('./pages/Rul'))
const DeepAnalysis = lazy(() => import('./pages/DeepAnalysis'))
const Accuracy = lazy(() => import('./pages/Accuracy'))
const Reports = lazy(() => import('./pages/Reports'))
const Devices = lazy(() => import('./pages/Devices'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  const { ready, loggedIn, me } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const screens = Grid.useBreakpoint()
  const [open, setOpen] = useState(false)
  const { data: overview } = useQuery<any>({
    queryKey: ['shell-overview'], queryFn: () => api('/overview'), enabled: loggedIn, refetchInterval: 30_000,
  })
  const { data: gateways = [] } = useQuery<any[]>({
    queryKey: ['shell-gateways'], queryFn: () => api('/gateways'), enabled: loggedIn, refetchInterval: 30_000,
  })

  // Gateway online/offline is pushed on rt:gateways; refresh the header instead of waiting for the 30 s poll.
  const qc = useQueryClient()
  useRealtime(['gateways'], (m) => { if (m.data?.type === 'status') qc.invalidateQueries({ queryKey: ['shell-gateways'] }) })

  if (!ready) return <Spin style={{ marginTop: '40vh', width: '100%' }} size="large" />
  if (!loggedIn) return <Login />

  const routeMachine = loc.pathname.match(/^\/machines\/([^/]+)/)?.[1]
  const machines = overview?.machines || []
  const activeMachine = routeMachine || machines[0]?.id || 'ga55-01'
  const online = gateways.filter((gateway: any) => gateway.online).length
  const eventCount = overview?.events?.length || 0
  const livePath = `/machines/${activeMachine}/live`
  const diagnosisPath = `/machines/${activeMachine}/diagnosis`
  const deepPath = `/machines/${activeMachine}/deep-analysis`
  const rulPath = `/machines/${activeMachine}/rul`
  const menuItems: any[] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
    { key: '/machines', icon: <UnorderedListOutlined />, label: 'Danh sách động cơ' },
    { key: livePath, icon: <FundProjectionScreenOutlined />, label: 'Giám sát thời gian thực' },
    { key: `${livePath}?focus=spectrum`, icon: <LineChartOutlined />, label: 'Phân tích phổ FFT' },
    { key: '/events', icon: <AlertOutlined />, label: <span>Cảnh báo & sự kiện {eventCount > 0 && <Badge count={eventCount} size="small" />}</span> },
    { type: 'group', label: 'PHÂN TÍCH NÂNG CAO', children: [
      { key: diagnosisPath, icon: <RobotOutlined />, label: 'AI chẩn đoán' },
      { key: deepPath, icon: <ApartmentOutlined />, label: 'Phân tích sâu FFT' },
      { key: rulPath, icon: <FieldTimeOutlined />, label: 'Dự đoán RUL' },
      { key: '/reports', icon: <FileTextOutlined />, label: 'Lịch sử & báo cáo' },
    ] },
    { type: 'group', label: 'QUẢN TRỊ', children: [
      { key: '/knowledge', icon: <RobotOutlined />, label: 'Mô hình AI & tri thức' },
      { key: '/devices', icon: <DatabaseOutlined />, label: 'Thiết bị & gateway' },
      { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
    ] },
  ]
  const selected = loc.pathname === '/' ? '/' : loc.pathname.startsWith('/events') ? '/events'
    : loc.pathname.startsWith('/reports') ? '/reports' : loc.pathname.startsWith('/knowledge') ? '/knowledge' : loc.pathname.startsWith('/devices') ? '/devices'
      : loc.pathname.startsWith('/settings') ? '/settings' : loc.pathname.includes('/deep-analysis') ? deepPath : loc.pathname.includes('/rul') ? rulPath : loc.pathname.includes('/diagnosis') ? diagnosisPath
        : loc.pathname.includes('/live') ? livePath : '/machines'
  const menu = <Menu className="app-menu" mode="inline" selectedKeys={[selected]} items={menuItems}
    onClick={(e) => { nav(e.key); setOpen(false) }} />

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        {!screens.md && <Button className="mobile-menu-btn" icon={<MenuOutlined />} onClick={() => setOpen(true)} />}
        <div className="top-brand"><div className="top-brand-mark">H</div><b>HEM Smart Motor</b><span>Giám sát thông minh · Vận hành bền vững</span></div>
        <Input className="header-search hide-tablet" prefix={<SearchOutlined />} placeholder="Tìm động cơ, cảnh báo, báo cáo..."
          onPressEnter={(e) => {
            const q = e.currentTarget.value.toLowerCase().trim()
            const found = machines.find((m: any) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
            if (found) nav(`/machines/${found.id}/live`)
          }} />
        <div className="system-health hide-mobile" title="Gateway gửi health mỗi phút; quá 3 phút không có tín hiệu được coi là mất kết nối">
          <span className={`pulse-dot ${!gateways.length ? '' : online === gateways.length ? '' : online === 0 ? 'pulse-dot-bad' : 'pulse-dot-warn'}`} />
          {!gateways.length ? 'Chưa có gateway' : online === gateways.length ? `Hệ thống hoạt động · ${online}/${gateways.length} gateway`
            : online === 0 ? `Mất kết nối gateway · 0/${gateways.length}` : `${online}/${gateways.length} gateway trực tuyến`}
        </div>
        <Badge count={eventCount} size="small"><Button className="header-icon" type="text" icon={<BellFilled />} onClick={() => nav('/events')} /></Badge>
        <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: () => logout() }] }}>
          <div className="user-chip"><Avatar>{(me?.name || me?.email || 'A').slice(0, 1).toUpperCase()}</Avatar><div><b>{me?.name || me?.email}</b><span>{me?.role === 'admin' ? 'Quản trị hệ thống' : me?.role}</span></div></div>
        </Dropdown>
      </Layout.Header>
      <Layout>
        {screens.md ? <Layout.Sider className="app-sidebar" width={256}>{menu}</Layout.Sider>
          : <Drawer open={open} onClose={() => setOpen(false)} placement="left" width={270} styles={{ body: { padding: 0 } }}>{menu}</Drawer>}
        <Layout.Content className="app-content">
          <Suspense fallback={<Spin style={{ margin: 48 }} />}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
              <Route path="/machines/:id/live" element={<Live />} />
              <Route path="/machines/:id/diagnosis" element={<Diagnosis />} />
              <Route path="/machines/:id/rul" element={<Rul />} />
              <Route path="/machines/:id/deep-analysis" element={<DeepAnalysis />} />
              <Route path="/machines/:id/trends" element={<Trends />} />
              <Route path="/machines/:id/maintenance" element={<Maintenance />} />
              <Route path="/points/:id/spectrum" element={<Spectrum />} />
              <Route path="/events" element={<Events />} />
              <Route path="/accuracy" element={<Accuracy />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
