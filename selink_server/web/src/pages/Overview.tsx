import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, Col, Empty, Progress, Row, Segmented, Space, Spin, Statistic, Tag, Tooltip } from 'antd'
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
          <div className="section-label"><h2>Đội máy đang giám sát</h2><span className="muted">Tự động cập nhật mỗi 30 giây</span></div>
          <Row gutter={[12, 12]}>
            <Col xs={24} xl={16}>
              <Row gutter={[12, 12]}>
                {data.machines.length === 0 && <Col span={24}><Empty description="Chưa có động cơ" /></Col>}
                {data.machines.map((m: any) => (
                  <Col xs={24} md={12} xl={8} xxl={6} key={m.id}>
                    <Card className="machine-card glass-card" hoverable onClick={() => nav(`/machines/${m.id}/live`)}
                      title={<div className="machine-card-title"><Badge color={STATUS[m.status]?.color} /><span title={m.name}>{m.name}</span></div>}
                      extra={<StatusTag status={m.status} />}>
                      <div className="machine-card-sub">{m.site_name || m.site_id}{m.rated_power_kw ? ` · ${num(m.rated_power_kw, 0)} kW` : ''}</div>
                      <Row gutter={8}>
                        <Col span={8} className="health-gauge-cell">
                          <Tooltip title="Chỉ số sức khỏe (AI)">
                            <Progress type="dashboard" size={84} percent={m.health_index != null ? Math.round(m.health_index) : 0}
                              format={() => (m.health_index != null ? Math.round(m.health_index) : <span className="gauge-empty">Chưa đủ<br />dữ liệu</span>)}
                              strokeColor={m.health_index == null ? '#d9d9d9' : m.health_index > 70 ? '#2e9d4f' : m.health_index > 40 ? '#fa8c16' : '#cf1322'} />
                          </Tooltip>
                          <div className="muted health-gauge-label">Sức khỏe</div>
                        </Col>
                        <Col span={16}>
                          <Space direction="vertical" size={5} style={{ width: '100%' }}>
                            <Space wrap>
                              <ZoneTag zone={m.iso_zone} />
                              {m.running == null ? null : m.running
                                ? <Tag color="green">Đang chạy{m.load_pct != null ? ` ${num(m.load_pct, 0)}%` : ''}</Tag>
                                : <Tag>Dừng</Tag>}
                            </Space>
                            <div className="metric-line"><Tooltip title={m.iso_ts ? `Vận tốc RMS ISO lớn nhất (trục hướng kính) · capture ${ago(m.iso_ts)}` : 'Chưa có capture'}><span>Rung RMS ISO</span></Tooltip><strong>{num(m.vib_max_mm_s)} mm/s</strong></div>
                            <div className="metric-line"><span>Nhiệt độ ổ</span><strong>{num(m.bearing_temp_c, 1)} °C</strong></div>
                            <div className="metric-line"><span>Cuộn dây <EstimateTag /></span><strong>{num(m.winding_temp_est_c, 1)} °C</strong></div>
                            {m.rul_days != null && (
                              <div>RUL: <b>{num(m.rul_days, 0)}</b> ngày ({num(m.rul_lo_days, 0)}–{num(m.rul_hi_days, 0)}) <EstimateTag /></div>
                            )}
                          </Space>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 10 }}>
                        {m.trend_7d.length ? <TrendChart compact height={90} limits={m.iso_limits}
                          series={[{ name: 'Rung RMS ISO (mm/s)', data: m.trend_7d, color: '#1d4ed8' }]} />
                          : <div className="trend-empty">Chưa có dữ liệu xu hướng</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="muted">Xu hướng rung RMS · 7 ngày</span><span className="card-link">Xem realtime </span></div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Col>
            <Col xs={24} xl={8}>
              <Card className="glass-card alert-strip" size="small" title={<span>Cảnh báo mới nhất</span>} extra={<Button type="link" size="small" onClick={() => nav('/events')}>Tất cả</Button>}>
                {data.events.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có cảnh báo" /> : (
                  <div className="alert-rows">
                    {data.events.map((e: any) => (
                      <div key={e.event_id} className="alert-row" role="button" tabIndex={0}
                        onClick={() => nav(`/events?event=${e.event_id}`)}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') nav(`/events?event=${e.event_id}`) }}>
                        <span className="alert-sev"><StatusTag status={e.severity} /></span>
                        <span className="alert-machine" title={e.machine_name || e.gateway_id}>{e.machine_name || e.gateway_id}</span>
                        <span className="alert-msg" title={e.message}>{e.message}</span>
                        <span className="alert-time">{ago(e.ts)}{e.cleared_at ? ' · đã hết' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
