import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Col, Empty, List, Progress, Row, Segmented, Space, Spin, Statistic, Tag, Tooltip, Typography } from 'antd'
import { ThunderboltOutlined, PauseCircleOutlined, FireOutlined, ArrowRightOutlined, RadarChartOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { useRealtime } from '../api/realtime'
import { TrendChart } from '../components/charts'
import { EstimateTag, StatusTag, ZoneTag } from '../components/common'
import { STATUS, ago, num } from '../utils/format'

export default function Overview() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [site, setSite] = useState<string>('all')
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  const { data, isLoading } = useQuery<any>({
    queryKey: ['overview', site],
    queryFn: () => api('/overview', { params: { site_id: site === 'all' ? undefined : site } }),
    refetchInterval: 30_000,
  })
  useRealtime(['events'], () => qc.invalidateQueries({ queryKey: ['overview'] }))

  return (
    <div className="page">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Live condition intelligence</div>
          <h1 className="page-heading">Toàn cảnh sức khỏe thiết bị</h1>
          <p className="page-description">Theo dõi rung động, nhiệt độ và cảnh báo bất thường từ mọi động cơ trong một không gian vận hành thống nhất.</p>
        </div>
        <Segmented value={site} onChange={(v) => setSite(String(v))}
          options={[{ label: 'Tất cả khu vực', value: 'all' }, ...sites.map((s) => ({ label: s.name, value: s.id }))]} />
      </div>
      {isLoading || !data ? <Spin /> : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 22 }}>
            {(['normal', 'watch', 'warning', 'danger', 'offline'] as const).map((k) => (
              <Col xs={12} sm={8} lg={k === 'offline' ? 4 : 5} key={k} flex="1 1 150px">
                <Card className="status-stat" size="small" style={{ '--stat-color': STATUS[k].color } as React.CSSProperties}>
                  <Statistic title={<StatusTag status={k} />} value={data.counts[k]} valueStyle={{ color: STATUS[k].color }} suffix={<span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>động cơ</span>} />
                </Card>
              </Col>
            ))}
          </Row>
          <div className="section-label"><h2><RadarChartOutlined style={{ color: '#22d3ee', marginRight: 8 }} />Đội máy đang giám sát</h2><span className="muted">Tự động cập nhật mỗi 30 giây</span></div>
          <Row gutter={[12, 12]}>
            <Col xs={24} xl={18}>
              <Row gutter={[12, 12]}>
                {data.machines.length === 0 && <Col span={24}><Empty description="Chưa có động cơ" /></Col>}
                {data.machines.map((m: any) => (
                  <Col xs={24} md={12} xxl={8} key={m.id}>
                    <Card className="machine-card glass-card" hoverable onClick={() => nav(`/machines/${m.id}/live`)}
                      title={<Space><Badge color={STATUS[m.status]?.color} />{m.name}</Space>}
                      extra={<StatusTag status={m.status} />}>
                      <Row gutter={8}>
                        <Col span={8}>
                          <Tooltip title="Chỉ số sức khỏe (AI)">
                            <Progress type="dashboard" size={84} percent={m.health_index != null ? Math.round(m.health_index) : 0}
                              format={() => (m.health_index != null ? Math.round(m.health_index) : '–')}
                              strokeColor={m.health_index == null ? '#d9d9d9' : m.health_index > 70 ? '#2e9d4f' : m.health_index > 40 ? '#fa8c16' : '#cf1322'} />
                          </Tooltip>
                          <div className="muted" style={{ textAlign: 'center' }}>Sức khỏe</div>
                        </Col>
                        <Col span={16}>
                          <Space direction="vertical" size={5} style={{ width: '100%' }}>
                            <Space wrap>
                              <ZoneTag zone={m.iso_zone} />
                              {m.running == null ? null : m.running
                                ? <Tag icon={<ThunderboltOutlined />} color="green">Đang chạy{m.load_pct != null ? ` ${num(m.load_pct, 0)}%` : ''}</Tag>
                                : <Tag icon={<PauseCircleOutlined />}>Dừng</Tag>}
                            </Space>
                            <div className="metric-line"><span>Rung tối đa</span><strong>{num(m.vib_max_mm_s)} mm/s</strong></div>
                            <div className="metric-line"><span><FireOutlined /> Nhiệt độ ổ</span><strong>{num(m.bearing_temp_c, 1)} °C</strong></div>
                            <div className="metric-line"><span>Cuộn dây <EstimateTag /></span><strong>{num(m.winding_temp_est_c, 1)} °C</strong></div>
                            {m.rul_days != null && (
                              <div>RUL: <b>{num(m.rul_days, 0)}</b> ngày ({num(m.rul_lo_days, 0)}–{num(m.rul_hi_days, 0)}) <EstimateTag /></div>
                            )}
                          </Space>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 10 }}>
                        <TrendChart compact height={90} limits={m.iso_limits}
                          series={[{ name: 'Rung (mm/s)', data: m.trend_7d }]} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="muted">Xu hướng rung 7 ngày</span><span style={{ color: '#67e8f9', fontSize: 11 }}>Xem realtime <ArrowRightOutlined /></span></div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Col>
            <Col xs={24} xl={6}>
              <Card className="glass-card" size="small" title={<span><SafetyCertificateOutlined style={{ color: '#fbbf24', marginRight: 8 }} />Cảnh báo mới nhất</span>} extra={<Button type="link" size="small" onClick={() => nav('/events')}>Tất cả</Button>}>
                <List size="small" dataSource={data.events} locale={{ emptyText: 'Không có cảnh báo' }}
                  renderItem={(e: any) => (
                    <List.Item style={{ cursor: 'pointer' }} onClick={() => nav(`/events?event=${e.event_id}`)}>
                      <List.Item.Meta title={<Space><StatusTag status={e.severity} /><Typography.Text>{e.machine_name || e.gateway_id}</Typography.Text></Space>}
                        description={<><div>{e.message}</div><span className="muted">{ago(e.ts)}{e.cleared_at ? ' · đã hết' : ''}</span></>} />
                    </List.Item>
                  )} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
