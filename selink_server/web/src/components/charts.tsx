import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Button, Segmented, Typography } from 'antd'
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

/** Round an axis maximum up to a "nice" value (1, 2, 2.5, 5 × 10^n) so labels never read 8.52 or 114.037795. */
export function niceMax(v: number) {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

/** Axis label formatter: at most 2 decimals, Vietnamese decimal comma. */
const axisNum = (v: number) => num(v, Math.abs(v) >= 10 || Number.isInteger(v) ? 0 : v % 0.5 === 0 ? 1 : 2)

/** Time series points with explicit gaps: a null is inserted where the sampling interval is exceeded
 * (more than 4× the median step), so the line breaks instead of drawing a straight bridge over missing data. */
function withGaps(data: [string, number][]): [number, number | null][] {
  const pts = data.map(([t, v]) => [vnMs(t), v] as [number, number])
  if (pts.length < 3) return pts
  const steps = pts.slice(1).map((p, i) => p[0] - pts[i][0]).sort((a, b) => a - b)
  const gap = Math.max(steps[Math.floor(steps.length / 2)] * 4, 1)
  const out: [number, number | null][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] - pts[i - 1][0] > gap) out.push([pts[i - 1][0] + 1, null])
    out.push(pts[i])
  }
  return out
}

const TIME_LABELS = { year: '{yyyy}', month: '{MM}/{yyyy}', day: '{dd}/{MM}', hour: '{HH}:{mm}', minute: '{HH}:{mm}', second: '{HH}:{mm}:{ss}', none: '{HH}:{mm}' }

export function TrendChart({ series, limits, height = 320, yName = 'mm/s', y2Name, markers = [], csvName, compact }: {
  series: Series[]; limits?: IsoLimits; height?: number; yName?: string; y2Name?: string
  markers?: { ts: string; label: string }[]; csvName?: string; compact?: boolean
}) {
  const max = Math.max(0, ...series.filter((s) => !s.yAxisIndex).flatMap((s) => s.data.map((d) => d[1])))
  // The secondary axis exists only when a series actually uses it (no empty "% tải" axis without a power meter).
  const hasY2 = !!y2Name && series.some((s) => s.yAxisIndex === 1 && s.data.length)
  const yMax = limits ? niceMax(Math.max(max * 1.1, limits.cd * 1.15)) : max > 0 ? niceMax(max * 1.1) : undefined
  const option = useMemo(() => ({
    animation: true,
    animationDuration: 350,
    animationDurationUpdate: 350,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    grid: compact ? { left: 34, right: 8, top: 8, bottom: 20 } : { left: 56, right: hasY2 ? 56 : 16, top: 40, bottom: 62 },
    tooltip: compact ? undefined : { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '—' : num(v, 2)) },
    legend: compact ? undefined : { top: 0, left: 'center', type: 'scroll' },
    dataZoom: compact ? undefined : [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: { type: 'time', axisLabel: { hideOverlap: true, fontSize: compact ? 9 : 11, formatter: TIME_LABELS } },
    yAxis: [
      { type: 'value', name: compact ? undefined : yName, nameLocation: 'middle', nameRotate: 90, nameGap: 36, min: 0, max: yMax,
        axisLabel: { fontSize: compact ? 9 : 11, formatter: axisNum } },
      ...(hasY2 ? [{ type: 'value', name: y2Name, nameLocation: 'middle', nameRotate: -90, nameGap: 40, min: 0, max: 120, splitLine: { show: false },
        axisLabel: { fontSize: 11 } }] : []),
    ],
    series: series.filter((s) => hasY2 || !s.yAxisIndex).map((s, i) => ({
      id: `trend-${s.name}`,
      name: s.name, type: 'line', showSymbol: s.data.length < 3, symbolSize: 5, connectNulls: false,
      yAxisIndex: s.yAxisIndex || 0,
      lineStyle: { width: compact ? 1.4 : 1.8, type: s.dashed ? 'dashed' : 'solid' }, color: s.color,
      data: withGaps(s.data),
      markArea: i === 0 ? isoBands(limits, yMax ?? max) : undefined,
      markLine: i === 0 && markers.length ? {
        symbol: 'none', label: { formatter: '{b}', fontSize: 10 }, lineStyle: { color: '#595959', type: 'dotted' },
        data: markers.map((m) => ({ name: m.label, xAxis: vnMs(m.ts) })),
      } : undefined,
    })),
  }), [series, limits, max, hasY2, yMax, compact, yName, y2Name, markers])

  return (
    <div>
      {csvName && (
        <div className="chart-toolbar">
          <Button size="small" icon={<DownloadOutlined />} onClick={() =>
            saveCSV(csvName, [['series', 'ts', 'value'], ...series.flatMap((s) => s.data.map(([t, v]) => [s.name, t, v]))])}>CSV</Button>
        </div>
      )}
      <ReactECharts option={option} style={{ height }} notMerge={false} lazyUpdate />
    </div>
  )
}

export type Marker = { label: string; freq_hz: number; kind?: string }
const MARKER_COLOR: Record<string, string> = { order: '#1677ff', bearing: '#cf1322', electrical: '#722ed1', mesh: '#d46b08' }

/** Fault-frequency marker lines. Markers closer than ~1.5 % of the visible band (e.g. 2X 98,8 Hz and 2×f_line 100 Hz)
 * share one line and one label; labels are horizontal, above the plot, staggered on two rows so they never overlap. */
function markerLines(markers: Marker[], fmax: number, conv: (f: number) => number = (f) => f) {
  const sorted = markers.filter((m) => conv(m.freq_hz) <= fmax).sort((a, b) => a.freq_hz - b.freq_hz)
  const groups: Marker[][] = []
  for (const m of sorted) {
    const last = groups[groups.length - 1]
    if (last && conv(m.freq_hz) - conv(last[0].freq_hz) < fmax * 0.015) last.push(m)
    else groups.push([m])
  }
  return {
    symbol: 'none', silent: false,
    data: groups.map((g, i) => {
      const color = MARKER_COLOR[g[0].kind || 'order']
      return {
        name: g.map((m) => m.label).join(' / '), xAxis: conv(g[0].freq_hz),
        lineStyle: { color, type: 'dashed', width: 1, opacity: 0.7 },
        label: {
          formatter: g.map((m) => m.label).join(' / '), position: 'end', rotate: 0, fontSize: 11, fontWeight: 600, color,
          backgroundColor: 'rgba(255,255,255,.9)', padding: [1, 3], borderRadius: 3, distance: i % 2 ? 18 : 3,
        },
      }
    }),
    tooltip: { formatter: (p: any) => `${p.name}: ${num(p.value, 1)} Hz` },
  }
}

export function SpectrumChart({ df, values, unit, markers = [], compare, height = 360, showOrders = false, speedHz, title, csvName }: {
  df: number; values: number[]; unit: string; markers?: Marker[]; compare?: { name: string; df: number; values: number[] }
  height?: number; showOrders?: boolean; speedHz?: number; title?: string; csvName?: string
}) {
  const conv = (f: number) => (showOrders && speedHz ? f / speedHz : f)
  const data = values.map((v, i) => [conv(i * df), v])
  const fmax = conv(values.length * df)
  const option = useMemo(() => ({
    animation: true,
    animationDuration: 350,
    animationDurationUpdate: 350,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    title: title ? { text: title, left: 'center', textStyle: { fontSize: 13 } } : undefined,
    grid: { left: 60, right: 28, top: title ? 78 : 62, bottom: 60 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${num(v, 4)} ${unit}`,
      axisPointer: { label: { formatter: (p: any) => (p.axisDimension === 'x' ? (showOrders ? `${num(p.value, 2)}X` : `${num(p.value, 1)} Hz`) : num(p.value, 4)) } } },
    legend: compare ? { top: 0, right: 10 } : undefined,
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: { type: 'value', name: showOrders ? 'bậc (X)' : 'Hz', max: fmax, nameGap: 6, axisLabel: { formatter: axisNum } },
    yAxis: { type: 'value', name: unit, min: 0, nameLocation: 'middle', nameRotate: 90, nameGap: 42, axisLabel: { formatter: axisNum } },
    series: [
      {
        id: 'spectrum-current',
        name: 'Hiện tại', type: 'line', showSymbol: false, data, lineStyle: { width: 1.3 }, color: '#0b4f6c',
        areaStyle: { color: 'rgba(11,79,108,.06)' },
        markLine: markerLines(markers, fmax, conv),
      },
      ...(compare ? [{
        id: 'spectrum-compare',
        name: compare.name, type: 'line', showSymbol: false, color: '#bfbfbf', lineStyle: { width: 1 },
        data: compare.values.map((v, i) => [conv(i * compare.df), v]),
      }] : []),
    ],
  }), [df, values, unit, markers, compare, showOrders, speedHz, title, fmax, data, conv])

  return (
    <div>
      {csvName && (
        <div className="chart-toolbar">
          <Button size="small" icon={<DownloadOutlined />}
            onClick={() => saveCSV(csvName, [['freq_hz', `value_${unit}`], ...values.map((v, i) => [i * df, v])])}>CSV</Button>
        </div>
      )}
      <ReactECharts option={option} style={{ height }} notMerge={false} lazyUpdate />
    </div>
  )
}

export function MultiSpectrumChart({ spectra, markers = [], fmax = 500, height = 390, unit = 'mm/s' }: {
  spectra: { name: string; df: number; values: number[]; color: string }[]
  markers?: Marker[]; fmax?: number; height?: number; unit?: string
}) {
  const option = useMemo(() => ({
    animation: true,
    animationDuration: 350,
    animationDurationUpdate: 350,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    color: spectra.map((item) => item.color),
    grid: { left: 58, right: 28, top: 84, bottom: 62 },
    legend: { top: 4, type: 'scroll' },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${num(value, 4)} ${unit}` },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: { type: 'value', name: 'Hz', min: 0, max: fmax, axisLabel: { formatter: axisNum } },
    yAxis: { type: 'value', name: unit, min: 0, scale: true, nameLocation: 'middle', nameRotate: 90, nameGap: 42, axisLabel: { formatter: axisNum } },
    series: spectra.map((spectrum, index) => ({
      id: `multi-spec-${spectrum.name}`,
      name: spectrum.name, type: 'line', showSymbol: false, sampling: 'lttb', lineStyle: { width: 1.6 },
      data: spectrum.values.slice(0, Math.floor(fmax / spectrum.df) + 1).map((value, i) => [i * spectrum.df, value]),
      markLine: index === 0 ? markerLines(markers, fmax) : undefined,
    })),
  }), [spectra, markers, fmax, unit])

  return <ReactECharts option={option} style={{ height }} notMerge={false} lazyUpdate />
}

const AXIS_COLOR: Record<string, string> = { x: '#1677ff', y: '#2e9d4f', z: '#e8590c' }
const AXIS_LABEL: Record<string, string> = { x: 'X ngang', y: 'Y dọc trục', z: 'Z đứng' }

/** Acceleration waveform. One axis at a time by default (three overlaid 2 kS/s traces read as a solid band),
 * opened on the first ~100 ms so individual cycles are visible; the slider pans/zooms over the whole frame. */
export function WaveformChart({ axes, dt, unit = 'g', height = 260, defaultAxis = 'x', windowS = 0.1 }: {
  axes: Record<string, number[]>; dt: number; unit?: string; height?: number; defaultAxis?: string; windowS?: number
}) {
  const names = Object.keys(axes)
  const [sel, setSel] = useState<string>(names.includes(defaultAxis) ? defaultAxis : names[0] || 'x')
  const total = Math.max(0, ...names.map((a) => axes[a]?.length || 0)) * dt
  const defaultEndPct = total > 0 ? Math.min(100, (windowS / total) * 100) : 100

  // Track zoom position so switching axes does NOT reset the user's pan/zoom position
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number }>({ start: 0, end: defaultEndPct })
  const prevAxesRef = useRef(axes)

  useEffect(() => {
    if (prevAxesRef.current !== axes) {
      prevAxesRef.current = axes
      setZoomRange({ start: 0, end: defaultEndPct })
    }
  }, [axes, defaultEndPct])

  useEffect(() => {
    if (defaultAxis && names.includes(defaultAxis) && !names.includes(sel)) {
      setSel(defaultAxis)
    }
  }, [defaultAxis, names, sel])

  const onEvents = useMemo(() => ({
    datazoom: (evt: any) => {
      const s = evt.start ?? evt.batch?.[0]?.start
      const e = evt.end ?? evt.batch?.[0]?.end
      if (s != null && e != null) {
        setZoomRange({ start: s, end: e })
      }
    },
  }), [])

  const option = useMemo(() => {
    const isAll = sel === 'all'
    return {
      animation: true,
      animationDuration: 300,
      animationDurationUpdate: 300,
      animationEasing: 'cubicOut',
      animationEasingUpdate: 'cubicOut',
      grid: { left: 52, right: 16, top: 16, bottom: 56 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: number) => `${num(v, 3)} ${unit}`,
        axisPointer: {
          label: {
            formatter: (p: any) => (p.axisDimension === 'x' ? `${num(p.value * 1000, 1)} ms` : num(p.value, 3)),
          },
        },
      },
      dataZoom: [
        { type: 'inside', start: zoomRange.start, end: zoomRange.end },
        {
          type: 'slider',
          height: 18,
          bottom: 8,
          start: zoomRange.start,
          end: zoomRange.end,
          labelFormatter: (v: number) => `${num(v * 1000, 0)} ms`,
        },
      ],
      xAxis: {
        type: 'value',
        name: 'ms',
        nameGap: 6,
        max: 'dataMax',
        axisLabel: { formatter: (v: number) => num(v * 1000, 0) },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { align: 'left' },
        axisLabel: { formatter: axisNum },
      },
      series: names.map((a) => {
        const isShown = isAll || sel === a
        return {
          id: `waveform-${a}`,
          name: AXIS_LABEL[a] || a.toUpperCase(),
          type: 'line',
          showSymbol: false,
          color: AXIS_COLOR[a],
          lineStyle: {
            width: isAll ? 1 : 1.5,
            opacity: isShown ? (isAll ? 0.85 : 1) : 0,
          },
          data: isShown && axes[a] ? axes[a].map((v, i) => [i * dt, v]) : [],
        }
      }),
    }
  }, [axes, dt, unit, names, sel, zoomRange])

  return (
    <div>
      <div className="chart-toolbar chart-toolbar-left">
        <Segmented
          size="small"
          value={sel}
          onChange={(v) => setSel(String(v))}
          options={[
            ...names.map((a) => ({
              value: a,
              label: (
                <span>
                  <span className="series-dot" style={{ background: AXIS_COLOR[a], marginRight: 5 }} />
                  {AXIS_LABEL[a] || a.toUpperCase()}
                </span>
              ),
            })),
            { value: 'all', label: 'Cả 3 trục' },
          ]}
        />
        <span className="muted">Khung {num(total * 1000, 0)} ms · kéo thanh trượt để xem toàn bộ</span>
      </div>
      <ReactECharts
        option={option}
        style={{ height }}
        notMerge={false}
        lazyUpdate
        onEvents={onEvents}
      />
    </div>
  )
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

/** Health gauge. The caption sits below the chart in HTML (an in-chart title collided with the arc ends);
 * without a value the arc is grey and the centre says so instead of showing a bare dash. */
export function Gauge({ value, title, height = 180, emptyText = 'Chưa đủ dữ liệu' }: {
  value?: number | null; title: string; height?: number; emptyText?: string
}) {
  const has = value != null
  const option = {
    series: [{
      type: 'gauge', min: 0, max: 100, radius: '92%', center: ['50%', '56%'], progress: { show: has, width: 12 },
      axisLine: { lineStyle: { width: 12, color: has ? [[0.4, '#cf1322'], [0.7, '#fa8c16'], [1, '#2e9d4f']] : [[1, '#e4e8ef']] } },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      title: { show: false },
      detail: has ? { valueAnimation: true, fontSize: 28, fontWeight: 700, offsetCenter: [0, '6%'], formatter: '{value}' }
        : { fontSize: 13, color: '#8190a6', offsetCenter: [0, '6%'], formatter: emptyText },
      data: [{ value: has ? Math.round(value as number) : 0 }],
    }],
  }
  return (
    <div className="gauge-wrap">
      <ReactECharts option={option} style={{ height }} />
      <div className="gauge-caption">{title}</div>
    </div>
  )
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
