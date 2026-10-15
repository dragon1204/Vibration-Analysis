import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Col, Empty, Row, Select, Spin, Table, Tag } from 'antd'
import { DisconnectOutlined, LineChartOutlined, WifiOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { useRealtime } from '../api/realtime'
import { TrendChart, WaveformChart } from '../components/charts'
import { lastHours, rangeParams } from '../components/common'
import { ago, num } from '../utils/format'

type IsoSeries = Record<string, [string, number][]>
type Sensor = { point: any; axis: string; data: any; series: [string, number][] }

const axisName: Record<string, string> = { x: 'ngang (H)', y: 'dọc trục (A)', z: 'đứng (V)' }
const axisColor: Record<string, string> = { x: '#1677ff', y: '#2e9d4f', z: '#e8590c' }
const zoneClass: Record<string, string> = { A: 'zone-a', B: 'zone-b', C: 'zone-c', D: 'zone-d' }
const zoneText: Record<string, string> = { A: 'Tốt', B: 'Chấp nhận được', C: 'Cảnh báo', D: 'Nguy hiểm' }
/** Data older than this is not "live": the gateway sends indicators every 10 s. */
const LIVE_MAX_AGE_MS = 60_000

function getZone(value: number | null | undefined, limits: any): string | null {
  if (value == null || !limits) return null
  if (value <= limits.ab) return 'A'
  if (value <= limits.bc) return 'B'
  if (value <= limits.cd) return 'C'
  return 'D'
}

// ISO velocity RMS of one axis: the latest capture (computed from the raw waveform) first, then the
// sensor's own VRMS register when it reports one. The VX register is NOT an RMS value and is not used.
function isoValue(sensor: Sensor): { value: number | null; acc: number | null; peak: number | null; source: string } {
  const cap = sensor.point.last_capture
  const iso = cap?.axes_iso?.[sensor.axis]
  if (iso?.iso_vrms_mm_s != null) {
    return { value: iso.iso_vrms_mm_s, acc: iso.acc_rms_g ?? null, peak: iso.acc_peak_g ?? null, source: `capture ${ago(cap.ts)}` }
  }
  const vrms = sensor.data?.vel_rms_mm_s
  if (vrms) return { value: vrms, acc: sensor.data?.acc_rms_g || null, peak: null, source: 'cảm biến' }
  return { value: null, acc: null, peak: null, source: 'chờ capture đầu tiên' }
}

function Spark({ series, color }: { series: [string, number][]; color: string }) {
  if (series.length < 2) return <span>Chưa đủ dữ liệu xu hướng 60 phút</span>
  const values = series.map((item) => item[1])
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0.1)
  const t0 = Date.parse(series[0][0])
  const span = Math.max(Date.parse(series[series.length - 1][0]) - t0, 1)
  const pts = series.map(([t, v]) => `${((Date.parse(t) - t0) / span) * 100},${26 - ((v - min) / (max - min || 1)) * 23}`).join(' ')
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none"><polyline points={pts} style={{ stroke: color }} /></svg>
}

function SensorCard({ sensor, limits, onSpectrum }: { sensor: Sensor; limits: any; onSpectrum: () => void }) {
  const { value, acc, peak, source } = isoValue(sensor)
  const zone = getZone(value, limits)
  return (
    <Card className="sensor-card" size="small">
      <div className="sensor-card-head">
        <div><b>{sensor.point.name} · {axisName[sensor.axis] || sensor.axis.toUpperCase()}</b><span>Vận tốc RMS ISO · {source}</span></div>
        <button className={`zone-pill ${zone ? zoneClass[zone] : 'zone-empty'}`} onClick={onSpectrum}
          title={zone ? `Vùng ${zone} · ${zoneText[zone]} · bấm để xem phổ` : 'Chưa phân vùng'}>{zone || '—'}</button>
      </div>
      <div className="sensor-primary"><strong>{num(value, 2)}</strong><span>mm/s</span></div>
      <div className="sensor-secondary">
        <div><span>Gia tốc RMS</span><b>{num(acc, 2)} <small>g</small></b></div>
        <div><span>Gia tốc đỉnh</span><b>{num(peak, 2)} <small>g</small></b></div>
      </div>
      <div className="sensor-spark" title="Vận tốc RMS ISO · 60 phút gần nhất">
        <Spark series={sensor.series} color={axisColor[sensor.axis] || '#3270ed'} />
      </div>
    </Card>
  )
}

export default function Live() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data: status, isLoading } = useQuery<any>({ queryKey: ['status', id], queryFn: () => api(`/machines/${id}/status`), refetchInterval: 15_000 })
  const { data: overview } = useQuery<any>({ queryKey: ['shell-overview'], queryFn: () => api('/overview') })
  const [wavePoint, setWavePoint] = useState<string>()
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t) }, [])

  // ISO RMS per point × axis over the last 6 h (one value per capture) – trend chart and 60-min sparklines.
  const isoQueries: { data?: any }[] = useQueries({
    queries: (machine?.points || []).map((point: any) => ({
      queryKey: ['iso-series', point.id],
      queryFn: () => api(`/points/${point.id}/metrics`, { params: { ...rangeParams(lastHours(6)), fields: 'iso_vrms_mm_s' } }),
      refetchInterval: 60_000,
    })),
  })
  const isoSeries: Record<string, IsoSeries> = {}
  ;(machine?.points || []).forEach((point: any, i: number) => {
    const s = isoQueries[i]?.data?.series || {}
    isoSeries[point.id] = Object.fromEntries(Object.entries(s).map(([axis, f]: any) => [axis, f.iso_vrms_mm_s || []]))
  })

  useEffect(() => {
    if (!machine) return
    setWavePoint((current) => current || machine.points.find((point: any) => point.role === 'bearing')?.id || machine.points[0]?.id)
  }, [machine])

  useEffect(() => {
    if (searchParams.get('focus') === 'spectrum' && machine?.points?.length) {
      const point = machine.points.find((item: any) => item.role === 'bearing') || machine.points[0]
      nav(`/points/${point.id}/spectrum`, { replace: true })
    }
  }, [machine, nav, searchParams])

  // Push updates are applied to the cached data directly (no refetch round-trip):
  // a capture updates the per-axis ISO cards, sparklines, trend and waveform; indicators update freshness.
  useRealtime([`machine:${id}`], (message) => {
    const d = message.data || {}
    if (d.type === 'capture' && d.axes_iso) {
      qc.setQueryData(['status', id], (old: any) => old && ({
        ...old,
        points: old.points.map((p: any) => p.id !== d.point_id ? p : {
          ...p, last_capture: { ...(p.last_capture || {}), capture_id: d.capture_id, ts: d.ts, iso_zone: d.iso_zone,
            iso_vrms_max_mm_s: d.iso_vrms_max_mm_s, speed_hz: d.speed_hz, axes_iso: d.axes_iso },
        }),
      }))
      qc.setQueryData(['iso-series', d.point_id], (old: any) => {
        if (!old) return old
        const cutoff = Date.now() - 6 * 3_600_000
        const series = { ...old.series }
        Object.entries(d.axes_iso).forEach(([axis, v]: any) => {
          if (v?.iso_vrms_mm_s == null || !series[axis]) return
          const prev = series[axis].iso_vrms_mm_s || []
          series[axis] = { ...series[axis], iso_vrms_mm_s: [...prev, [d.ts, v.iso_vrms_mm_s]].filter(([t]: any) => Date.parse(t) >= cutoff) }
        })
        return { ...old, series }
      })
      return
    }
    if (d.type === 'vib') {
      qc.setQueryData(['status', id], (old: any) => old && ({
        ...old,
        points: old.points.map((p: any) => p.id !== d.point_id ? p : {
          ...p, gateway_online: true,
          axes: Object.fromEntries(['x', 'y', 'z'].map((a) => [a, { ...(p.axes?.[a] || {}), ts: d.ts }])),
        }),
      }))
      return
    }
    qc.invalidateQueries({ queryKey: ['status', id] })
  })

  const lastCapture = useMemo(() => status?.points?.find((point: any) => point.id === wavePoint)?.last_capture, [status, wavePoint])
  const { data: wave } = useQuery<any>({
    queryKey: ['wave', lastCapture?.capture_id],
    queryFn: () => api(`/captures/${lastCapture.capture_id}/waveform`, { params: { max_points: 4096 } }),
    enabled: !!lastCapture?.capture_id,
  })

  if (isLoading || !status || !machine) return <div className="page page-loading"><Spin size="large" /></div>

  const points = status.points || []
  // One card per (point, axis), no duplicates: a single-point machine shows X, Z, Y of that point;
  // with two or more points, the radial axes of the first points come first.
  const sensorDefs: [any, string][] = points.length === 1
    ? [[points[0], 'x'], [points[0], 'z'], [points[0], 'y']]
    : points.flatMap((point: any) => [[point, 'x'], [point, 'z']] as [any, string][]).slice(0, 4)
  const cutoff = Date.now() - 3_600_000
  const sensors: Sensor[] = sensorDefs.map(([point, axis]) => ({
    point, axis, data: point.axes?.[axis] || {},
    series: (isoSeries[point.id]?.[axis] || []).filter(([t]) => Date.parse(t) >= cutoff),
  }))
  const cardSpan = Math.max(6, Math.floor(24 / Math.max(sensors.length, 1)))
  const maxValue = Math.max(...sensors.map((sensor) => isoValue(sensor).value ?? 0))
  const overallZone = getZone(maxValue || null, machine.iso_limits)

  // "Live" only when indicators are fresh AND the gateway is online; otherwise say how old the data is.
  const lastTs = Math.max(0, ...points.flatMap((p: any) => Object.values(p.axes || {}).map((a: any) => Date.parse(a.ts) || 0)))
  const gatewayOnline = points.some((p: any) => p.gateway_online)
  const isLive = gatewayOnline && lastTs > 0 && Date.now() - lastTs < LIVE_MAX_AGE_MS

  const wavePointObj = machine.points.find((point: any) => point.id === wavePoint)
  const trendPoint = wavePoint || points[0]?.id
  const trendSeries = (['x', 'z', 'y'] as const).map((axis) => ({
    name: `${axisName[axis]}`, data: isoSeries[trendPoint]?.[axis] || [], color: axisColor[axis],
  })).filter((s) => s.data.length)

  const power = status.power
  const temps = status.temps
  const temperatureRows = [
    ['Ổ DE', temps?.bearing_temp_c], ['Vỏ động cơ', temps?.frame_temp_c], ['Môi trường', temps?.ambient_temp_c],
    ['Cuộn dây (ước lượng)', temps?.winding_temp_est_c],
  ].filter(([, value]) => value != null)
  const powerRows = [
    ['Điện áp dây', power?.u_v?.length ? `${num(power.u_v.reduce((a: number, b: number) => a + b, 0) / power.u_v.length, 1)} V` : '—'],
    ['Dòng điện TB', power?.i_a?.length ? `${num(power.i_a.reduce((a: number, b: number) => a + b, 0) / power.i_a.length, 1)} A` : '—'],
    ['Lệch dòng pha', power?.i_unbalance_pct != null ? `${num(power.i_unbalance_pct, 1)} %` : '—'],
    ['Công suất tác dụng', power?.p_kw != null ? `${num(power.p_kw, 1)} kW` : '—'],
    ['cosφ', num(power?.pf, 2)], ['Tải động cơ', power?.load_pct != null ? `${num(power.load_pct, 0)} %` : '—'],
  ]
  const subtitle = [
    machine.site_name || machine.site_id,
    machine.rated_power_kw ? `${num(machine.rated_power_kw, 0)} kW` : null,
    machine.rated_speed_rpm ? `${num(machine.rated_speed_rpm, 0)} v/ph` : null,
    machine.mounting === 'horizontal' ? 'Nằm ngang' : machine.mounting,
    `ISO 20816-3 nhóm ${machine.iso_group} · ${machine.foundation === 'flexible' ? 'nền mềm' : 'nền cứng'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="page live-page">
      <div className="live-titlebar">
        <div><h1>{machine.id.toUpperCase()} · {machine.name}</h1><p>{subtitle}</p></div>
        <div className="live-actions">
          <Tag className={`state-tag ${overallZone ? zoneClass[overallZone] : ''}`}>
            {overallZone ? `Vùng ${overallZone} · ${zoneText[overallZone]}` : 'Chưa phân vùng ISO'}
          </Tag>
          {isLive
            ? <Tag className="live-tag"><WifiOutlined /> Trực tiếp · cập nhật {ago(new Date(lastTs).toISOString())}</Tag>
            : <Tag className="offline-tag"><DisconnectOutlined /> {lastTs ? `Mất kết nối · dữ liệu cuối ${ago(new Date(lastTs).toISOString())}` : 'Gateway chưa gửi dữ liệu'}</Tag>}
          <Select value={id} style={{ minWidth: 190 }} onChange={(value) => nav(`/machines/${value}/live`)}
            options={(overview?.machines || []).map((item: any) => ({ value: item.id, label: item.name }))} />
        </div>
      </div>

      <Row gutter={[14, 14]}>
        {sensors.map((sensor) => <Col xs={24} sm={12} xl={cardSpan} key={`${sensor.point.id}-${sensor.axis}`}>
          <SensorCard sensor={sensor} limits={machine.iso_limits} onSpectrum={() => nav(`/points/${sensor.point.id}/spectrum`)} />
        </Col>)}
        {!sensors.length && <Col span={24}><Card><Empty description="Máy chưa được cấu hình điểm đo" /></Card></Col>}

        <Col xs={24} xl={15}>
          <Card className="dashboard-card waveform-card" title="Dạng sóng gia tốc"
            extra={machine.points.length > 1 && <Select size="small" value={wavePoint} onChange={setWavePoint} style={{ width: 150 }}
              options={machine.points.map((point: any) => ({ value: point.id, label: point.name }))} />}>
            <div className="card-subtitle">
              {wave ? `${wavePointObj?.name || ''} · ${num(wave.fs_hz / 1000, 1)} kS/s · capture ${ago(lastCapture?.ts)}` : 'Dữ liệu capture mới nhất'}
            </div>
            {wave ? <WaveformChart axes={wave.axes} dt={wave.dt_s} height={250} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dạng sóng từ gateway" />}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <div className="stack-cards">
            <Card className="data-list-card" size="small" title="Nhiệt độ">
              {temperatureRows.length ? temperatureRows.map(([label, value]) => <div className="data-row" key={String(label)}><span>{label}</span><b>{`${num(value as number, 1)} °C`}</b></div>)
                : <div className="card-empty-line">Chưa nhận dữ liệu nhiệt độ</div>}
              {temps && <div className="data-foot">Cập nhật {ago(temps.ts)}</div>}
            </Card>
            <Card className="data-list-card" size="small" title="Thông số điện">
              {power ? <>
                {powerRows.map(([label, value]) => <div className="data-row" key={String(label)}><span>{label}</span><b>{value}</b></div>)}
                <div className="data-foot">Cập nhật {ago(power.ts)}</div>
              </> : <div className="card-empty-line">Chưa kết nối đồng hồ điện · các chỉ số dòng, áp, % tải và nhiệt cuộn dây sẽ hiện khi có đồng hồ</div>}
            </Card>
          </div>
        </Col>

        <Col xs={24} xl={15}>
          <Card className="dashboard-card" title="Xu hướng vận tốc RMS ISO · 6 giờ"
            extra={trendPoint && <Button size="small" icon={<LineChartOutlined />} onClick={() => nav(`/points/${trendPoint}/spectrum`)}>Xem phổ</Button>}>
            {trendSeries.length ? <TrendChart height={270} limits={machine.iso_limits} yName="mm/s" series={trendSeries} />
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có capture trong 6 giờ qua" />}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card className="accuracy-card" size="small" title="Độ chính xác đo" extra={<span className="accuracy-requirement">Yêu cầu sai lệch &lt; 5%</span>}>
            {(status.accuracy || []).length ? <Table size="small" pagination={false} rowKey="quantity" dataSource={status.accuracy} columns={[
              { title: 'Đại lượng', dataIndex: 'quantity' }, { title: 'Số mẫu', dataIndex: 'n' },
              { title: 'Sai lệch TB', dataIndex: 'mean_pct', render: (value) => `${num(value, 1)} %` },
              { title: 'P95', dataIndex: 'p95_pct', render: (value) => `${num(value, 1)} %` },
              { title: 'Kết quả', render: (_value, row: any) => row.mean_pct <= 5 ? <Tag color="success">Đạt</Tag> : <Tag color="error">Không đạt</Tag> },
            ]} /> : <div className="card-empty-line">Chưa có biên bản đối chứng. <a onClick={() => nav('/accuracy')}>Nhập kết quả đo bằng đồng hồ →</a></div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
