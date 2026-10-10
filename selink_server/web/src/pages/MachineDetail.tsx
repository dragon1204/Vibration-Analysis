import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Descriptions, Progress, Row, Spin, Table, Tag, Typography } from 'antd'
import { api } from '../api/client'
import { num } from '../utils/format'
import MachineNav from './MachineNav'

export default function MachineDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  if (!m) return <div className="page"><MachineNav id={id} /><Spin /></div>
  const tp = m.thermal_params || {}
  const profileFields = [m.type, m.rated_power_kw, m.rated_speed_rpm, m.mounting, m.foundation, m.meta?.bearing_type]
  const profilePct = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100)
  return (
    <div className="page">
      <MachineNav id={id} />
      <div className="page-hero" style={{ marginTop: 16 }}>
        <div><div className="page-kicker">Asset intelligence</div><h1 className="page-heading">{m.name}</h1><p className="page-description">Hồ sơ kỹ thuật, cấu hình ISO và chuỗi điểm đo của thiết bị.</p></div>
        <Card size="small" style={{ minWidth: 250 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Độ hoàn thiện hồ sơ</span><strong>{profilePct}%</strong></div><Progress percent={profilePct} showInfo={false} strokeColor={profilePct === 100 ? '#34d399' : '#22d3ee'} /></Card>
      </div>
      {profilePct < 100 && <Alert type="warning" showIcon message="Hồ sơ máy chưa đầy đủ" description="Bổ sung loại ổ/vòng bi trong Cài đặt để tăng độ tin cậy của chẩn đoán." style={{ marginBottom: 12 }} />}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Thông tin máy">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Mã">{m.id}</Descriptions.Item>
              <Descriptions.Item label="Loại">{m.type}</Descriptions.Item>
              <Descriptions.Item label="Hãng / model">{m.maker} {m.model}</Descriptions.Item>
              <Descriptions.Item label="Công suất">{num(m.rated_power_kw, 0)} kW</Descriptions.Item>
              <Descriptions.Item label="Tốc độ">{num(m.rated_speed_rpm, 0)} v/ph (1X {num(m.rated_speed_rpm / 60, 2)} Hz)</Descriptions.Item>
              <Descriptions.Item label="Số cực">{m.poles}</Descriptions.Item>
              <Descriptions.Item label="Điện áp / dòng">{num(m.rated_voltage_v, 0)} V / {num(m.rated_current_a, 0)} A</Descriptions.Item>
              <Descriptions.Item label="Cách điện">Cấp {m.insulation_class}</Descriptions.Item>
              <Descriptions.Item label="Kiểu lắp">{m.mounting}</Descriptions.Item>
              <Descriptions.Item label="Truyền động">{{ direct: 'Khớp nối trực tiếp', flexible: 'Khớp nối mềm', belt: 'Dây đai', gear: 'Hộp số' }[m.meta?.coupling as string] || '–'}</Descriptions.Item>
              <Descriptions.Item label="Ổ / vòng bi">{m.meta?.bearing_type === 'roller' ? 'Ổ lăn' : m.meta?.bearing_type === 'sleeve' ? 'Ổ trượt' : 'Chưa xác định'}{m.meta?.bearing_model ? ` · ${m.meta.bearing_model}` : ''}</Descriptions.Item>
              <Descriptions.Item label="Đường kính ngoài">{m.meta?.bearing_outer_diameter_mm ? `${num(m.meta.bearing_outer_diameter_mm, 1)} mm` : '–'}</Descriptions.Item>
              <Descriptions.Item label="ISO 20816-3">Nhóm {m.iso_group}, nền {m.foundation === 'rigid' ? 'cứng' : 'mềm'}</Descriptions.Item>
              <Descriptions.Item label="Ngưỡng A/B · B/C · C/D">{num(m.iso_limits.ab, 1)} · {num(m.iso_limits.bc, 1)} · {num(m.iso_limits.cd, 1)} mm/s</Descriptions.Item>
              <Descriptions.Item label="Dải ISO">{num(m.iso_band_lo_hz, 0)}–{num(m.iso_band_hi_hz, 0)} Hz</Descriptions.Item>
              {m.male_lobes && <Descriptions.Item label="Máy nén trục vít">{m.male_lobes} thùy đực → f_mesh ≈ {num(m.male_lobes * m.rated_speed_rpm / 60, 1)} Hz</Descriptions.Item>}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Mô hình nhiệt cuộn dây (ước lượng)">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="I_N">{num(tp.i_n_a, 0)} A</Descriptions.Item>
              <Descriptions.Item label="ΔT_N">{num(tp.dt_n_k, 0)} K</Descriptions.Item>
              <Descriptions.Item label="Tổn hao không tải a">{num(tp.a, 2)}</Descriptions.Item>
              <Descriptions.Item label="τ chạy">{num((tp.tau_run_s || 0) / 60, 0)} phút</Descriptions.Item>
              <Descriptions.Item label="K_neg">{num(tp.k_neg, 1)}</Descriptions.Item>
              <Descriptions.Item label="c_frame">{num(tp.c_frame, 2)}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card size="small" title="Cách hệ thống đang đánh giá" style={{ marginTop: 12 }}>
            <Row gutter={[10, 10]}>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(52,211,153,.07)', '--stat-color': '#34d399' } as React.CSSProperties}><div className="muted">Bình thường</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#34d399' }}>&lt; {num(m.iso_limits.ab, 1)}</Typography.Title></div></Col>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(251,191,36,.07)', '--stat-color': '#fbbf24' } as React.CSSProperties}><div className="muted">Cảnh báo</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#fbbf24' }}>{num(m.iso_limits.bc, 1)}</Typography.Title></div></Col>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(251,113,133,.07)', '--stat-color': '#fb7185' } as React.CSSProperties}><div className="muted">Nguy hiểm</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#fb7185' }}>&gt; {num(m.iso_limits.cd, 1)}</Typography.Title></div></Col>
            </Row>
            <div className="muted" style={{ marginTop: 10 }}>RMS vận tốc · dải {num(m.iso_band_lo_hz, 0)}–{num(m.iso_band_hi_hz, 0)} Hz · ISO 20816-3</div>
          </Card>
          {m.isolation?.enabled && (
            <Card size="small" title="Cô lập nhiễu (Beer HN)" style={{ marginTop: 12 }}>
              <p>Tham chiếu: <Tag>{m.isolation.reference_point}</Tag> Nguồn: <Tag>{m.isolation.source_point}</Tag>
                Đích: {m.isolation.targets?.map((t: string) => <Tag key={t}>{t}</Tag>)}</p>
              <Table size="small" pagination={false} rowKey={(r: any) => r.point + r.f_hz}
                dataSource={Object.entries(m.isolation.alpha || {}).flatMap(([p, tab]: any) => tab.map((x: any) => ({ point: p, ...x })))}
                locale={{ emptyText: 'Chưa học α (cần ≥ N mẫu ở đầy tải)' }}
                columns={[{ title: 'Điểm', dataIndex: 'point' }, { title: 'f (Hz)', dataIndex: 'f_hz', render: (v) => num(v, 1) },
                  { title: 'α', dataIndex: 'alpha', render: (v) => num(v, 3) }]} />
            </Card>
          )}
        </Col>
        <Col span={24}>
          <Card size="small" title="Điểm đo">
            <Table size="small" rowKey="id" dataSource={m.points} pagination={false}
              onRow={(r: any) => ({ onClick: () => nav(`/points/${r.id}/spectrum`), style: { cursor: 'pointer' } })}
              columns={[
                { title: 'Mã', dataIndex: 'id' }, { title: 'Tên', dataIndex: 'name' }, { title: 'Vị trí', dataIndex: 'location' },
                { title: 'Vai trò', dataIndex: 'role' }, { title: 'Cảm biến', key: 's', render: (_, r: any) => `${r.sensor_model} @0x${(r.sensor_addr || 0).toString(16)}` },
                { title: 'Trục', dataIndex: 'axes_map', render: (a) => a && Object.entries(a).map(([k, v]) => `${k}:${v}`).join(' ') },
                { title: 'Trục ISO', dataIndex: 'iso_axes', render: (a) => a?.join(', ') },
                { title: 'Vòng bi', dataIndex: 'bearing_model' },
                { title: 'Gateway', dataIndex: 'gateway_id', render: (g, r: any) => <Tag color={r.gateway_online ? 'green' : 'default'}>{g}</Tag> },
              ]} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
