import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Empty, InputNumber, Progress, Row, Segmented, Select, Space, Spin, Statistic, Table, Tag, Typography,
} from 'antd'
import { ApiOutlined, DownloadOutlined, NodeIndexOutlined, SearchOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { api } from '../api/client'
import { MultiSpectrumChart } from '../components/charts'
import { RangePicker, lastHours, rangeParams, type Range } from '../components/common'
import { dt, num } from '../utils/format'
import MachineNav from './MachineNav'

const COLORS = ['#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f']
const METRICS = [
  { value: 'vel', label: 'Phổ vận tốc (mm/s RMS)' },
  { value: 'acc', label: 'Phổ gia tốc (g RMS)' },
  { value: 'env', label: 'Phổ bao (g)' },
]

type AnalysisRequest = {
  pointId: string
  from: string
  to: string
  axis: string
  metric: string
  tracking: string
  baseHz: number
  tolerancePct: number
  maxOrder: number
  runId: number
}

function correlation(a: number[] = [], b: number[] = []) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const x = a.slice(0, n); const y = b.slice(0, n)
  const ax = x.reduce((sum, value) => sum + value, 0) / n
  const ay = y.reduce((sum, value) => sum + value, 0) / n
  let top = 0; let xx = 0; let yy = 0
  for (let i = 0; i < n; i += 1) { const dx = x[i] - ax; const dy = y[i] - ay; top += dx * dy; xx += dx * dx; yy += dy * dy }
  return xx && yy ? top / Math.sqrt(xx * yy) : null
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function exportAnalysisCsv(result: any) {
  const summary = new Map((result.harmonics || []).map((row: any) => [row.order, row]))
  const header = [
    'Time', 'Capture ID', 'Point', 'Metric', 'Axis', 'Order tracking', 'Capture speed (Hz)', 'Speed confidence',
    '1X used (Hz)', 'FFT resolution (Hz)',
    'Order', 'Target (Hz)', 'Band min (Hz)', 'Band max (Hz)',
    'Detected', 'Peak frequency (Hz)', `Peak amplitude (${result.unit})`, `Noise floor (${result.unit})`, 'Peak/Floor',
    'Occurrence (%)', `Max amplitude (${result.unit})`, `Mean amplitude (${result.unit})`, 'Impact / interpretation',
  ]
  const rows = (result.details || []).map((row: any) => {
    const agg: any = summary.get(row.order) || {}
    return [row.ts, row.capture_id, result.point_name || result.point_id, result.type, result.axis.toUpperCase(), result.settings.tracking,
      row.capture_speed_hz, row.speed_confidence, row.base_hz_used, row.df_hz, `${row.order}X`,
      row.target_hz, row.band_hz?.[0], row.band_hz?.[1], row.detected ? 'YES' : 'NO', row.peak_hz, row.amplitude,
      row.floor, row.peak_floor_ratio, agg.occurrence_pct, agg.peak_max, agg.peak_mean, agg.effect]
  })
  const csv = '\ufeff' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.point_id}_FFT_${result.axis}_${result.settings.base_hz}Hz.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function HarmonicAnalysis({ machine }: { machine: any }) {
  const points = machine?.points || []
  const [pointId, setPointId] = useState<string>()
  const [range, setRange] = useState<Range>(lastHours(24 * 7))
  const [metric, setMetric] = useState('vel')
  const [tracking, setTracking] = useState('capture')
  const [axis, setAxis] = useState('x')
  const [baseHz, setBaseHz] = useState(50)
  const [tolerancePct, setTolerancePct] = useState(15)
  const [maxOrder, setMaxOrder] = useState(10)
  const [request, setRequest] = useState<AnalysisRequest>()

  useEffect(() => {
    if (!pointId && points.length) setPointId((points.find((p: any) => p.role === 'bearing') || points[0]).id)
  }, [pointId, points])
  useEffect(() => {
    const nominal = Number(machine?.rated_speed_rpm || 0) / 60
    if (nominal > 0) setBaseHz(Number(nominal.toFixed(3)))
  }, [machine?.rated_speed_rpm])

  const analysis = useQuery<any>({
    queryKey: ['harmonic-analysis', request],
    queryFn: () => api(`/points/${request!.pointId}/harmonic-analysis`, { params: {
      from: request!.from, to: request!.to, axis: request!.axis, type: request!.metric, tracking: request!.tracking, base_hz: request!.baseHz,
      tolerance_pct: request!.tolerancePct, max_order: request!.maxOrder, prominence_ratio: 3,
    } }),
    enabled: !!request,
  })
  const result = analysis.data
  const chartOption = result ? {
    animationDuration: 350,
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['Đỉnh lớn nhất', 'Trung bình đỉnh'] },
    grid: { left: 65, right: 24, top: 24, bottom: 55 },
    xAxis: { type: 'category', data: result.harmonics.map((x: any) => x.label), name: 'Bậc hài' },
    yAxis: { type: 'value', name: result.unit },
    series: [
      { name: 'Đỉnh lớn nhất', type: 'bar', data: result.harmonics.map((x: any) => x.peak_max || 0), itemStyle: { color: '#2563eb' } },
      { name: 'Trung bình đỉnh', type: 'line', data: result.harmonics.map((x: any) => x.peak_mean || 0), itemStyle: { color: '#d97706' }, symbolSize: 7 },
    ],
  } : undefined
  const trendOption = result ? {
    animationDuration: 300,
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 65, right: 24, top: 24, bottom: 64 },
    xAxis: { type: 'time', name: 'Thời gian' },
    yAxis: { type: 'value', name: result.unit },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 28 }],
    series: result.harmonics.filter((x: any) => x.detections).slice(0, 8).map((harmonic: any, index: number) => ({
      name: harmonic.label, type: 'line', showSymbol: false, connectNulls: false, smooth: false,
      itemStyle: { color: COLORS[index % COLORS.length] },
      data: result.details.filter((x: any) => x.order === harmonic.order && x.detected)
        .sort((a: any, b: any) => Date.parse(a.ts) - Date.parse(b.ts)).map((x: any) => [x.ts, x.amplitude]),
    })),
  } : undefined

  const run = () => {
    if (!pointId || !baseHz) return
    const p = rangeParams(range)
    setRequest({ pointId, ...p, axis, metric, tracking, baseHz, tolerancePct, maxOrder, runId: Date.now() })
  }

  return <Card className="fft-analysis-card" title="Phân tích FFT theo khoảng thời gian"
    extra={result && <Button icon={<DownloadOutlined />} onClick={() => exportAnalysisCsv(result)}>Xuất CSV đối chứng</Button>}>
    <div className="fft-filter-grid">
      <label><span>Điểm đo</span><Select value={pointId} onChange={setPointId} options={points.map((p: any) => ({ value: p.id, label: `${p.name} (${p.id})` }))} /></label>
      <label className="fft-range"><span>Khoảng thời gian</span><RangePicker value={range} onChange={setRange} /></label>
      <label><span>Metric FFT</span><Select value={metric} onChange={setMetric} options={METRICS} /></label>
      <label><span>Trục đo</span><Segmented block value={axis} onChange={(value) => setAxis(String(value))} options={['x', 'y', 'z'].map((value) => ({ value, label: value.toUpperCase() }))} /></label>
      <label><span>Order tracking</span><Select value={tracking} onChange={setTracking} options={[
        { value: 'capture', label: 'Theo tốc độ từng capture' }, { value: 'fixed', label: 'Cố định theo 1X nhập vào' },
      ]} /></label>
      <label><span>{tracking === 'capture' ? '1X dự phòng khi thiếu tốc độ' : 'Tần số 1X cố định'}</span><InputNumber value={baseHz} onChange={(value) => value && setBaseHz(value)} min={0.1} max={1000} step={0.1} addonAfter="Hz" /></label>
      <label><span>Vùng bắt quanh mỗi hài</span><InputNumber value={tolerancePct} onChange={(value) => value && setTolerancePct(value)} min={1} max={30} addonBefore="±" addonAfter="%" /></label>
      <label><span>Phân tích đến</span><InputNumber value={maxOrder} onChange={(value) => value && setMaxOrder(value)} min={1} max={30} addonAfter="X" /></label>
      <Button type="primary" size="large" icon={<SearchOutlined />} disabled={!pointId} loading={analysis.isFetching} onClick={run}>Phân tích</Button>
    </div>
    <Alert className="fft-sampling-note" type="warning" showIcon
      message="Không dùng bảng giá trị 68–72 ms để kết luận hài 50 Hz"
      description="Bảng mẫu có tần suất khoảng 14,3 mẫu/giây nên chỉ phân tích đúng đến khoảng 7,1 Hz (Nyquist). Chức năng này đọc phổ từ waveform tốc độ cao trong từng capture; để thấy đến 5X của 50 Hz, tần suất lấy mẫu phải trên 500 Hz và nên dùng 1.280 Hz trở lên." />
    {analysis.isError && <Alert type="error" showIcon message="Không phân tích được" description={(analysis.error as Error).message} style={{ marginTop: 12 }} />}
    {analysis.isFetching && <div className="fft-loading"><Spin /><span>Đang đọc và tổng hợp phổ của các capture…</span></div>}
    {result && !analysis.isFetching && <>
      <Row gutter={[12, 12]} className="fft-kpis">
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Capture đã phân tích" value={result.analyzed_captures} suffix={`/ ${result.total_captures}`} /></Card></Col>
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="1X đại diện" value={result.settings.representative_base_hz} precision={2} suffix="Hz" /></Card></Col>
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Điểm chất lượng" value={result.quality.score} suffix="/ 100" valueStyle={{ color: result.quality.score >= 80 ? '#17895d' : result.quality.score >= 60 ? '#ad7100' : '#c4383e' }} /></Card></Col>
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Độ phân giải FFT" value={result.quality.resolution_hz} precision={3} suffix="Hz" /></Card></Col>
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Độ phủ hài" value={result.quality.covered_order} suffix="X" /></Card></Col>
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Capture có tốc độ" value={result.quality.speed_coverage_pct} precision={0} suffix="%" /></Card></Col>
      </Row>
      {result.conclusions.map((text: string, index: number) => <Alert key={text} showIcon type={index === 0 ? 'info' : index === result.conclusions.length - 1 ? 'warning' : 'success'} message={text} style={{ marginBottom: 8 }} />)}
      {result.quality.issues?.length > 0 && <Alert type="warning" showIcon message="Kiểm soát chất lượng dữ liệu"
        description={<ul className="fft-issue-list">{result.quality.issues.map((text: string) => <li key={text}>{text}</li>)}</ul>} style={{ marginBottom: 10 }} />}
      {result.findings?.length > 0 && <div className="fft-findings">
        {result.findings.map((finding: any) => <Alert key={finding.code} showIcon type={finding.severity === 'warning' ? 'warning' : 'info'}
          message={<Space><b>{finding.title}</b><Tag color={finding.confidence >= 75 ? 'orange' : 'blue'}>Tin cậy {finding.confidence}%</Tag></Space>}
          description={<><div>{finding.evidence}</div><div><b>Khuyến nghị:</b> {finding.action}</div></>} />)}
      </div>}
      {result.harmonics.length ? <Row gutter={[14, 14]} style={{ marginTop: 6 }}>
        <Col xs={24} xl={10}><Card size="small" title={`Biên độ đỉnh theo bậc hài · ${result.unit}`}><ReactECharts option={chartOption} style={{ height: 350 }} /></Card></Col>
        <Col xs={24} xl={14}><Card size="small" title="Bảng đếm và đánh giá 1X–nX"><Table rowKey="order" size="small" pagination={false} scroll={{ x: 1050 }} dataSource={result.harmonics} columns={[
          { title: 'Bậc', dataIndex: 'label', fixed: 'left', width: 62, render: (value, row: any) => <Tag color={row.level === 'warning' ? 'red' : row.level === 'watch' ? 'gold' : row.level === 'info' ? 'blue' : 'default'}>{value}</Tag> },
          { title: 'Dải bắt (Hz)', width: 145, render: (_, row: any) => `${num(row.band_hz[0], 1)}–${num(row.band_hz[1], 1)}` },
          { title: 'Số lần bắt', width: 140, render: (_, row: any) => <Progress percent={row.occurrence_pct} size="small" format={() => `${row.detections}/${row.captures}`} /> },
          { title: `Đỉnh max (${result.unit})`, dataIndex: 'peak_max', width: 125, align: 'right', render: (value) => value == null ? '—' : num(value, 4) },
          { title: 'Tại Hz', dataIndex: 'peak_freq_hz', width: 85, align: 'right', render: (value) => value == null ? '—' : num(value, 2) },
          { title: `TB đỉnh (${result.unit})`, dataIndex: 'peak_mean', width: 125, align: 'right', render: (value) => value == null ? '—' : num(value, 4) },
          { title: 'So với 1X', dataIndex: 'relative_to_1x', width: 90, render: (value) => value == null ? '—' : `${num(value, 2)}×` },
          { title: 'Ảnh hưởng / gợi ý kiểm tra', dataIndex: 'effect', width: 360 },
        ]} /></Card></Col>
        {result.harmonics.some((x: any) => x.detections) && <Col span={24}><Card size="small" title="Xu hướng biên độ các hài đã phát hiện theo thời gian"><ReactECharts option={trendOption} style={{ height: 360 }} /></Card></Col>}
      </Row> : <Empty description="Không có dải hài nào nằm trong phổ khả dụng" />}
    </>}
  </Card>
}

export default function DeepAnalysis() {
  const { id = '' } = useParams()
  const [axis, setAxis] = useState('x')
  const [fmax, setFmax] = useState(500)
  const range = useMemo(() => ({ from: new Date(Date.now() - 6 * 3600000).toISOString(), to: new Date().toISOString() }), [])
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const points = machine?.points || []
  const captureQueries = useQueries({ queries: points.map((point: any) => ({
    queryKey: ['deep-captures', point.id], queryFn: () => api<any[]>(`/points/${point.id}/captures`, { params: { ...range, limit: 5 } }),
    refetchInterval: 60_000,
  })) })
  const latest = points.map((point: any, index: number) => ({ point, capture: (captureQueries[index]?.data as any[])?.[0] })).filter((item: any) => item.capture)
  const detailQueries = useQueries({ queries: latest.map((item: any) => ({
    queryKey: ['capture', item.capture.capture_id], queryFn: () => api(`/captures/${item.capture.capture_id}`),
  })) })
  const spectrumQueries = useQueries({ queries: latest.map((item: any) => ({
    queryKey: ['deep-spectrum', item.capture.capture_id, axis, fmax],
    queryFn: () => api(`/captures/${item.capture.capture_id}/spectrum`, { params: { type: 'vel', axis, fmax } }),
  })) })
  const rows = latest.map((item: any, index: number) => {
    const detail: any = detailQueries[index]?.data
    const spectrum: any = spectrumQueries[index]?.data
    const feature = detail?.features?.axes?.[axis] || {}
    return { ...item, detail, spectrum, feature, color: COLORS[index % COLORS.length] }
  })
  const source = rows.find((row: any) => row.point.role === 'source') || rows.find((row: any) => /s1/i.test(row.point.id))
  const base = rows.find((row: any) => row.point.role === 'base') || rows.find((row: any) => /s2/i.test(row.point.id))
  const targets = rows.filter((row: any) => row.point.role === 'bearing')
  const sourceRms = source?.feature?.iso_vrms_mm_s
  const baseRms = base?.feature?.iso_vrms_mm_s
  const matrix = rows.map((row: any) => {
    const rms = row.feature?.iso_vrms_mm_s
    const corr = source?.spectrum && row.spectrum ? correlation(source.spectrum.values, row.spectrum.values) : null
    return {
      key: row.point.id, point: row.point, capture: row.capture, color: row.color, rms,
      one: row.feature?.orders?.['1'], two: row.feature?.orders?.['2'], mesh: row.feature?.mesh_mm_s,
      sourceRatio: sourceRms && rms != null ? rms / sourceRms : null,
      baseRatio: baseRms && rms != null ? rms / baseRms : null, correlation: corr,
    }
  })
  const targetAssessment = targets.map((target: any) => {
    const item = matrix.find((row: any) => row.key === target.point.id)
    if (!item) return null
    const transmitted = (item.correlation || 0) >= 0.8 && (item.baseRatio || 0) <= 1.3
    const local = (item.baseRatio || 0) > 1.45 || ((item.one || 0) / Math.max(item.rms || 1, 0.001)) > 0.9
    return { ...item, transmitted, local }
  }).filter(Boolean) as any[]
  const timestamps = latest.map((item: any) => Date.parse(item.capture.ts)).filter(Number.isFinite)
  const skewMs = timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null
  const markers = rows.find((row: any) => row.spectrum)?.spectrum?.markers || []
  const spectra = rows.filter((row: any) => row.spectrum).map((row: any) => ({
    name: `${row.point.id.toUpperCase()} · ${row.point.name}`, df: row.spectrum.df_hz, values: row.spectrum.values, color: row.color,
  }))
  const complete = points.length > 1 && rows.length === points.length
  const hasRef = points.some((p: any) => p.role === 'source' || p.role === 'base')
  const applicable = points.length >= 2 && hasRef
  const roleName = (role: string) => (role === 'source' ? 'Nguồn rung (S1)' : role === 'base' ? 'Tham chiếu bệ (S2)' : 'Gối động cơ')

  return <div className="page deep-analysis-page">
    <MachineNav id={id} />
    <div className="page-hero">
      <div><div className="page-kicker">FFT & cross-channel vibration analysis</div><Typography.Title level={2} style={{ margin: 0 }}>Phân tích sâu rung động</Typography.Title><p className="page-description">Đếm và định lượng các đỉnh 1X–nX theo thời gian, sau đó đối chiếu đồng thời S1–S4 để phân biệt rung truyền và thành phần cục bộ.</p></div>
    </div>

    <HarmonicAnalysis machine={machine} />

    <div className="deep-section-title"><div><b>Đối chiếu đa điểm S1–S4</b><span>Capture mới nhất trong 6 giờ</span></div><Space><Segmented value={axis} onChange={(value) => setAxis(String(value))} options={['x', 'y', 'z'].map((value) => ({ value, label: `Trục ${value.toUpperCase()}` }))} /><Segmented value={fmax} onChange={(value) => setFmax(Number(value))} options={[250, 500, 1000].map((value) => ({ value, label: `${value} Hz` }))} /></Space></div>
    {!applicable && <Alert type="info" showIcon style={{ marginBottom: 12 }}
      message="Phân tích truyền rung chưa áp dụng cho máy này"
      description={<>Phương pháp này cần ít nhất hai cảm biến đo đồng thời, trong đó có <b>S1</b> nguồn rung hoặc <b>S2</b> bệ tham chiếu. Máy hiện có {points.length} điểm đo{hasRef ? '' : ', chưa gán vai trò nguồn/bệ'}. Phần FFT 1X–nX phía trên vẫn dùng được cho từng điểm đo.</>} />}
    {applicable && !complete && <Alert type="info" showIcon message="Đang ghép capture mới nhất của các điểm đo" description={`Đã có ${rows.length}/${points.length} điểm. Capture nhóm từ gateway sẽ cho kết quả tốt nhất.`} style={{ marginBottom: 12 }} />}
    <div className="sensor-flow">
      {rows.map((row: any, index: number) => <div className="sensor-flow-node" key={row.point.id} style={{ borderColor: row.color }}><span>{row.point.id.split('-').pop()?.toUpperCase()}</span><b>{row.point.name}</b><small>{roleName(row.point.role)} · trục {axis.toUpperCase()}</small><strong>{num(row.feature?.iso_vrms_mm_s, 2)} mm/s <small>RMS ISO</small></strong>{index < rows.length - 1 && <NodeIndexOutlined className="sensor-flow-arrow" />}</div>)}
    </div>
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={17}><Card title={`${spectra.length > 1 ? 'Phổ vận tốc chồng các điểm đo' : 'Phổ vận tốc'} · trục ${axis.toUpperCase()}`} extra={latest.length > 1 && <Tag color={skewMs != null && skewMs < 10_000 ? 'success' : 'warning'}>Lệch capture {num((skewMs ?? 0) / 1000, 2)} s</Tag>}>
        {spectra.length ? <MultiSpectrumChart spectra={spectra} markers={markers} fmax={fmax} /> : <Empty description="Chưa có phổ để so sánh" />}
      </Card></Col>
      <Col xs={24} xl={7}><Card title="Kết luận truyền rung" className="assessment-card">
        {!applicable ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Cần ≥ 2 điểm đo đồng thời có S1 hoặc S2" />
          : targetAssessment.length ? targetAssessment.map((item) => <Alert key={item.key} style={{ marginBottom: 10 }} showIcon
          type={item.local && !item.transmitted ? 'warning' : 'info'}
          message={`${item.point.id.split('-').pop()?.toUpperCase()}: ${item.transmitted ? 'thiên về rung truyền' : item.local ? 'có thành phần cục bộ' : 'cần thêm capture đồng bộ'}`}
          description={`Tương đồng phổ với S1 ${item.correlation == null ? '—' : `${num(item.correlation * 100, 0)}%`} · so S1 ${item.sourceRatio == null ? '—' : `${num(item.sourceRatio, 2)}×`} · so S2 ${item.baseRatio == null ? '—' : `${num(item.baseRatio, 2)}×`}`} />) : <Empty description="Chưa đủ S1/S2/S3/S4" />}
        {applicable && <Alert type="warning" showIcon icon={<ApiOutlined />} message="Lưu ý kỹ thuật" description="Tương đồng phổ không thay thế coherence/pha. Kết luận chính thức cần capture nhóm đồng bộ từ gateway." />}
      </Card></Col>
      <Col span={24}><Card title="Ma trận đặc trưng đa điểm"><Table rowKey="key" size="small" pagination={false} dataSource={matrix} scroll={{ x: 980 }} columns={[
        { title: 'Điểm', render: (_, row: any) => <Space><span className="series-dot" style={{ background: row.color }} /><b>{row.point.id.toUpperCase()}</b><span>{row.point.name}</span></Space> },
        { title: 'Vai trò', render: (_, row: any) => <Tag>{roleName(row.point.role)}</Tag> },
        { title: 'RMS ISO', dataIndex: 'rms', render: (value) => `${num(value, 3)} mm/s` },
        { title: '1X', dataIndex: 'one', render: (value) => `${num(value, 3)} mm/s` },
        { title: '2X', dataIndex: 'two', render: (value) => `${num(value, 3)} mm/s` },
        { title: 'f_mesh', dataIndex: 'mesh', render: (value) => value == null ? '—' : `${num(value, 3)} mm/s` },
        { title: 'So S1', dataIndex: 'sourceRatio', render: (value) => value == null ? '—' : <Progress percent={Math.min(100, Math.round(value * 100))} size="small" format={() => `${num(value, 2)}×`} /> },
        { title: 'So S2', dataIndex: 'baseRatio', render: (value) => value == null ? '—' : `${num(value, 2)}×` },
        { title: 'Tương đồng phổ', dataIndex: 'correlation', render: (value) => value == null ? '—' : `${num(value * 100, 0)}%` },
        { title: 'Capture', dataIndex: 'capture', render: (value) => <span className="muted">{dt(value.ts)}</span> },
      ]} /></Card></Col>
    </Row>
  </div>
}
