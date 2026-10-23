import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from 'antd'
import { api } from '../api/client'
import { dt, num } from '../utils/format'

export default function Knowledge() {
  const nav = useNavigate()
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ['rules'], queryFn: () => api('/alarm-rules') })
  const { data: baselines = [] } = useQuery<any[]>({ queryKey: ['baselines-all'], queryFn: () => api('/baselines') })
  const active = baselines.filter((item) => item.status === 'active' || item.status === 'frozen')
  const learning = baselines.filter((item) => item.status === 'learning')
  const coverage = baselines.length ? Math.round(active.length / baselines.length * 100) : 0
  return <div className="page">
    <div className="page-hero">
      <div><div className="page-kicker">AI có thể giải thích</div><Typography.Title level={2} style={{ margin: 0 }}>Mô hình AI & tri thức</Typography.Title><p className="page-description">Theo dõi tri thức chẩn đoán, độ phủ baseline và các luật đang tham gia ra quyết định.</p></div>
      <Button onClick={() => nav('/settings')}>Cấu hình</Button>
    </div>
    <Row gutter={[14, 14]}>
      <Col xs={12} lg={6}><Card><Statistic title="Luật đang bật" value={rules.filter((item) => item.enabled).length} suffix={`/ ${rules.length}`} /></Card></Col>
      <Col xs={12} lg={6}><Card><Statistic title="Baseline hiệu lực" value={active.length} suffix={`/ ${baselines.length}`} /></Card></Col>
      <Col xs={12} lg={6}><Card><Statistic title="Đang học" value={learning.length} /></Card></Col>
      <Col xs={12} lg={6}><Card title="Độ phủ tri thức"><Progress percent={coverage} strokeColor="#3270ed" /></Card></Col>
      <Col span={24}><Card title="Luật chẩn đoán & cảnh báo"><Table size="small" rowKey="id" dataSource={rules} pagination={false} columns={[
        { title: 'Luật', dataIndex: 'rule', render: (value) => <b>{value}</b> }, { title: 'Phạm vi', render: (_, row: any) => `${row.scope}${row.scope_id ? ` · ${row.scope_id}` : ''}` },
        { title: 'Mức', dataIndex: 'severity', render: (value) => <Tag color={value === 'danger' ? 'error' : value === 'warning' ? 'orange' : 'gold'}>{value}</Tag> },
        { title: 'Trạng thái', dataIndex: 'enabled', render: (value) => value ? <Tag color="success">Hoạt động</Tag> : <Tag>Tắt</Tag> },
        { title: 'Tham số', dataIndex: 'params', render: (value) => <code>{JSON.stringify(value)}</code> },
      ]} /></Card></Col>
      <Col span={24}><Card title="Baseline gần cập nhật"><Table size="small" rowKey="id" dataSource={baselines.slice(0, 20)} columns={[
        { title: 'Điểm', dataIndex: 'point_id' }, { title: 'Đặc trưng', dataIndex: 'feature' }, { title: 'Nhóm tải', dataIndex: 'load_bin' },
        { title: 'Median', dataIndex: 'median', render: (value) => num(value, 3) }, { title: 'Ngưỡng W / A', render: (_, row: any) => `${num(row.warn, 3)} / ${num(row.alarm, 3)}` },
        { title: 'Mẫu', dataIndex: 'n_samples' }, { title: 'Trạng thái', dataIndex: 'status', render: (value) => <Tag color={value === 'learning' ? 'processing' : 'success'}>{value}</Tag> },
        { title: 'Cập nhật', dataIndex: 'updated_at', render: (value) => dt(value) },
      ]} /></Card></Col>
    </Row>
  </div>
}
