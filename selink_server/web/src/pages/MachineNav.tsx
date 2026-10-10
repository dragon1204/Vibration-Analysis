import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Breadcrumb, Segmented, Space } from 'antd'
import { api } from '../api/client'

/** Header shared by machine screens: breadcrumb + tab switch between machine views. */
export default function MachineNav({ id }: { id: string }) {
  const nav = useNavigate()
  const loc = useLocation()
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const tabs = [
    { label: 'Thời gian thực', value: 'live' },
    { label: 'AI chẩn đoán', value: 'diagnosis' },
    { label: 'Xu hướng', value: 'trends' },
    { label: 'Bảo trì', value: 'maintenance' },
    { label: 'Thông tin', value: '' },
  ]
  const cur = loc.pathname.split('/')[3] || ''
  return (
    <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
      <Breadcrumb items={[{ title: <a onClick={() => nav('/')}>Tổng quan</a> }, { title: m?.name || id }]} />
      <Segmented value={cur} options={tabs} onChange={(v) => nav(`/machines/${id}${v ? '/' + v : ''}`)} />
    </Space>
  )
}
