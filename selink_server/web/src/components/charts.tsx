import ReactECharts from 'echarts-for-react'
import { Button, Space, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { ZONE_BG, num, saveCSV, vnMs } from '../utils/format'

export type IsoLimits = { ab: number; bc: number; cd: number }

/** ISO zone background bands (spec 7.3): A light green, B light yellow, C light orange, D light red. */
function isoBands(l?: IsoLimits, max = 0) {
  if (!l) return undefined
  const top = Math.max(max * 1.2, l.cd * 1.3)
  return {
    silent: true,
    data: [
      [{ yAxis: 0, itemStyle: { color: ZONE_BG.A } }, { yAxis: l.ab }],
      [{ yAxis: l.ab, itemStyle: { color: ZONE_BG.B } }, { yAxis: l.bc }],
      [{ yAxis: l.bc, itemStyle: { color: ZONE_BG.C } }, { yAxis: l.cd }],
      [{ yAxis: l.cd, itemStyle: { color: ZONE_BG.D } }, { yAxis: top }],
    ],
  }
}

type Series = { name: string; data: [string, number][]; yAxisIndex?: number; color?: string; dashed?: boolean }

export function TrendChart({ series, limits, height = 320, yName = 'mm/s', y2Name, markers = [], csvName, compact }: {
  series: Series[]; limits?: IsoLimits; height?: number; yName?: string; y2Name?: string
  markers?: { ts: string; label: string }[]; csvName?: string; compact?: boolean
}) {
  const max = Math.max(0, ...series.filter((s) => !s.yAxisIndex).flatMap((s) => s.data.map((d) => d[1])))
  const option = {
    animation: false,
    grid: compact ? { left: 30, right: 8, top: 8, bottom: 20 } : { left: 50, right: y2Name ? 50 : 20, top: 30, bottom: 60 },
    tooltip: compact ? undefined : { trigger: 'axis', valueFormatter: (v: number) => num(v, 3) },
    legend: compact ? undefined : { top: 0 },
    dataZoom: compact ? undefined : [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: { type: 'time', axisLabel: { hideOverlap: true, fontSize: compact ? 9 : 11 } },
    yAxis: [
      { type: 'value', name: compact ? undefined : yName, min: 0, max: limits ? Math.max(max * 1.15, limits.cd * 1.2) : undefined,
        axisLabel: { fontSize: compact ? 9 : 11 } },
      ...(y2Name ? [{ type: 'value', name: y2Name, min: 0, max: 120, splitLine: { show: false } }] : []),
    ],
    series: series.map((s, i) => ({
      name: s.name, type: 'line', showSymbol: false, sampling: 'lttb', yAxisIndex: s.yAxisIndex || 0,
      lineStyle: { width: compact ? 1.2 : 1.5, type: s.dashed ? 'dashed' : 'solid' }, color: s.color,
      data: s.data.map(([t, v]) => [vnMs(t), v]),
      markArea: i === 0 ? isoBands(limits, max) : undefined,
      markLine: i === 0 && markers.length ? {
        symbol: 'none', label: { formatter: '{b}', fontSize: 10 }, lineStyle: { color: '#595959', type: 'dotted' },
        data: markers.map((m) => ({ name: m.label, xAxis: vnMs(m.ts) })),
      } : undefined,
    })),
  }
  return (
    <div>
      {csvName && (
        <Space style={{ float: 'right' }}>
          <Button size="small" icon={<DownloadOutlined />} onClick={() =>
            saveCSV(csvName, [['series', 'ts', 'value'], ...series.flatMap((s) => s.data.map(([t, v]) => [s.name, t, v]))])}>CSV</Button>
        </Space>
      )}
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
    </div>
  )
}

export type Marker = { label: string; freq_hz: number; kind?: string }
const MARKER_COLOR: Record<string, string> = { order: '#1677ff', bearing: '#cf1322', electrical: '#722ed1', mesh: '#d46b08' }

export function SpectrumChart({ df, values, unit, markers = [], compare, height = 360, showOrders = false, speedHz, title, csvName }: {
  df: number; values: number[]; unit: string; markers?: Marker[]; compare?: { name: string; df: number; values: number[] }
  height?: number; showOrders?: boolean; speedHz?: number; title?: string; csvName?: string
}) {
  const conv = (f: number) => (showOrders && speedHz ? f / speedHz : f)
  const data = values.map((v, i) => [conv(i * df), v])
  const fmax = conv(values.length * df)
  const option = {
    animation: false,
    title: title ? { text: title, left: 'center', textStyle: { fontSize: 13 } } : undefined,
    grid: { left: 60, right: 20, top: title ? 40 : 25, bottom: 60 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${num(v, 4)} ${unit}`,
      axisPointer: { label: { formatter: (p: any) => (p.axisDimension === 'x' ? (showOrders ? `${num(p.value, 2)}X` : `${num(p.value, 1)} Hz`) : num(p.value, 4)) } } },
    legend: compare ? { top: 0, right: 10 } : undefined,
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: { type: 'value', name: showOrders ? 'bậc (X)' : 'Hz', max: fmax, nameGap: 4 },
    yAxis: { type: 'value', name: unit, min: 0 },
    series: [
      {
        name: 'Hiện tại', type: 'line', showSymbol: false, data, lineStyle: { width: 1 }, color: '#0b4f6c',
        markLine: {
          symbol: 'none', silent: true,
          label: { formatter: '{b}', fontSize: 10, position: 'insideEndTop' },
          data: markers.filter((m) => conv(m.freq_hz) <= fmax).map((m) => ({
            name: `${m.label} ${num(m.freq_hz, 1)} Hz`, xAxis: conv(m.freq_hz),
            lineStyle: { color: MARKER_COLOR[m.kind || 'order'], type: 'dashed', width: 1 },
          })),
        },
      },
      ...(compare ? [{
        name: compare.name, type: 'line', showSymbol: false, color: '#bfbfbf', lineStyle: { width: 1 },
        data: compare.values.map((v, i) => [conv(i * compare.df), v]),
      }] : []),
    ],
  }
  return (
    <div>
      {csvName && (
        <Button size="small" style={{ float: 'right', position: 'relative', zIndex: 2 }} icon={<DownloadOutlined />}
          onClick={() => saveCSV(csvName, [['freq_hz', `value_${unit}`], ...values.map((v, i) => [i * df, v])])}>CSV</Button>
      )}
      <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
    </div>
  )
}

export function WaveformChart({ axes, dt, unit = 'g', height = 260 }: { axes: Record<string, number[]>; dt: number; unit?: string; height?: number }) {
  const colors: Record<string, string> = { x: '#1677ff', y: '#52c41a', z: '#fa541c' }
  const option = {
    animation: false,
    grid: { left: 55, right: 20, top: 25, bottom: 50 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${num(v, 4)} ${unit}` },
    legend: { top: 0 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 6 }],
    xAxis: { type: 'value', name: 's', max: 'dataMax' },
    yAxis: { type: 'value', name: unit },
    series: Object.entries(axes).map(([a, vals]) => ({
      name: a.toUpperCase(), type: 'line', showSymbol: false, sampling: 'lttb', color: colors[a], lineStyle: { width: 0.8 },
      data: vals.map((v, i) => [i * dt, v]),
    })),
  }
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
}

export function WaterfallChart({ rows, df, unit, height = 420 }: { rows: { ts: string; values: number[]; df_hz?: number }[]; df: number; unit: string; height?: number }) {
  const data: [number, number, number][] = []
  let vmax = 0
  rows.forEach((r, yi) => r.values.forEach((v, xi) => {
    data.push([xi, yi, v])
    vmax = Math.max(vmax, v)
  }))
  const nx = Math.max(0, ...rows.map((r) => r.values.length))
  const option = {
    animation: false,
    grid: { left: 110, right: 60, top: 20, bottom: 50 },
    tooltip: { formatter: (p: any) => `${rows[p.value[1]]?.ts.slice(0, 16)}<br/>${num(p.value[0] * df, 1)} Hz: ${num(p.value[2], 4)} ${unit}` },
    xAxis: { type: 'category', data: Array.from({ length: nx }, (_, i) => num(i * df, 0)), name: 'Hz', axisLabel: { interval: Math.ceil(nx / 12) } },
    yAxis: { type: 'category', data: rows.map((r) => new Date(r.ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })) },
    visualMap: { min: 0, max: vmax || 1, calculable: true, orient: 'vertical', right: 0, top: 'center',
      inRange: { color: ['#f7fbff', '#6baed6', '#08519c', '#fd8d3c', '#a50f15'] } },
    series: [{ type: 'heatmap', data, progressive: 5000 }],
  }
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
}

export function Gauge({ value, title, height = 180 }: { value?: number | null; title: string; height?: number }) {
  const v = value ?? 0
  const option = {
    series: [{
      type: 'gauge', min: 0, max: 100, radius: '95%', progress: { show: true, width: 12 },
      axisLine: { lineStyle: { width: 12, color: [[0.4, '#cf1322'], [0.7, '#fa8c16'], [1, '#2e9d4f']] } },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      title: { offsetCenter: [0, '70%'], fontSize: 12 },
      detail: { valueAnimation: true, fontSize: 26, offsetCenter: [0, '10%'], formatter: value == null ? '–' : '{value}' },
      data: [{ value: Math.round(v), name: title }],
    }],
  }
  return <ReactECharts option={option} style={{ height }} />
}

export function Sparkline({ data, color = '#0b4f6c', height = 36 }: { data: [string, number][]; color?: string; height?: number }) {
  if (!data.length) return <Typography.Text type="secondary">–</Typography.Text>
  const option = {
    animation: false, grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'time', show: false }, yAxis: { type: 'value', show: false, min: 'dataMin' },
    series: [{ type: 'line', showSymbol: false, data: data.map(([t, v]) => [vnMs(t), v]), lineStyle: { width: 1.2 }, color,
      areaStyle: { opacity: 0.08 } }],
  }
  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
}
