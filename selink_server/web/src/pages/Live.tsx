import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Descriptions, Empty, Row, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { CameraOutlined, LineChartOutlined } from '@ant-design/icons'
import { api, post } from '../api/client'
import { useRealtime } from '../api/realtime'
import { Sparkline, WaveformChart } from '../components/charts'
import { EstimateTag, ZoneTag, lastHours, rangeParams } from '../components/common'
import { useAuth } from '../auth'
import { ago, num } from '../utils/format'
import MachineNav from './MachineNav'

type Spark = Record<string, Record<string, [string, number][]>> // point -> axis -> series

export default function Live() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data: st, isLoading } = useQuery<any>({ queryKey: ['status', id], queryFn: () => api(`/machines/${id}/status`), refetchInterval: 15_000 })
  const [spark, setSpark] = useState<Spark>({})
  const [wavePoint, setWavePoint] = useState<string>()

  // Preload 60 min of velocity for sparklines.
  useEffect(() => {
    if (!machine) return
    const r = rangeParams(lastHours(1))
    Promise.all(machine.points.map((p: any) =>
      api(`/points/${p.id}/metrics`, { params: { ...r, fields: 'vel_mm_s' } }).then((d) => [p.id, d.series] as const),
    )).then((rows) => {
      const s: Spark = {}
      rows.forEach(([pid, series]: any) => {
        s[pid] = {}
        Object.entries(series).forEach(([a, f]: any) => (s[pid][a] = f.vel_mm_s))
      })
      setSpark(s)
    }).catch(() => undefined)
    if (!wavePoint) setWavePoint(machine.points.find((p: any) => p.role === 'bearing')?.id || machine.points[0]?.id)
  }, [machine]) // eslint-disable-line react-hooks/exhaustive-deps

  useRealtime([`machine:${id}`], (m) => {
    const d = m.data
    if (d.type === 'vib') {
      setSpark((prev) => {
        const next: Spark = { ...prev, [d.point_id]: { ...(prev[d.point_id] || {}) } }
        ;(['x', 'y', 'z'] as const).forEach((a) => {
          const v = d.vel_mm_s?.[a]
          if (v == null) return
          const arr = [...(next[d.point_id][a] || []), [d.ts, v] as [string, number]]
          const cutoff = Date.now() - 3600_000
          next[d.point_id][a] = arr.filter(([t]) => Date.parse(t) >= cutoff)
        })
        return next
      })
      qc.setQueryData(['status', id], (old: any) => {
        if (!old) return old
        return {
          ...old, points: old.points.map((p: any) => p.id !== d.point_id ? p : {
            ...p, axes: Object.fromEntries(['x', 'y', 'z'].map((a) => [a, {
              ...(p.axes[a] || {}), ts: d.ts, vel_mm_s: d.vel_mm_s?.[a], disp_um: d.disp_um?.[a], acc_g: d.acc_g?.[a],
              freq_hz: d.freq_hz?.[a], temp_c: d.temp_c,
            }])),
          }),
        }
      })
    } else if (d.type === 'power' || d.type === 'temp' || d.type === 'capture') {
      qc.invalidateQueries({ queryKey: ['status', id] })
    }
  })

  const lastCap = useMemo(() => st?.points.find((p: any) => p.id === wavePoint)?.last_capture, [st, wavePoint])
  const { data: wave } = useQuery<any>({
    queryKey: ['wave', lastCap?.capture_id],
    queryFn: () => api(`/captures/${lastCap.capture_id}/waveform`, { params: { max_points: 3000 } }),
    enabled: !!lastCap?.capture_id && can('engineer'),
  })

  const captureNow = async (pointId: string) => {
    const p = machine.points.find((x: any) => x.id === pointId)
    if (!p?.gateway_id) return
    try {
      await post(`/gateways/${p.gateway_id}/commands`, { type: 'capture_now', point_id: pointId })
      message.success('Đã gửi lệnh chụp sóng – kết quả sẽ hiện sau ít phút')
    } catch (e: any) {
      message.error(e.message)
    }
  }

  if (isLoading || !st || !machine) return <div className="page"><MachineNav id={id} /><Spin /></div>
  const power = st.power
  const temps = st.temps
  return (
    <div className="page">
      <MachineNav id={id} />
      <Row gutter={[12, 12]}>
        {st.points.map((p: any) => (
          <Col xs={24} lg={12} key={p.id}>
            <Card size="small" title={<Space>{p.name}<Tag>{p.id}</Tag>{p.role !== 'bearing' && <Tag color="blue">{p.role === 'base' ? 'tham chiếu bệ' : 'nguồn máy nén'}</Tag>}</Space>}
              extra={<Space>
                {p.last_capture && <ZoneTag zone={p.last_capture.iso_zone} />}
                <Button size="small" icon={<LineChartOutlined />} onClick={() => nav(`/points/${p.id}/spectrum`)} disabled={!can('engineer')}>Phổ</Button>
                {can('analyst') && <Button size="small" icon={<CameraOutlined />} onClick={() => captureNow(p.id)}>Chụp sóng</Button>}
              </Space>}>
              <Table size="small" className="metric-table" pagination={false} rowKey="axis"
                dataSource={['x', 'y', 'z'].map((a) => ({ axis: a, role: machine.points.find((x: any) => x.id === p.id)?.axes_map?.[a], ...(p.axes[a] || {}) }))}
                columns={[
                  { title: 'Trục', dataIndex: 'axis', render: (a, r: any) => <span><b>{a.toUpperCase()}</b> <span className="muted">{r.role}</span></span> },
                  { title: 'Vận tốc (mm/s)', dataIndex: 'vel_mm_s', render: (v) => <b>{num(v)}</b> },
                  { title: 'Gia tốc RMS (g)', dataIndex: 'acc_rms_g', render: (v) => num(v, 3), responsive: ['sm'] },
                  { title: 'Chuyển vị (µm)', dataIndex: 'disp_um', render: (v) => num(v, 0) },
                  { title: 'Tần số (Hz)', dataIndex: 'freq_hz', render: (v) => num(v, 1), responsive: ['md'] },
                  { title: '60 phút', key: 'spark', width: 130, render: (_, r: any) => <Sparkline data={spark[p.id]?.[r.axis] || []} /> },
                ]} />
              <div className="muted" style={{ marginTop: 4 }}>
                Nhiệt cảm biến: <b>{num(p.axes.x?.temp_c, 1)} °C</b> · Kurtosis: {num(p.axes.x?.kurtosis, 2)} ·
                Cập nhật: {ago(p.axes.x?.ts)}
                {p.last_capture && <> · ISO {num(p.last_capture.iso_vrms_max_mm_s)} mm/s ({ago(p.last_capture.ts)})</>}
                {p.last_capture?.isolation && <> · <Tag color="cyan">đã cô lập nhiễu</Tag></>}
              </div>
            </Card>
          </Col>
        ))}
        <Col xs={24} md={12}>
          <Card size="small" title="Nhiệt độ">
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Nhiệt ổ">{num(temps?.bearing_temp_c, 1)} °C</Descriptions.Item>
              <Descriptions.Item label="Nhiệt vỏ">{num(temps?.frame_temp_c, 1)} °C</Descriptions.Item>
              <Descriptions.Item label="Môi trường">{num(temps?.ambient_temp_c, 1)} °C</Descriptions.Item>
              <Descriptions.Item label={<span>Cuộn dây <EstimateTag /></span>}>
                <b>{num(temps?.winding_temp_est_c, 1)} °C</b> (Δ {num(temps?.winding_rise_est_k, 1)} K)
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Điện">
            {power ? (
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="U (V)">{power.u_v?.map((v: number) => num(v, 0)).join(' / ')}</Descriptions.Item>
                <Descriptions.Item label="I (A)">{power.i_a?.map((v: number) => num(v, 1)).join(' / ')}</Descriptions.Item>
                <Descriptions.Item label="P (kW)">{num(power.p_kw, 1)}</Descriptions.Item>
                <Descriptions.Item label="cosφ">{num(power.pf, 2)}</Descriptions.Item>
                <Descriptions.Item label="% tải">{num(power.load_pct, 0)} %</Descriptions.Item>
                <Descriptions.Item label="Lệch dòng">{num(power.i_unbalance_pct, 1)} %</Descriptions.Item>
              </Descriptions>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đồng hồ điện" />}
          </Card>
        </Col>
        {can('engineer') && (
          <Col xs={24} lg={14}>
            <Card size="small" title="Dạng sóng thô mới nhất"
              extra={<Select size="small" value={wavePoint} onChange={setWavePoint} style={{ width: 200 }}
                options={machine.points.map((p: any) => ({ value: p.id, label: p.name }))} />}>
              {wave ? <WaveformChart axes={wave.axes} dt={wave.dt_s} /> : <Empty description="Chưa có sóng thô" />}
              {lastCap && <div className="muted">{lastCap.capture_id} · fs {num(wave?.fs_hz, 0)} Hz</div>}
            </Card>
          </Col>
        )}
        <Col xs={24} lg={can('engineer') ? 10 : 24}>
          <Card size="small" title="Đối chứng sai số (< 5%)">
            {st.accuracy.length ? (
              <Table size="small" pagination={false} rowKey="quantity" dataSource={st.accuracy} columns={[
                { title: 'Đại lượng', dataIndex: 'quantity' }, { title: 'n', dataIndex: 'n' },
                { title: 'mean e (%)', dataIndex: 'mean_pct', render: (v) => num(v) },
                { title: 'P95 e (%)', dataIndex: 'p95_pct', render: (v) => num(v) },
                { title: 'Kết luận', key: 'ok', render: (_, r: any) => r.quantity === 'temp' || r.quantity === 'peak_freq' ? '–'
                  : (r.mean_pct <= 5 && r.p95_pct <= 8 ? <Tag color="green">Đạt</Tag> : <Tag color="red">Không đạt</Tag>) },
              ]} />
            ) : <Typography.Text type="secondary">Chưa có số liệu kiểm chứng (màn hình Kiểm chứng sai số)</Typography.Text>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
