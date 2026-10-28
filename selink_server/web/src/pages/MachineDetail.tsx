import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Descriptions, InputNumber, message, Progress, Row, Select, Spin, Statistic, Switch, Table, Tag, Typography } from 'antd'
import { api, patch, post } from '../api/client'
import { ago, dt, num } from '../utils/format'
import MachineNav from './MachineNav'
import InstallationDiagram, { templateById } from '../components/InstallationDiagram'
import { DEFAULT_INSTALLATION_TEMPLATE, installationTemplateList } from '../config/installationTemplates'
import { useAuth } from '../auth'
import { STICKY_HEAD } from '../utils/table'

export default function MachineDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [selectedGateway, setSelectedGateway] = useState<string>()
  const [assigningGateway, setAssigningGateway] = useState(false)
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data: deployment } = useQuery<any>({ queryKey: ['machine-deployment', id], queryFn: () => api(`/machines/${id}/deployment`) })
  const activeGatewayId = deployment?.active?.gateway_id
  const { data: gatewayDetail } = useQuery<any>({ queryKey: ['gateway', activeGatewayId], queryFn: () => api(`/gateways/${activeGatewayId}`), enabled: !!activeGatewayId })
  const { data: gateways = [] } = useQuery<any[]>({ queryKey: ['gateways'], queryFn: () => api('/gateways') })
  const { data: installationModels } = useQuery<any[]>({ queryKey: ['installation-models'], queryFn: () => api('/installation-models') })
  const { data: runtime } = useQuery<any>({ queryKey: ['machine-runtime', id], queryFn: () => api(`/machines/${id}/runtime`), refetchInterval: 30_000 })
  const { data: algorithmInfo = [] } = useQuery<any[]>({ queryKey: ['installation-algorithms'], queryFn: () => api('/installation-models/algorithms') })
  const [modelWarnings, setModelWarnings] = useState<string[]>([])
  const templateMutation = useMutation({
    mutationFn: (installation_template: string) => patch(`/machines/${id}`, { meta: { ...(m?.meta || {}), installation_template } }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['machine', id] })
      setModelWarnings(r?.warnings || [])
      message.success('Đã đổi mô hình lắp đặt và đẩy cấu hình tới gateway')
    },
    onError: () => message.error('Không thể cập nhật mô hình lắp đặt'),
  })
  const saveAlpha = (value: number | null) => {
    if (value == null || value <= 0 || value > 2) return
    patch(`/machines/${id}`, { meta: { ...(m?.meta || {}), base_alpha: value } })
      .then(() => { queryClient.invalidateQueries({ queryKey: ['machine', id] }); message.success('Đã lưu hệ số α và đẩy tới gateway') })
      .catch(() => message.error('Không lưu được hệ số α'))
  }
  if (!m) return <div className="page"><MachineNav id={id} /><Spin /></div>
  const tp = m.thermal_params || {}
  const gatewayHealth = gatewayDetail?.health || {}
  const primaryPoint = (m.points || []).find((p: any) => String(p.location || '').toUpperCase() === 'DE') || m.points?.[0]
  const runDetection = m.meta?.run_detection || {
    on_delay_s: 10, off_delay_s: 10,
    sources: primaryPoint ? [{ point_id: primaryPoint.id, axes: ['z'], threshold_mm_s: 0.5 }] : [],
  }
  const saveRunDetection = (next: any) => patch(`/machines/${id}`, { meta: { ...(m.meta || {}), run_detection: next } }).then(() => { queryClient.invalidateQueries({ queryKey: ['machine', id] }); message.success('Đã đẩy cấu hình RUN tới gateway') }).catch(() => message.error('Không thể cập nhật cấu hình RUN'))
  const sourceFor = (pointId: string) => (runDetection.sources || []).find((source: any) => source.point_id === pointId)
  const updateSource = (point: any, next: any | null) => {
    const other = (runDetection.sources || []).filter((source: any) => source.point_id !== point.id)
    saveRunDetection({ ...runDetection, sources: next ? [...other, { point_id: point.id, ...next }] : other })
  }
  const profileFields = [m.type, m.rated_power_kw, m.rated_speed_rpm, m.mounting, m.foundation, m.meta?.bearing_type]
  const profilePct = Math.round(profileFields.filter(Boolean).length / profileFields.length * 100)
  const assignGateway = async () => {
    if (!selectedGateway) return
    setAssigningGateway(true)
    try {
      const result = await post(`/gateways/${selectedGateway}/deployments`, { machine_id: id })
      message.success(result.unchanged ? 'Gateway đã đang đo máy này' : `Đã phân công gateway · cấu hình v${result.config_version}`)
      setSelectedGateway(undefined)
      queryClient.invalidateQueries({ queryKey: ['machine-deployment', id] })
      queryClient.invalidateQueries({ queryKey: ['machine', id] })
      queryClient.invalidateQueries({ queryKey: ['gateways'] })
    } catch (e: any) { message.error(e.message) } finally { setAssigningGateway(false) }
  }
  return (
    <div className="page">
      <MachineNav id={id} />
      <div className="page-hero" style={{ marginTop: 16 }}>
        <div><div className="page-kicker">Asset intelligence</div><h1 className="page-heading">{m.name}</h1><p className="page-description">Hồ sơ kỹ thuật, cấu hình ISO và chuỗi điểm đo của thiết bị.</p></div>
        <Card size="small" style={{ minWidth: 250 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Độ hoàn thiện hồ sơ</span><strong>{profilePct}%</strong></div><Progress percent={profilePct} showInfo={false} strokeColor={profilePct === 100 ? '#34d399' : '#22d3ee'} /></Card>
      </div>
      {profilePct < 100 && <Alert type="warning" showIcon message="Hồ sơ máy chưa đầy đủ" description="Bổ sung loại ổ/vòng bi trong Cấu hình thiết bị để tăng độ tin cậy của chẩn đoán." style={{ marginBottom: 12 }} />}
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <Card size="small" title="Gateway phân công" extra={deployment?.active ? <Tag color={deployment.active.online ? 'green' : 'default'}>{deployment.active.online ? 'Trực tuyến' : 'Mất kết nối'}</Tag> : <Tag>Chưa phân công</Tag>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>{deployment?.active ? <><strong>{deployment.active.gateway_id}</strong><span className="muted"> · bắt đầu {new Date(deployment.active.started_at).toLocaleString('vi-VN')}</span></> : <span className="muted">Chọn gateway trước khi thêm cảm biến. Khi chuyển gateway, dữ liệu của máy cũ vẫn giữ nguyên trong phiên trước.</span>}</div>
              {can('analyst') && <div style={{ display: 'flex', gap: 8 }}><Select placeholder="Chọn gateway" value={selectedGateway} onChange={setSelectedGateway} style={{ minWidth: 220 }} options={gateways.filter((gateway: any) => gateway.site_id === m.site_id).map((gateway: any) => ({ value: gateway.id, label: `${gateway.id}${gateway.assigned_machine_name ? ` · ${gateway.assigned_machine_name}` : ' · sẵn sàng'}` }))} /><Button type="primary" disabled={!selectedGateway} loading={assigningGateway} onClick={assignGateway}>{deployment?.active ? 'Chuyển gateway' : 'Gán gateway'}</Button></div>}
            </div>
          </Card>
        </Col>
        {gatewayDetail && <Col span={24}>
          <Card size="small" title="Chi tiết gateway & phiên đo">
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2, lg: 4 }}>
              <Descriptions.Item label="Gateway"><strong>{gatewayDetail.id || activeGatewayId}</strong></Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={gatewayDetail.online ? 'green' : 'default'}>{gatewayDetail.online ? 'Trực tuyến' : 'Mất kết nối'}</Tag></Descriptions.Item>
              <Descriptions.Item label="Liên lạc cuối">{dt(gatewayDetail.last_seen, true)}</Descriptions.Item>
              <Descriptions.Item label="Bắt đầu phiên">{deployment?.active?.started_at ? dt(deployment.active.started_at, true) : '–'}</Descriptions.Item>
              <Descriptions.Item label="Uptime">{num((gatewayHealth.uptime_s || 0) / 3600, 1)} giờ</Descriptions.Item>
              <Descriptions.Item label="Nhiệt SoC">{num(gatewayHealth.soc_temp_c, 1)} °C</Descriptions.Item>
              <Descriptions.Item label="Đĩa trống">{num(gatewayHealth.disk_free_mb, 0)} MB</Descriptions.Item>
              <Descriptions.Item label="Dữ liệu edge">{num(gatewayHealth.data_used_mb, 0)} MB</Descriptions.Item>
              <Descriptions.Item label="Outbox chờ gửi">{gatewayHealth.outbox_pending ?? '–'}</Descriptions.Item>
              <Descriptions.Item label="Còi/relay">{gatewayHealth.local_alarm_on ? <Tag color="red">BẬT</Tag> : 'tắt'}</Descriptions.Item>
              <Descriptions.Item label="Cấu hình edge">v{gatewayDetail.deployment?.config_version ?? deployment?.active?.config_version ?? '–'}</Descriptions.Item>
              <Descriptions.Item label="Phiên đo"><Tag color="green">Đang đo</Tag></Descriptions.Item>
            </Descriptions>
            <Table sticky={STICKY_HEAD} size="small" pagination={false} rowKey="id" title={() => 'Cảm biến của động cơ'} dataSource={(gatewayDetail.points || []).filter((point: any) => point.machine_id === id)} style={{ marginTop: 12 }} columns={[
              { title: 'Điểm đo', dataIndex: 'id' },
              { title: 'Vị trí', dataIndex: 'location', render: (value, row: any) => value || row.role || '–' },
              { title: 'Địa chỉ', dataIndex: 'sensor_addr', render: (value) => `0x${(value || 0).toString(16).toUpperCase()}` },
              { title: 'Đọc cuối', dataIndex: 'last_reading', render: (value) => value ? ago(value) : '–' },
              { title: 'Trạng thái', key: 'status', render: (_, row: any) => gatewayHealth.devices?.[row.id]?.offline ? <Tag color="red">offline</Tag> : <Tag color="green">ok</Tag> },
            ]} />
          </Card>
        </Col>}
        <Col span={24}>
          <Card size="small" title="Sơ đồ lắp đặt" extra={can('analyst') ? <Select
            aria-label="Mẫu sơ đồ lắp đặt"
            value={m.meta?.installation_template || DEFAULT_INSTALLATION_TEMPLATE}
            loading={templateMutation.isPending}
            onChange={(value) => templateMutation.mutate(value)}
            options={installationTemplateList(installationModels).map((item) => ({ value: item.id, label: item.name }))}
            style={{ minWidth: 280 }}
          /> : null}>
            <InstallationDiagram templateId={m.meta?.installation_template} points={m.points || []} models={installationModels} />
            {modelWarnings.length > 0 && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Cảm biến chưa khớp với mô hình"
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{modelWarnings.map((w) => <li key={w}>{w}</li>)}</ul>} />}
            {(() => {
              const model = templateById(m.meta?.installation_template, installationModels)
              const chosen: string[] = model.algorithms || []
              const info = Object.fromEntries(algorithmInfo.map((a: any) => [a.id, a]))
              const corrected = chosen.includes('iso_corrected_rms') && model.locations.includes('BASE')
              return <div className="model-algorithms">
                <span>Thuật toán của mô hình:</span>
                {chosen.length ? chosen.map((a) => <Tag key={a} color={info[a]?.supported ? 'blue' : 'default'} title={info[a]?.effect || 'Chưa được hệ thống hỗ trợ'}>
                  {a}{info[a] && !info[a].supported ? ' (chưa hỗ trợ)' : ''}</Tag>) : <Tag>không có</Tag>}
                {corrected && <label className="model-alpha">Hệ số truyền BASE → ổ đỡ (α)
                  <InputNumber size="small" min={0.05} max={2} step={0.05} defaultValue={Number(m.meta?.base_alpha ?? 0.8)}
                    disabled={!can('analyst')} onBlur={(e) => saveAlpha(Number((e.target as HTMLInputElement).value.replace(',', '.')))} /></label>}
              </div>
            })()}
          </Card>
        </Col>
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
          <Card size="small" title="Tín hiệu RUN & thời gian vận hành">
            <Row gutter={12}>
              <Col span={8}><Statistic title="RUN" value={runtime?.run_seconds ? `${(runtime.run_seconds / 3600).toFixed(1)} h` : '–'} /></Col>
              <Col span={8}><Statistic title="Rate" value={runtime?.rate_pct ?? 0} suffix="%" precision={1} /></Col>
              <Col span={8}><Statistic title="Mẫu ghi nhận" value={runtime?.samples ?? 0} /></Col>
            </Row>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0 8px' }}>
              <span className="muted">Máy CHẠY khi</span>
              <Select style={{ minWidth: 260 }} value={runDetection.mode || 'any'} disabled={!can('analyst')}
                options={[{ value: 'all', label: 'tất cả cảm biến đã chọn vượt ngưỡng' }, { value: 'any', label: 'ít nhất một cảm biến vượt ngưỡng' }]}
                onChange={(mode) => saveRunDetection({ ...runDetection, mode })} />
            </div>
            <div className="muted" style={{ marginBottom: 8 }}>{(runDetection.mode || 'any') === 'all'
              ? 'Một cảm biến xuống dưới ngưỡng là tính máy DỪNG.'
              : 'Tất cả cảm biến đã chọn xuống dưới ngưỡng mới tính máy DỪNG.'}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(m.points || []).map((point: any) => {
                const source = sourceFor(point.id)
                return <div key={point.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(74px, .7fr) minmax(150px, 1.5fr) minmax(110px, .7fr)', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px solid #dce4ee', borderRadius: 8 }}>
                  <Switch checked={!!source} disabled={!can('analyst') || (!!source && (runDetection.sources || []).length <= 1)} aria-label={`Dùng ${point.location || point.name} để nhận RUN`}
                    onChange={(enabled) => updateSource(point, enabled ? { axes: ['z'], threshold_mm_s: 0.5 } : null)} />
                  <strong>{point.location || point.name}</strong>
                  <Select mode="multiple" value={source?.axes || []} disabled={!source || !can('analyst')} options={['x', 'y', 'z'].map((axis) => ({ value: axis, label: axis.toUpperCase() }))}
                    onChange={(axes) => { if (axes.length) updateSource(point, { ...source, axes }) }} />
                  <InputNumber min={0.01} max={100} step={0.05} precision={2} addonAfter="mm/s" defaultValue={source?.threshold_mm_s ?? 0.5} disabled={!source || !can('analyst')}
                    onBlur={(event) => { const threshold_mm_s = Number(event.target.value); if (threshold_mm_s > 0) updateSource(point, { ...source, threshold_mm_s }) }} />
                </div>
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="muted">Xác nhận RUN</span><InputNumber style={{ width: 110 }} min={0} max={3600} precision={0} addonAfter="s" defaultValue={runDetection.on_delay_s ?? 10} disabled={!can('analyst')}
                onBlur={(event) => { const on_delay_s = Number(event.target.value); if (on_delay_s >= 0) saveRunDetection({ ...runDetection, on_delay_s }) }} /></span>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span className="muted">Xác nhận STOP</span><InputNumber style={{ width: 110 }} min={0} max={3600} precision={0} addonAfter="s" defaultValue={runDetection.off_delay_s ?? 10} disabled={!can('analyst')}
                onBlur={(event) => { const off_delay_s = Number(event.target.value); if (off_delay_s >= 0) saveRunDetection({ ...runDetection, off_delay_s }) }} /></span>
            </div>
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
          {m.isolation?.enabled && (
            <Card size="small" title="Cô lập nhiễu (Beer HN)" style={{ marginTop: 12 }}>
              <p>Tham chiếu: <Tag>{m.isolation.reference_point}</Tag> Nguồn: <Tag>{m.isolation.source_point}</Tag>
                Đích: {m.isolation.targets?.map((t: string) => <Tag key={t}>{t}</Tag>)}</p>
              <Table sticky={STICKY_HEAD} size="small" pagination={false} rowKey={(r: any) => r.point + r.f_hz}
                dataSource={Object.entries(m.isolation.alpha || {}).flatMap(([p, tab]: any) => tab.map((x: any) => ({ point: p, ...x })))}
                locale={{ emptyText: 'Chưa học α (cần ≥ N mẫu ở đầy tải)' }}
                columns={[{ title: 'Điểm', dataIndex: 'point' }, { title: 'f (Hz)', dataIndex: 'f_hz', render: (v) => num(v, 1) },
                  { title: 'α', dataIndex: 'alpha', render: (v) => num(v, 3) }]} />
            </Card>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Cách hệ thống đang đánh giá">
            <Row gutter={[10, 10]}>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(52,211,153,.07)', '--stat-color': '#34d399' } as React.CSSProperties}><div className="muted">Bình thường</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#34d399' }}>&lt; {num(m.iso_limits.ab, 1)}</Typography.Title></div></Col>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(251,191,36,.07)', '--stat-color': '#fbbf24' } as React.CSSProperties}><div className="muted">Cảnh báo</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#fbbf24' }}>{num(m.iso_limits.bc, 1)}</Typography.Title></div></Col>
              <Col span={8}><div className="status-stat" style={{ padding: 12, borderRadius: 10, background: 'rgba(251,113,133,.07)', '--stat-color': '#fb7185' } as React.CSSProperties}><div className="muted">Nguy hiểm</div><Typography.Title level={4} style={{ margin: '5px 0 0', color: '#fb7185' }}>&gt; {num(m.iso_limits.cd, 1)}</Typography.Title></div></Col>
            </Row>
            <div className="muted" style={{ marginTop: 10 }}>RMS vận tốc · dải {num(m.iso_band_lo_hz, 0)}–{num(m.iso_band_hi_hz, 0)} Hz · ISO 20816-3</div>
          </Card>
        </Col>
        <Col span={24}>
          <Card size="small" title="Điểm đo">
            <Table sticky={STICKY_HEAD} size="small" rowKey="id" dataSource={m.points} pagination={false}
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
