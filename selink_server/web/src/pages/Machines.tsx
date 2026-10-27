import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { api } from '../api/client'
import { num } from '../utils/format'
import { ZoneTag } from '../components/common'

const statusLabel: Record<string, string> = { normal: 'Bình thường', watch: 'Theo dõi', warning: 'Cảnh báo', danger: 'Nguy hiểm', offline: 'Mất kết nối' }
const statusColor: Record<string, string> = { normal: 'success', watch: 'gold', warning: 'orange', danger: 'error', offline: 'default' }

export default function Machines() {
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [site, setSite] = useState<string>()
  const [status, setStatus] = useState<string>()
  const { data } = useQuery<any>({ queryKey: ['overview', site], queryFn: () => api('/overview', { params: { site_id: site } }), refetchInterval: 30_000 })
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  const rows = useMemo(() => (data?.machines || []).filter((machine: any) => {
    const q = search.trim().toLowerCase()
    return (!q || machine.id.toLowerCase().includes(q) || machine.name.toLowerCase().includes(q) || (machine.type || '').toLowerCase().includes(q))
      && (!status || machine.status === status)
  }), [data, search, status])
  const operation = (row: any) => {
    const ts = row.run_ts ? Date.parse(row.run_ts) : 0
    if (!row.online || !ts || Date.now() - ts >= 180_000 || row.running == null) return <Tag color="gold">Không xác định</Tag>
    return row.running ? <Tag color="green">Đang chạy</Tag> : <Tag>Dừng</Tag>
  }
  return <div className="page">
    <div className="page-hero">
      <div><div className="page-kicker">Quản lý tài sản</div><Typography.Title level={2} style={{ margin: 0 }}>Danh sách động cơ</Typography.Title><p className="page-description">Tra cứu trạng thái, sức khỏe và mở nhanh màn hình giám sát của từng máy.</p></div>
    </div>
    <Card>
      <Space wrap style={{ marginBottom: 14 }}>
        <Input allowClear placeholder="Mã, tên hoặc loại máy" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 280 }} />
        <Select allowClear placeholder="Nhà máy" value={site} onChange={setSite} style={{ width: 180 }} options={sites.map((item) => ({ value: item.id, label: item.name }))} />
        <Select allowClear placeholder="Trạng thái" value={status} onChange={setStatus} style={{ width: 170 }} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />
        <Tag>{rows.length} động cơ</Tag>
      </Space>
      <Table className="machines-table" rowKey="id" dataSource={rows} pagination={{ pageSize: 12 }} scroll={{ x: 'max-content' }} onRow={(record: any) => ({ onDoubleClick: () => nav(`/machines/${record.id}/live`) })} columns={[
        { title: 'Mã', dataIndex: 'id', render: (value) => <b>{String(value).toUpperCase()}</b> },
        { title: 'Động cơ', key: 'machine', render: (_, row: any) => <div className="wrap-cell"><b>{row.name}</b><div className="muted">{[row.type, row.rated_power_kw ? `${num(row.rated_power_kw, 0)} kW` : null].filter(Boolean).join(' · ') || '—'}</div></div> },
        { title: 'Nhà máy', dataIndex: 'site_name', render: (value, row: any) => value || row.site_id },
        { title: 'Cảnh báo', dataIndex: 'status', render: (value) => <Tag color={statusColor[value]}>{statusLabel[value] || value}</Tag> },
        { title: 'Kết nối', dataIndex: 'online', render: (value) => <Tag color={value ? 'blue' : 'default'}>{value ? 'Trực tuyến' : 'Mất kết nối'}</Tag> },
        { title: 'Vận hành', key: 'operation', render: (_, row: any) => operation(row) },
        { title: 'ISO', dataIndex: 'iso_zone', render: (value) => value ? <ZoneTag zone={value} /> : '—' },
        { title: 'Rung RMS ISO', dataIndex: 'vib_max_mm_s', render: (value) => value == null ? '—' : `${num(value, 2)} mm/s` },
        { title: 'Nhiệt độ sensor', dataIndex: 'sensor_temp_c', render: (value) => value == null ? '—' : `${num(value, 1)} °C` },
        { title: 'Sức khỏe', dataIndex: 'health_index', render: (value) => value == null ? '—' : `${num(value, 0)}%` },
        { title: 'RUL', dataIndex: 'rul_days', render: (value) => value == null ? '—' : `${num(value, 0)} ngày` },
        { title: '', align: 'right', render: (_, row: any) => <Button onClick={() => nav(`/machines/${row.id}/live`)}>Giám sát</Button> },
      ]} />
    </Card>
  </div>
}
