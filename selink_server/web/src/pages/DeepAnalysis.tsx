import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Empty, Input, InputNumber, message, Progress, Row, Segmented, Select, Space, Spin, Statistic, Table, Tag, Typography, Upload, Dropdown } from 'antd'
import ReactECharts from 'echarts-for-react'
import { api, download } from '../api/client'
import { MultiSpectrumChart } from '../components/charts'
import { RangePicker, lastHours, rangeParams, type Range } from '../components/common'
import { dt, num, sensorCode } from '../utils/format'
import MachineNav from './MachineNav'
import { STICKY_HEAD } from '../utils/table'

const COLORS = ['#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f']
const METRICS = [
  { value: 'vel', label: 'Phổ vận tốc (mm/s RMS)' },
  { value: 'acc', label: 'Phổ gia tốc (g RMS)' },
  { value: 'disp', label: 'Phổ dịch chuyển (µm)' },
  { value: 'env', label: 'Phổ bao (g)' },
]

const VENDOR_METRICS = [
  { index: 2, label: 'Gia tốc X', unit: 'g' }, { index: 3, label: 'Gia tốc Y', unit: 'g' },
  { index: 4, label: 'Gia tốc Z', unit: 'g' }, { index: 6, label: 'Abrg1 X', unit: 'mm/s' },
  { index: 8, label: 'Abrg1 Y', unit: 'mm/s' }, { index: 10, label: 'Abrg1 Z', unit: 'mm/s' },
  { index: 11, label: 'Dịch chuyển X', unit: 'µm' }, { index: 12, label: 'Dịch chuyển Y', unit: 'µm' },
  { index: 13, label: 'Dịch chuyển Z', unit: 'µm' }, { index: 14, label: 'Abrg2 X', unit: 'mm/s' },
  { index: 16, label: 'Abrg2 Y', unit: 'mm/s' }, { index: 18, label: 'Abrg2 Z', unit: 'mm/s' },
  { index: 19, label: 'Abase X', unit: 'mm/s' }, { index: 20, label: 'Abase Y', unit: 'mm/s' },
  { index: 21, label: 'Abase Z', unit: 'mm/s' }, { index: 22, label: 'Tần số Z', unit: 'Hz' },
  { index: 24, label: 'Nhiệt độ', unit: '°C', absoluteLimit: 2 },
]

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  const source = text.replace(/^\ufeff/, '')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell.trim()); cell = ''
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
    } else cell += char
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some((value) => value !== '')) rows.push(row) }
  return rows
}

function timeOfDayMs(value: string) {
  const match = value.trim().match(/(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/)
  if (!match) return null
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000
    + Number((match[4] || '').padEnd(3, '0'))
}

function percentile(values: number[], pct: number) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * pct
  const lower = Math.floor(position); const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function compareVendorTables(reference: string[][], system: string[][], toleranceMs: number) {
  if (reference[0]?.[0] !== 'Time' || reference[0]?.[1] !== 'Device name' || reference[0].length < 25) {
    throw new Error('File hãng không đúng cấu trúc 25 cột (Time, Device name, …).')
  }
  if (system[0]?.length < 25) throw new Error('Bảng hệ thống xuất ra không đủ 25 cột.')
  const timedRows = (rows: string[][]) => {
    let dayOffset = 0; let previous = -1
    return rows.slice(1).map((cells, index) => {
      const rawTime = timeOfDayMs(cells[0] || '')
      if (rawTime == null) return null
      let time = rawTime + dayOffset
      if (previous >= 0 && time < previous - 43_200_000) { dayOffset += 86_400_000; time += 86_400_000 }
      previous = time
      return { cells, index: index + 2, time }
    }).filter((row): row is { cells: string[]; index: number; time: number } => row != null)
  }
  const refRows = timedRows(reference); const sysRows = timedRows(system)
  const used = new Set<number>(); const pairs: any[] = []
  refRows.forEach((ref) => {
    let lo = 0; let hi = sysRows.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sysRows[mid].time < ref.time) lo = mid + 1; else hi = mid }
    let left = lo - 1; let right = lo; let best = -1; let bestDistance = Number.POSITIVE_INFINITY
    while (left >= 0 || right < sysRows.length) {
      const leftDistance = left >= 0 ? Math.abs(sysRows[left].time - ref.time) : Number.POSITIVE_INFINITY
      const rightDistance = right < sysRows.length ? Math.abs(sysRows[right].time - ref.time) : Number.POSITIVE_INFINITY
      const index = leftDistance <= rightDistance ? left-- : right++
      const distance = Math.min(leftDistance, rightDistance)
      if (distance > toleranceMs || distance >= bestDistance) break
      if (!used.has(index)) { best = index; bestDistance = distance; break }
    }
    if (best >= 0 && bestDistance <= toleranceMs) { used.add(best); pairs.push({ ref, sys: sysRows[best], offsetMs: bestDistance }) }
  })
  const details: any[] = []
  const metrics = VENDOR_METRICS.map((metric) => {
    const absoluteErrors: number[] = []; const percentErrors: number[] = []
    pairs.forEach((pair) => {
      const refValue = Number(pair.ref.cells[metric.index]); const systemValue = Number(pair.sys.cells[metric.index])
      if (!Number.isFinite(refValue) || !Number.isFinite(systemValue) || pair.ref.cells[metric.index] === '' || pair.sys.cells[metric.index] === '') return
      const absoluteError = Math.abs(systemValue - refValue)
      const percentError = Math.abs(refValue) > 1e-12 ? absoluteError / Math.abs(refValue) * 100 : null
      absoluteErrors.push(absoluteError); if (percentError != null) percentErrors.push(percentError)
      details.push({ referenceTime: pair.ref.cells[0], systemTime: pair.sys.cells[0], offsetMs: pair.offsetMs,
        metric: metric.label, unit: metric.unit, reference: refValue, system: systemValue, absoluteError, percentError })
    })
    const meanAbs = absoluteErrors.length ? absoluteErrors.reduce((a, b) => a + b, 0) / absoluteErrors.length : null
    const meanPct = percentErrors.length ? percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length : null
    const p95Pct = percentile(percentErrors, 0.95); const p95Abs = percentile(absoluteErrors, 0.95)
    const passed = metric.absoluteLimit != null ? p95Abs != null && p95Abs <= metric.absoluteLimit
      : meanPct != null && p95Pct != null && meanPct <= 5 && p95Pct <= 8
    return { ...metric, samples: absoluteErrors.length, meanAbs, meanPct, p95Pct, p95Abs,
      maxPct: percentErrors.length ? Math.max(...percentErrors) : null, status: absoluteErrors.length ? (passed ? 'pass' : 'fail') : 'no_data' }
  })
  return { referenceRows: refRows.length, systemRows: sysRows.length, matchedRows: pairs.length,
    coveragePct: refRows.length ? pairs.length / refRows.length * 100 : 0, toleranceMs, metrics, details }
}

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
  prominenceRatio: number
  minRelativeTo1xPct: number
  analysisLimit: number
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
    'Occurrence (%)', `Max amplitude (${result.unit})`, `Mean amplitude (${result.unit})`, 'Trend', 'Trend (%)',
    'Longest streak', 'Persistence (%)', 'Impact / interpretation',
  ]
  const rows = (result.details || []).map((row: any) => {
    const agg: any = summary.get(row.order) || {}
    return [row.ts, row.capture_id, result.point_name || result.point_id, result.type, result.axis.toUpperCase(), result.settings.tracking,
      row.capture_speed_hz, row.speed_confidence, row.base_hz_used, row.df_hz, `${row.order}X`,
      row.target_hz, row.band_hz?.[0], row.band_hz?.[1], row.detected ? 'YES' : 'NO', row.peak_hz, row.amplitude,
      row.floor, row.peak_floor_ratio, agg.occurrence_pct, agg.peak_max, agg.peak_mean, agg.trend, agg.trend_pct,
      agg.longest_streak, agg.persistence_pct, agg.effect]
  })
  const csv = '\ufeff' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.point_id}_FFT_${result.axis}_${result.settings.base_hz}Hz.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportComparisonCsv(comparison: any, machineId: string) {
  const header = ['Reference time', 'System time', 'Offset (ms)', 'Metric', 'Unit', 'Reference', 'System', 'Absolute error', 'Error (%)']
  const rows = comparison.details.map((row: any) => [row.referenceTime, row.systemTime, row.offsetMs, row.metric, row.unit,
    row.reference, row.system, row.absoluteError, row.percentError])
  const csv = '\ufeff' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `${machineId}-doi-chieu-hang.csv`; a.click(); URL.revokeObjectURL(url)
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
  const [prominenceRatio, setProminenceRatio] = useState(3)
  const [minRelativeTo1xPct, setMinRelativeTo1xPct] = useState(5)
  const [analysisLimit, setAnalysisLimit] = useState(300)
  const [deviceName, setDeviceName] = useState('')
  const [request, setRequest] = useState<AnalysisRequest>()
  const [compareToleranceMs, setCompareToleranceMs] = useState(1000)
  const [comparison, setComparison] = useState<any>()
  const [compareLoading, setCompareLoading] = useState(false)
  const [vendorFileName, setVendorFileName] = useState('')

  useEffect(() => {
    if (!pointId && points.length) setPointId((points.find((p: any) => p.role === 'bearing') || points[0]).id)
  }, [pointId, points])
  useEffect(() => {
    const nominal = Number(machine?.rated_speed_rpm || 0) / 60
    if (nominal > 0) setBaseHz(Number(nominal.toFixed(3)))
  }, [machine?.rated_speed_rpm])
  useEffect(() => {
    const point = points.find((item: any) => item.id === pointId)
    if (point) setDeviceName(point.sensor_serial || point.gateway_id || point.id)
  }, [pointId, points])

  const analysis = useQuery<any>({
    queryKey: ['harmonic-analysis', request],
    queryFn: () => api(`/points/${request!.pointId}/harmonic-analysis`, { params: {
      from: request!.from, to: request!.to, axis: request!.axis, type: request!.metric, tracking: request!.tracking, base_hz: request!.baseHz,
      tolerance_pct: request!.tolerancePct, max_order: request!.maxOrder, prominence_ratio: request!.prominenceRatio,
      min_relative_to_1x_pct: request!.minRelativeTo1xPct, limit: request!.analysisLimit,
    } }),
    enabled: !!request,
  })
  const result = analysis.data
  const selectedPoint = points.find((point: any) => point.id === pointId)
  const secondBearing = points.find((point: any) => point.role === 'bearing' && point.id !== pointId)
  const basePoint = points.find((point: any) => point.role === 'base' && point.id !== pointId)
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
  const orderMapOption = result ? (() => {
    const times = [...new Set(result.details.map((row: any) => row.ts))].sort() as string[]
    const orders = result.harmonics.map((row: any) => row.label)
    const values = result.details.filter((row: any) => row.detected).map((row: any) => [
      times.indexOf(row.ts), row.order - 1, row.amplitude, row.peak_floor_ratio, row.peak_hz,
    ])
    const maximum = Math.max(0.000001, ...values.map((row: any) => Number(row[2]) || 0))
    return {
      animationDuration: 250,
      tooltip: { formatter: (item: any) => {
        const value = item.value
        return `<b>${orders[value[1]]}</b><br/>${dt(times[value[0]])}<br/>Biên độ: ${num(value[2], 4)} ${result.unit}<br/>Tần số: ${num(value[4], 2)} Hz<br/>Đỉnh/nền: ${num(value[3], 1)}×`
      } },
      grid: { left: 65, right: 32, top: 18, bottom: 82 },
      xAxis: { type: 'category', data: times, axisLabel: { formatter: (value: string) => dt(value), hideOverlap: true }, splitArea: { show: true } },
      yAxis: { type: 'category', data: orders, name: 'Bậc hài', splitArea: { show: true } },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'slider', xAxisIndex: 0, height: 18, bottom: 30 }],
      visualMap: { min: 0, max: maximum, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
        text: [`${result.unit} cao`, 'thấp'], inRange: { color: ['#dbeafe', '#38bdf8', '#2563eb', '#f59e0b', '#dc2626'] } },
      series: [{ type: 'heatmap', data: values, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.35)' } } }],
    }
  })() : undefined

  const run = () => {
    if (!pointId || !baseHz) return
    const p = rangeParams(range)
    setComparison(undefined); setVendorFileName('')
    setRequest({ pointId, ...p, axis, metric, tracking, baseHz, tolerancePct, maxOrder, prominenceRatio,
      minRelativeTo1xPct, analysisLimit, runId: Date.now() })
  }

  const compareVendorFile = async (file: File) => {
    if (!result) { message.warning('Hãy chạy phân tích trước khi nạp file hãng.'); return }
    if (file.size > 15 * 1024 * 1024) { message.error('File đối chiếu vượt quá giới hạn 15 MB.'); return }
    setCompareLoading(true)
    try {
      const [referenceText, systemBlob] = await Promise.all([
        file.text(),
        api<Blob>(`/machines/${machine.id}/vendor-table.csv`, { raw: true, params: {
          from: result.from, to: result.to, point_id: result.point_id, device_name: deviceName, max_skew_ms: compareToleranceMs,
        } }),
      ])
      const compared = compareVendorTables(parseCsv(referenceText), parseCsv(await systemBlob.text()), compareToleranceMs)
      if (!compared.referenceRows) throw new Error('File hãng không có dòng dữ liệu hợp lệ.')
      setComparison(compared); setVendorFileName(file.name)
      message.success(`Đã ghép ${compared.matchedRows}/${compared.referenceRows} dòng theo timestamp.`)
    } catch (error) {
      setComparison(undefined); setVendorFileName(''); message.error(`Không đối chiếu được: ${(error as Error).message}`)
    } finally { setCompareLoading(false) }
  }

  return <Card className="fft-analysis-card" title="Phân tích FFT theo khoảng thời gian"
    extra={<Dropdown trigger={['click']} menu={{
      // One export entry; each file answers a different question, so the menu says what it is for.
      // Excel files carry real date/time cells and column widths; CSV is kept for other software.
      items: [
        { type: 'group', label: 'Excel (.xlsx), mở là đọc được ngay', children: [
          { key: 'model:xlsx', label: <div><b>Dữ liệu đo theo mô hình lắp đặt</b><div className="muted">Mọi vị trí (DE, BASE…), ~2–3 dòng/giây</div></div> },
          { key: 'rms:xlsx', label: <div><b>Dữ liệu đo, mỗi kết quả RMS một dòng</b><div className="muted">~2,5 s/dòng, không lặp, dùng làm thống kê</div></div> },
          { key: 'vendor:xlsx', disabled: !pointId, label: <div><b>Bảng giống thiết bị hãng</b><div className="muted">Một điểm đo, để đối chiếu với máy đo của hãng</div></div> },
        ] },
        { type: 'group', label: 'CSV (cho phần mềm khác)', children: [
          { key: 'model:csv', label: 'Dữ liệu đo theo mô hình lắp đặt (.csv)' },
          { key: 'rms:csv', label: 'Mỗi kết quả RMS một dòng (.csv)' },
          { key: 'vendor:csv', disabled: !pointId, label: 'Bảng giống thiết bị hãng (.csv)' },
          { key: 'fft', disabled: !result, label: result ? 'Kết quả phân tích FFT (.csv)' : 'Kết quả phân tích FFT (bấm "Phân tích" trước)' },
        ] },
      ],
      onClick: ({ key }) => {
        if (key === 'fft') { if (result) exportAnalysisCsv(result); return }
        const [kind, format] = key.split(':')
        const fail = (error: any) => message.error(`Không xuất được file: ${error.message}`)
        const base = { ...rangeParams(range), max_skew_ms: 1000, format }
        if (kind === 'model') download(`/machines/${machine.id}/model-table.csv`, `${machine.id}-theo-mo-hinh.${format}`, base).catch(fail)
        if (kind === 'rms') download(`/machines/${machine.id}/model-table.csv`, `${machine.id}-theo-mo-hinh-rms.${format}`, { ...base, rows: 'rms' }).catch(fail)
        if (kind === 'vendor') download(`/machines/${machine.id}/vendor-table.csv`, `${machine.id}-${pointId}-bang-hang.${format}`, { ...base, point_id: pointId, device_name: deviceName }).catch(fail)
      },
    }}><Button type="primary">Xuất file ▾</Button></Dropdown>}>
    <div className="fft-filter-grid">
      <label><span>Điểm đo</span><Select value={pointId} onChange={setPointId} options={points.map((p: any) => ({ value: p.id, label: `${p.name} (${p.id})` }))} /></label>
      <div className="fft-range"><span>Khoảng thời gian</span><RangePicker value={range} onChange={setRange} /></div>
      <label><span>Metric FFT</span><Select value={metric} onChange={setMetric} options={METRICS} /></label>
      <label><span>Trục đo</span><Segmented block value={axis} onChange={(value) => setAxis(String(value))} options={['x', 'y', 'z'].map((value) => ({ value, label: value.toUpperCase() }))} /></label>
      <label><span>Order tracking</span><Select value={tracking} onChange={setTracking} options={[
        { value: 'capture', label: 'Theo tốc độ từng capture' }, { value: 'fixed', label: 'Cố định theo 1X nhập vào' },
      ]} /></label>
      <label><span>Tên thiết bị trong bảng hãng</span><Input value={deviceName} maxLength={64} placeholder="Ví dụ: COM31" onChange={(event) => setDeviceName(event.target.value)} /></label>
      <label><span>{tracking === 'capture' ? '1X dự phòng khi thiếu tốc độ' : 'Tần số 1X cố định'}</span><InputNumber value={baseHz} onChange={(value) => value && setBaseHz(value)} min={0.1} max={1000} step={0.1} addonAfter="Hz" /></label>
      <label><span>Vùng bắt quanh mỗi hài</span><InputNumber value={tolerancePct} onChange={(value) => value && setTolerancePct(value)} min={1} max={30} addonBefore="±" addonAfter="%" /></label>
      <label><span>Phân tích đến</span><InputNumber value={maxOrder} onChange={(value) => value && setMaxOrder(value)} min={1} max={30} addonAfter="X" /></label>
      <label><span>Ngưỡng đỉnh / nền</span><InputNumber value={prominenceRatio} onChange={(value) => value != null && setProminenceRatio(value)} min={1.2} max={10} step={0.2} addonAfter="×" /></label>
      <label><span>Biên độ tối thiểu so với 1X</span><InputNumber value={minRelativeTo1xPct} onChange={(value) => value != null && setMinRelativeTo1xPct(value)} min={0} max={100} step={1} addonAfter="%" /></label>
      <label><span>Số capture lấy mẫu</span><Select value={analysisLimit} onChange={setAnalysisLimit} options={[100, 300, 500].map((value) => ({ value, label: `${value} capture` }))} /></label>
      <Button type="primary" size="large" disabled={!pointId} loading={analysis.isFetching} onClick={run}>Phân tích</Button>
    </div>
    <Alert className="fft-sampling-note" type="warning" showIcon
      message="Không dùng bảng giá trị 68–72 ms để kết luận hài 50 Hz"
      description="Bảng mẫu có tần suất khoảng 14,3 mẫu/giây nên chỉ phân tích đúng đến khoảng 7,1 Hz (Nyquist). Chức năng này đọc phổ từ waveform tốc độ cao trong từng capture; để thấy đến 5X của 50 Hz, tần suất lấy mẫu phải trên 500 Hz và nên dùng 1.280 Hz trở lên." />
    <Alert className="vendor-export-note" type="info" showIcon message="Bảng đối chứng 25 cột đúng cấu trúc của hãng"
      description={<>Abrg1: <b>{selectedPoint?.name || pointId}</b> · Abrg2: <b>{secondBearing?.name || 'để trống nếu máy không có'}</b> · Abase: <b>{basePoint?.name || 'để trống nếu chưa gán điểm bệ'}</b>. Các kênh được ghép theo timestamp gần nhất trong 1 giây; ô không có phép đo thật được để trống.</>} />
    {analysis.isError && <Alert type="error" showIcon message="Không phân tích được" description={(analysis.error as Error).message} style={{ marginTop: 12 }} />}
    {analysis.isFetching && <div className="fft-loading"><Spin /><span>Đang đọc và tổng hợp phổ của các capture…</span></div>}
    {result && !analysis.isFetching && <>
      <Alert showIcon type={result.sampling?.metric?.median_ms <= 84 ? 'success' : result.sampling?.metric?.median_ms < 1000 ? 'info' : 'warning'}
        message={result.sampling?.metric?.median_ms < 60 ? 'Cadence metric nhanh hơn mục tiêu 68–72 ms'
          : result.sampling?.metric?.median_ms <= 84 ? 'Cadence metric đã đạt mục tiêu 68–72 ms'
          : result.sampling?.metric?.median_ms < 1000 ? 'Cadence metric đã dưới 1 giây; chưa đạt mục tiêu 70 ms'
            : 'Cadence nguồn hiện chưa đạt dưới 1 giây'}
        description={<>Metric thực tế: <b>{num(result.sampling?.metric?.median_ms, 1)} ms/dòng</b> (P95 {num(result.sampling?.metric?.p95_ms, 1)} ms); capture FFT: <b>{num(result.sampling?.capture?.median_ms, 1)} ms/capture</b>. Hệ thống không nội suy hoặc lặp giá trị để giả lập 70 ms. “Số capture đạt ngưỡng” bên dưới là tần suất xuất hiện đỉnh trong các phổ, không phải chu kỳ lấy mẫu.</>}
        style={{ marginBottom: 10 }} />
      <Alert showIcon type="info" message="Cách lấy mẫu phân tích"
        description={<>Khoảng chọn có <b>{result.total_captures}</b> capture; hệ thống chọn <b>{result.selected_captures}</b> capture phân bố đều trong toàn khoảng. Profile: {result.profiles?.map((item: any) => `${item.profile} (${item.captures})`).join(', ') || '—'}. Một bậc chỉ được tính khi đỉnh đạt ≥{num(result.settings.prominence_ratio, 1)}× nền và bậc 2X trở lên đạt ≥{num(result.settings.min_relative_to_1x_pct, 1)}% của 1X trong cùng capture.</>}
        style={{ marginBottom: 10 }} />
      <Row gutter={[12, 12]} className="fft-kpis">
        <Col xs={12} md={8} xl={4}><Card size="small"><Statistic title="Capture mẫu đã phân tích" value={result.analyzed_captures} suffix={`/ ${result.total_captures}`} /></Card></Col>
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
        <Col xs={24} xl={14}><Card size="small" title="Bảng tần suất xuất hiện 1X–nX"><Table sticky={STICKY_HEAD} rowKey="order" size="small" pagination={false} scroll={{ x: 1370 }} dataSource={result.harmonics} columns={[
          { title: 'Bậc', dataIndex: 'label', fixed: 'left', width: 62, render: (value, row: any) => <Tag color={row.level === 'warning' ? 'red' : row.level === 'watch' ? 'gold' : row.level === 'info' ? 'blue' : 'default'}>{value}</Tag> },
          { title: 'Dải bắt (Hz)', width: 145, render: (_, row: any) => `${num(row.band_hz[0], 1)}–${num(row.band_hz[1], 1)}` },
          { title: 'Capture đạt ngưỡng', width: 175, render: (_, row: any) => <span><Progress percent={row.occurrence_pct} size="small" format={() => `${row.detections}/${row.captures}`} />
            {row.rejected_below_relative_1x > 0 && <small className="muted">Loại {row.rejected_below_relative_1x} capture dưới ngưỡng so với 1X</small>}</span> },
          { title: `Đỉnh max (${result.unit})`, dataIndex: 'peak_max', width: 125, align: 'right', render: (value) => value == null ? '—' : num(value, 4) },
          { title: 'Tại Hz', dataIndex: 'peak_freq_hz', width: 85, align: 'right', render: (value) => value == null ? '—' : num(value, 2) },
          { title: `TB đỉnh (${result.unit})`, dataIndex: 'peak_mean', width: 125, align: 'right', render: (value) => value == null ? '—' : num(value, 4) },
          { title: 'So với 1X', dataIndex: 'relative_to_1x', width: 90, render: (value) => value == null ? '—' : `${num(value, 2)}×` },
          { title: 'Xu hướng', width: 125, render: (_, row: any) => row.trend === 'insufficient' ? <Tag>Chưa đủ mẫu</Tag>
            : <Tag color={row.trend === 'rising' ? 'red' : row.trend === 'falling' ? 'green' : 'blue'}>
              {row.trend === 'rising' ? 'Tăng' : row.trend === 'falling' ? 'Giảm' : 'Ổn định'} {row.trend_pct > 0 ? '+' : ''}{num(row.trend_pct, 1)}%
            </Tag> },
          { title: 'Dai dẳng', width: 125, render: (_, row: any) => <span>{row.longest_streak} capture<br/><small className="muted">{num(row.persistence_pct, 1)}% liên tiếp</small></span> },
          { title: 'Ảnh hưởng / gợi ý kiểm tra', dataIndex: 'effect', width: 360 },
        ]} /></Card></Col>
        {result.harmonics.some((x: any) => x.detections) && <Col span={24}><Card size="small" title="Xu hướng biên độ các hài đã phát hiện theo thời gian"><ReactECharts option={trendOption} style={{ height: 360 }} /></Card></Col>}
        {result.harmonics.some((x: any) => x.detections) && <Col span={24}><Card size="small" title="Bản đồ order–time · màu thể hiện biên độ đỉnh nổi bật">
          <ReactECharts option={orderMapOption} style={{ height: Math.max(360, result.harmonics.length * 27 + 150) }} />
        </Card></Col>}
      </Row> : <Empty description="Không có dải hài nào nằm trong phổ khả dụng" />}
      <Card size="small" className="vendor-compare-card" title="Đối chiếu định lượng với file của hãng" extra={<Space wrap>
        <span className="muted">Ghép thời gian ±</span><InputNumber value={compareToleranceMs} min={10} max={5000} step={10}
          onChange={(value) => value != null && setCompareToleranceMs(value)} addonAfter="ms" />
        <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={(file) => { void compareVendorFile(file); return false }}>
          <Button loading={compareLoading}>Nạp CSV hãng</Button>
        </Upload>
        {comparison && <Button onClick={() => exportComparisonCsv(comparison, machine.id)}>Xuất bảng sai số</Button>}
      </Space>}>
        <Alert type="info" showIcon message="File được xử lý tại phiên làm việc, không ghi đè dữ liệu gốc"
          description="Hệ thống ghép từng dòng theo timestamp gần nhất, tính sai số tuyệt đối, trung bình, P95 và cực đại cho từng kênh. Chuẩn mặc định: sai số trung bình ≤5%, P95 ≤8%; nhiệt độ P95 ≤2°C." />
        {comparison && <>
          <Row gutter={[12, 12]} className="vendor-compare-kpis">
            <Col xs={12} md={6}><Statistic title="File đối chiếu" value={vendorFileName} /></Col>
            <Col xs={12} md={6}><Statistic title="Dòng ghép được" value={comparison.matchedRows} suffix={`/ ${comparison.referenceRows}`} /></Col>
            <Col xs={12} md={6}><Statistic title="Độ phủ ghép" value={comparison.coveragePct} precision={1} suffix="%" valueStyle={{ color: comparison.coveragePct >= 90 ? '#17895d' : '#c4383e' }} /></Col>
            <Col xs={12} md={6}><Statistic title="Kênh đạt chuẩn" value={comparison.metrics.filter((row: any) => row.status === 'pass').length} suffix={`/ ${comparison.metrics.filter((row: any) => row.status !== 'no_data').length}`} /></Col>
          </Row>
          {comparison.coveragePct < 80 && <Alert type="warning" showIcon message="Độ phủ ghép timestamp thấp"
            description="Kiểm tra múi giờ/khoảng thời gian hoặc tăng dung sai ghép. Không nên kết luận độ chính xác khi độ phủ dưới 80%." style={{ marginBottom: 10 }} />}
          <Table sticky={STICKY_HEAD} rowKey="index" size="small" pagination={false} scroll={{ x: 930 }} dataSource={comparison.metrics} columns={[
            { title: 'Kênh / metric', dataIndex: 'label', fixed: 'left', width: 155 },
            { title: 'Số cặp', dataIndex: 'samples', width: 75, align: 'right' },
            { title: 'Sai số TB', width: 120, align: 'right', render: (_, row: any) => row.meanAbs == null ? '—' : `${num(row.meanAbs, 4)} ${row.unit}` },
            { title: 'TB (%)', dataIndex: 'meanPct', width: 95, align: 'right', render: (value, row: any) => row.absoluteLimit ? 'Theo °C' : value == null ? '—' : `${num(value, 2)}%` },
            { title: 'P95 (%)', dataIndex: 'p95Pct', width: 95, align: 'right', render: (value, row: any) => row.absoluteLimit ? `${num(row.p95Abs, 3)} °C` : value == null ? '—' : `${num(value, 2)}%` },
            { title: 'Max (%)', dataIndex: 'maxPct', width: 95, align: 'right', render: (value) => value == null ? '—' : `${num(value, 2)}%` },
            { title: 'Kết quả', dataIndex: 'status', width: 110, render: (value) => <Tag color={value === 'pass' ? 'success' : value === 'fail' ? 'error' : 'default'}>{value === 'pass' ? 'ĐẠT' : value === 'fail' ? 'KHÔNG ĐẠT' : 'KHÔNG CÓ DỮ LIỆU'}</Tag> },
          ]} />
        </>}
      </Card>
    </>}
  </Card>
}

const POS_ORDER = ['LOAD', 'DE', 'NDE', 'BASE']
const machineAlgorithms = (_machine: any, slotInfo: any): string[] | undefined => slotInfo?.model?.algorithms

export default function DeepAnalysis() {
  const { id = '' } = useParams()
  const [axis, setAxis] = useState('y')
  const [fmax, setFmax] = useState(500)
  const range = useMemo(() => ({ from: new Date(Date.now() - 6 * 3600000).toISOString(), to: new Date().toISOString() }), [])
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data: slotInfo } = useQuery<any>({ queryKey: ['sensor-slots', id], queryFn: () => api(`/machines/${id}/sensor-slots`), enabled: !!id })
  // Positions of the machine's installation model (e.g. DE + BASE), in the model's order; without a model, every point.
  const modelCodes: string[] = (slotInfo?.slots || []).map((slot: any) => String(slot.code).toUpperCase())
  const algorithms: string[] = slotInfo?.model ? (machineAlgorithms(machine, slotInfo) ?? []) : []
  const points = useMemo(() => {
    const all = (machine?.points || []) as any[]
    const inModel = modelCodes.length ? all.filter((point) => modelCodes.includes(sensorCode(point))) : all
    const order = modelCodes.length ? modelCodes : POS_ORDER
    return [...inModel].sort((a, b) => order.indexOf(sensorCode(a)) - order.indexOf(sensorCode(b)))
  }, [machine?.points, modelCodes.join(',')])
  const alpha = (() => {
    if (algorithms.length && !algorithms.includes('iso_corrected_rms')) return null
    const a = Number(machine?.meta?.base_alpha ?? 0.8)
    return a > 0 && a <= 2 ? a : null
  })()
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
  const source = rows.find((row: any) => row.point.role === 'source')
  const base = rows.find((row: any) => row.point.role === 'base')
  // Spectral similarity is measured against the model's reference: LOAD when installed, else BASE.
  const reference = source || base
  const refName = source ? 'LOAD' : base ? 'BASE' : ''
  const targets = rows.filter((row: any) => row.point.role === 'bearing')
  const sourceRms = source?.feature?.iso_vrms_mm_s
  const baseRms = base?.feature?.iso_vrms_mm_s
  const matrix = rows.map((row: any) => {
    const rms = row.feature?.iso_vrms_mm_s
    const isRef = row === reference
    const corr = reference?.spectrum && row.spectrum && !isRef ? correlation(reference.spectrum.values, row.spectrum.values) : null
    const bearing = row.point.role === 'bearing'
    // Own bearing vibration after removing the foundation part: √(DE² − (α·BASE)²).
    const own = bearing && alpha != null && rms != null && baseRms != null ? Math.sqrt(Math.max(0, rms * rms - (alpha * baseRms) ** 2)) : null
    return {
      key: row.point.id, point: row.point, capture: row.capture, color: row.color, rms, own,
      one: row.feature?.orders?.['1'], two: row.feature?.orders?.['2'], mesh: row.feature?.mesh_mm_s,
      sourceRatio: sourceRms && rms != null && row !== source ? rms / sourceRms : null,
      baseRatio: baseRms && rms != null && row !== base ? rms / baseRms : null, correlation: corr,
    }
  })
  const targetAssessment = targets.map((target: any) => {
    const item = matrix.find((row: any) => row.key === target.point.id)
    if (!item) return null
    // Transmitted: the bearing looks like the reference and is not much above what the foundation explains (α·BASE).
    const expected = alpha != null && baseRms != null ? alpha * baseRms : null
    const excess = expected && item.rms != null ? item.rms / expected : item.baseRatio
    const transmitted = (item.correlation || 0) >= 0.8 && (excess || 0) <= 1.3
    const local = (excess || 0) > 1.45 || (item.own != null && item.rms ? item.own / item.rms > 0.7 : false)
    return { ...item, transmitted, local, expected, excess }
  }).filter(Boolean) as any[]
  const timestamps = latest.map((item: any) => Date.parse(item.capture.ts)).filter(Number.isFinite)
  const skewMs = timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null
  const markers = rows.find((row: any) => row.spectrum)?.spectrum?.markers || []
  const spectra = rows.filter((row: any) => row.spectrum).map((row: any) => ({
    name: `${sensorCode(row.point)} | ${row.point.name}`, df: row.spectrum.df_hz, values: row.spectrum.values, color: row.color,
  }))
  const complete = points.length > 1 && rows.length === points.length
  const hasRef = points.some((p: any) => p.role === 'source' || p.role === 'base')
  const hasMesh = !!machine?.male_lobes
  const applicable = points.length >= 2 && hasRef
  const roleName = (role: string) => (role === 'source' ? 'Tải (LOAD)' : role === 'base' ? 'Tham chiếu bệ (BASE)' : 'Ổ đỡ (DE/NDE)')

  return <div className="page deep-analysis-page">
    <MachineNav id={id} />
    <div className="page-hero">
      <div><div className="page-kicker">FFT & cross-channel vibration analysis</div><Typography.Title level={2} style={{ margin: 0 }}>Phân tích sâu rung động</Typography.Title><p className="page-description">Đếm và định lượng các đỉnh 1X–nX theo thời gian, sau đó đối chiếu LOAD, BASE, DE và NDE để phân biệt rung truyền và thành phần cục bộ.</p></div>
    </div>

    <HarmonicAnalysis machine={machine} />

    <div className="deep-section-title"><div><b>Đối chiếu đa điểm</b><span>Capture mới nhất trong 6 giờ</span></div><Space><Segmented value={axis} onChange={(value) => setAxis(String(value))} options={['x', 'y', 'z'].map((value) => ({ value, label: `Trục ${value.toUpperCase()}` }))} /><Segmented value={fmax} onChange={(value) => setFmax(Number(value))} options={[250, 500, 1000].map((value) => ({ value, label: `${value} Hz` }))} /></Space></div>
    {!applicable && <Alert type="info" showIcon style={{ marginBottom: 12 }}
      message="Phân tích truyền rung chưa áp dụng cho máy này"
      description={<>Phương pháp này cần ít nhất hai cảm biến đo đồng thời, trong đó có <b>LOAD</b> tại tải hoặc <b>BASE</b> bệ tham chiếu. Máy hiện có {points.length} điểm đo{hasRef ? '' : ', chưa gán vai trò tải/bệ'}. Phần FFT 1X–nX phía trên vẫn dùng được cho từng điểm đo.</>} />}
    {applicable && !complete && <Alert type="info" showIcon message="Đang ghép capture mới nhất của các điểm đo" description={`Đã có ${rows.length}/${points.length} điểm. Capture nhóm từ gateway sẽ cho kết quả tốt nhất.`} style={{ marginBottom: 12 }} />}
    <div className="sensor-flow">
      {rows.map((row: any, index: number) => <div className="sensor-flow-node" key={row.point.id} style={{ borderColor: row.color }}><span>{sensorCode(row.point)}</span><b>{row.point.name}</b><small>{roleName(row.point.role)} · trục {axis.toUpperCase()}</small><strong>{num(row.feature?.iso_vrms_mm_s, 2)} mm/s <small>RMS ISO</small></strong>{index < rows.length - 1 && <span className="sensor-flow-arrow">&gt;</span>}</div>)}
    </div>
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={17}><Card title={`${spectra.length > 1 ? 'Phổ vận tốc chồng các điểm đo' : 'Phổ vận tốc'} · trục ${axis.toUpperCase()}`} extra={latest.length > 1 && <Tag color={skewMs != null && skewMs < 10_000 ? 'success' : 'warning'}>Lệch capture {num((skewMs ?? 0) / 1000, 2)} s</Tag>}>
        {spectra.length ? <MultiSpectrumChart spectra={spectra} markers={markers} fmax={fmax} /> : <Empty description="Chưa có phổ để so sánh" />}
      </Card></Col>
      <Col xs={24} xl={7}><Card title="Kết luận truyền rung" className="assessment-card">
        {!applicable ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Cần ≥ 2 điểm đo đồng thời có LOAD hoặc BASE" />
          : targetAssessment.length ? targetAssessment.map((item) => <Alert key={item.key} style={{ marginBottom: 10 }} showIcon
          type={item.local && !item.transmitted ? 'warning' : 'info'}
          message={`${sensorCode(item.point)}: ${item.transmitted ? 'thiên về rung truyền' : item.local ? 'có thành phần cục bộ' : 'cần thêm capture đồng bộ'}`}
          description={`Tương đồng phổ với ${refName} ${item.correlation == null ? '—' : `${num(item.correlation * 100, 0)}%`}${source ? ` · so LOAD ${item.sourceRatio == null ? '—' : `${num(item.sourceRatio, 2)}×`}` : ''}${item.expected != null ? ` · từ đế truyền lên α·BASE = ${num(item.expected, 3)} mm/s, đo ${num(item.rms, 3)} mm/s (${num(item.excess, 2)}×) · riêng ổ đỡ ${num(item.own, 3)} mm/s` : ''} · so BASE ${item.baseRatio == null ? '—' : `${num(item.baseRatio, 2)}×`}`} />) : <Empty description="Chưa đủ LOAD/BASE/DE/NDE" />}
        {applicable && <Alert type="warning" showIcon message="Lưu ý kỹ thuật" description="Tương đồng phổ không thay thế coherence/pha. Kết luận chính thức cần capture nhóm đồng bộ từ gateway." />}
      </Card></Col>
      <Col span={24}><Card title="Ma trận đặc trưng đa điểm"><Table sticky={STICKY_HEAD} rowKey="key" size="small" pagination={false} dataSource={matrix} scroll={{ x: 980 }} columns={[
        { title: 'Điểm', render: (_, row: any) => <Space><span className="series-dot" style={{ background: row.color }} /><b>{sensorCode(row.point)}</b><span>{row.point.name}</span></Space> },
        { title: 'Vai trò', render: (_, row: any) => <Tag>{roleName(row.point.role)}</Tag> },
        { title: 'RMS ISO', dataIndex: 'rms', render: (value) => `${num(value, 3)} mm/s` },
        ...(alpha != null && base ? [{ title: `Riêng ổ đỡ (α = ${num(alpha, 2)})`, dataIndex: 'own', render: (value: any) => value == null ? '—' : `${num(value, 3)} mm/s` }] : []),
        { title: '1X', dataIndex: 'one', render: (value) => `${num(value, 3)} mm/s` },
        { title: '2X', dataIndex: 'two', render: (value) => `${num(value, 3)} mm/s` },
        ...(hasMesh ? [{ title: 'f_mesh', dataIndex: 'mesh', render: (value: any) => value == null ? '—' : `${num(value, 3)} mm/s` }] : []),
        ...(source ? [{ title: 'So LOAD', dataIndex: 'sourceRatio', render: (value: any) => value == null ? '—' : <Progress percent={Math.min(100, Math.round(value * 100))} size="small" format={() => `${num(value, 2)}×`} /> }] : []),
        { title: 'So BASE', dataIndex: 'baseRatio', render: (value) => value == null ? '—' : `${num(value, 2)}×` },
        { title: `Tương đồng phổ với ${refName || 'tham chiếu'}`, dataIndex: 'correlation', render: (value) => value == null ? '—' : `${num(value * 100, 0)}%` },
        { title: 'Capture', dataIndex: 'capture', render: (value) => <span className="muted">{dt(value.ts)}</span> },
      ]} /></Card></Col>
    </Row>
  </div>
}
