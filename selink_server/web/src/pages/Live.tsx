import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Col, Empty, Row, Select, Spin, Tag } from 'antd'
import { api } from '../api/client'
import AddSensor from '../components/AddSensor'
import { useAuth } from '../auth'
import { useRealtime } from '../api/realtime'
import { TrendChart, WaveformChart } from '../components/charts'
import { lastHours, rangeParams } from '../components/common'
import { POSITIONS, ago, num, sensorCode } from '../utils/format'
import { templateById } from '../components/InstallationDiagram'

type IsoSeries = Record<string, [string, number][]>
type Sensor = { point: any; axis: string; data: any; series: [string, number][] }

const roleName: Record<string, string> = { radial_h: 'ngang (H)', axial: 'dọc trục (A)', radial_v: 'đứng (V)' }
const defaultRoles: Record<string, string> = { x: 'radial_h', y: 'axial', z: 'radial_v' }
/** Axis label follows the point's axes_map (physical mounting), not the sensor's axis letter. */
const axisName = (point: any, axis: string) => roleName[point?.axes_map?.[axis] || defaultRoles[axis]] || axis.toUpperCase()
const axisColor: Record<string, string> = { x: '#2f6fa8', y: '#8a63b8', z: '#c2562a' }
const ZONE_COLOR: Record<string, string> = { A: '#2fa84f', B: '#d9a406', C: '#e8710a', D: '#d62f3a' }
const ROLE_ORDER = ['radial_h', 'radial_v', 'axial']
const pointRole = (point: any): string => point?.role || 'bearing'
/** Short sensor name by mounting position (shared with every other page). */
const posLabel = (point: any, _index: number): string => sensorCode(point)
/** Temporary BASE→bearing transmission coefficient (measured overall ratio is 0.2 to 0.9 depending on direction). */
const BASE_ALPHA = 0.8
/** Gateway reports acceleration in g; the live sensor cards use engineering SI units. */
const G_TO_MM_S2 = 9806.65
/** Bearing vibration after removing the foundation contribution. */
const ownRms = (bearing: number | null, base: number | null): number | null =>
  bearing == null || base == null ? null : Math.sqrt(Math.max(0, bearing * bearing - (BASE_ALPHA * base) ** 2))
const POS_ORDER = POSITIONS
/** Sensors in a fixed order: DE, NDE, BASE, LOAD, then anything else. */
const byPosition = (points: any[]): any[] => [...points].sort((a, b) => {
  const ia = POS_ORDER.indexOf(posLabel(a, 0)), ib = POS_ORDER.indexOf(posLabel(b, 0))
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib)
})
/** Axis of a point that plays the given physical role (follows axes_map). */
const axisOfRole = (point: any, role: string): string | null =>
  (['x', 'y', 'z'] as const).find((a) => (point?.axes_map?.[a] || defaultRoles[a]) === role) || null
const zoneClass: Record<string, string> = { A: 'zone-a', B: 'zone-b', C: 'zone-c', D: 'zone-d' }
const zoneText: Record<string, string> = { A: 'Tốt', B: 'Chấp nhận được', C: 'Cảnh báo', D: 'Nguy hiểm' }
/** Fall back to the ISO capture if the fast sensor RMS stream stops. */
const LIVE_MAX_AGE_MS = 60_000

function getZone(value: number | null | undefined, limits: any): string | null {
  if (value == null || !limits) return null
  if (value <= limits.ab) return 'A'
  if (value <= limits.bc) return 'B'
  if (value <= limits.cd) return 'C'
  return 'D'
}

const ZONE_ORDER = ['A', 'B', 'C', 'D']
const ZONE_HYSTERESIS = 0.05

/** Zone with 5 % hysteresis: a value hovering on a boundary must cross it clearly before the zone flips. */
function useStableZone(value: number | null | undefined, limits: any): string | null {
  const prev = useRef<string | null>(null)
  const raw = getZone(value, limits)
  if (!raw || !limits || value == null) { prev.current = raw; return raw }
  const last = prev.current
  if (last && last !== raw) {
    const edges = [limits.ab, limits.bc, limits.cd]
    const li = ZONE_ORDER.indexOf(last), ri = ZONE_ORDER.indexOf(raw)
    // boundary between `last` and the neighbouring zone in the direction of travel
    const edge = edges[ri > li ? li : li - 1]
    const crossed = ri > li ? value > edge * (1 + ZONE_HYSTERESIS) : value < edge * (1 - ZONE_HYSTERESIS)
    if (!crossed) return last
  }
  prev.current = raw
  return raw
}

// The primary display follows the sensor's dedicated VRMS statistic register. This is not the
// instantaneous VX register. A raw-waveform ISO capture remains visible as the traceable reference.
function isoValue(sensor: Sensor): { value: number | null; acc: number | null; source: string; reference: number | null; referenceSource: string } {
  const cap = sensor.point.last_capture
  const iso = cap?.axes_iso?.[sensor.axis]
  const rmsTs = sensor.data?.rms_ts
  const sensorRms = sensor.data?.vel_rms_mm_s
  const rmsAge = rmsTs ? Date.now() - Date.parse(rmsTs) : Number.POSITIVE_INFINITY
  if (sensorRms != null && Number.isFinite(rmsAge) && rmsAge <= LIVE_MAX_AGE_MS) {
    const windowLabel = sensor.data?.rms_window_ms ? ` ${num(sensor.data.rms_window_ms / 1000, 3)} s` : ''
    return {
      value: sensorRms,
      acc: sensor.data?.acc_rms_g ?? null,
      source: `RMS trượt${windowLabel} | ${ago(rmsTs)}`,
      reference: iso?.iso_vrms_mm_s ?? null,
      referenceSource: cap?.ts ? ago(cap.ts) : '',
    }
  }
  if (iso?.iso_vrms_mm_s != null) {
    return { value: iso.iso_vrms_mm_s, acc: iso.acc_rms_g ?? null, source: `ISO capture ${ago(cap.ts)}`, reference: null, referenceSource: '' }
  }
  return { value: null, acc: null, source: 'chờ dữ liệu RMS', reference: null, referenceSource: '' }
}

/** Correct a bearing axis with the BASE value from the same physical measurement direction. */
function captureIsoValue(point: any, axis: string): ReturnType<typeof isoValue> {
  const cap = point?.last_capture
  const iso = cap?.axes_iso?.[axis]
  if (iso?.iso_vrms_mm_s != null) return { value: iso.iso_vrms_mm_s, acc: iso.acc_rms_g ?? null, source: `Last operating capture | ${ago(cap.ts)}`, reference: null, referenceSource: '' }
  return isoValue({ point, axis, data: point?.axes?.[axis] || {}, series: [] })
}

function bearingIsoValue(point: any, axis: string, basePoint?: any, operating = true): ReturnType<typeof isoValue> {
  const raw = operating ? isoValue({ point, axis, data: point?.axes?.[axis] || {}, series: [] }) : captureIsoValue(point, axis)
  if (pointRole(point) !== 'bearing' || !basePoint) return raw
  const role = point?.axes_map?.[axis] || defaultRoles[axis]
  const baseAxis = axisOfRole(basePoint, role)
  if (!baseAxis) return raw
  const foundation = operating ? isoValue({ point: basePoint, axis: baseAxis, data: basePoint?.axes?.[baseAxis] || {}, series: [] }) : captureIsoValue(basePoint, baseAxis)
  const corrected = ownRms(raw.value, foundation.value)
  return corrected == null ? raw : { ...raw, value: corrected, source: `Bearing-corrected RMS | ${raw.source}` }
}

/** ISO state is the worst valid value across all configured ISO axes, never one preferred axis. */
function worstIsoReading(point: any, basePoint?: any, operating = true): { axis: string; reading: ReturnType<typeof isoValue> } {
  const axes = (point?.iso_axes?.length ? point.iso_axes : ['x', 'y', 'z']) as string[]
  const readings = axes.map((axis) => ({ axis, reading: bearingIsoValue(point, axis, basePoint, operating) }))
  const best = readings.reduce<typeof readings[number] | null>((worst, item) => {
    if (item.reading.value == null) return worst
    return !worst || worst.reading.value == null || item.reading.value > worst.reading.value ? item : worst
  }, null)
  return best || readings[0] || { axis: 'z', reading: bearingIsoValue(point, 'z', basePoint, operating) }
}

/** Raw sensor measurement for the sensor tile. Never replace this with a derived ISO value. */
function worstRawReading(point: any): { axis: string; reading: ReturnType<typeof isoValue> } {
  const axes = (point?.iso_axes?.length ? point.iso_axes : ['x', 'y', 'z']) as string[]
  const readings = axes.map((axis) => ({ axis, reading: isoValue({ point, axis, data: point?.axes?.[axis] || {}, series: [] }) }))
  const best = readings.reduce<typeof readings[number] | null>((worst, item) => {
    if (item.reading.value == null) return worst
    return !worst || worst.reading.value == null || item.reading.value > worst.reading.value ? item : worst
  }, null)
  return best || readings[0] || { axis: 'z', reading: isoValue({ point, axis: 'z', data: point?.axes?.z || {}, series: [] }) }
}

export function AnimatedNumber({ value, decimals = 2, fallback = '—' }: { value: number | null | undefined; decimals?: number; fallback?: string }) {
  const [displayValue, setDisplayValue] = useState<number | null>(value ?? null)
  const [isUpdating, setIsUpdating] = useState(false)
  const prevValueRef = useRef(value)

  useEffect(() => {
    if (value == null) {
      setDisplayValue(null)
      prevValueRef.current = value
      return
    }
    const prev = prevValueRef.current
    prevValueRef.current = value

    if (prev == null || Math.abs(prev - value) < 1e-6) {
      setDisplayValue(value)
      return
    }

    setIsUpdating(true)
    const timer = setTimeout(() => setIsUpdating(false), 700)

    const startTime = performance.now()
    const duration = 350
    const startVal = prev
    const endVal = value

    let rafId: number
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = startVal + (endVal - startVal) * ease
      setDisplayValue(current)

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endVal)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timer)
    }
  }, [value])

  if (displayValue == null) return <span>{fallback}</span>
  return (
    <span className={`animated-num ${isUpdating ? 'num-updating' : ''}`}>
      {num(displayValue, decimals)}
    </span>
  )
}

function OverallZoneTag({ value, limits }: { value: number | null; limits: any }) {
  const zone = useStableZone(value, limits)
  return (
    <Tag className={`state-tag ${zone ? zoneClass[zone] : ''}`}>
      {zone ? `VÙNG ${zone} | ${zoneText[zone].toUpperCase()}` : 'CHƯA PHÂN VÙNG ISO'}
    </Tag>
  )
}

/** One square tile represents one physical sensor, with all of its X/Y/Z readings inside. */
function SensorOverview({ index, point, basePoint, limits, running, active, onClick }: { index: number; point: any; basePoint?: any; limits: any; running: boolean; active: boolean; onClick: () => void }) {
  // The sensor tile is a measurement display: its large number is always direct sensor RMS.
  const { axis: mainAxis, reading: main } = worstRawReading(point)
  const applicable = pointRole(point) === 'bearing'
  // Zone evaluation remains separate and may use the bearing-corrected value.
  const iso = applicable ? worstIsoReading(point, basePoint, running) : null
  const stable = useStableZone(iso?.reading.value, limits)
  const zone = applicable ? stable : null
  const edge = zone ? ZONE_COLOR[zone] : '#5d7185'
  const axes = ROLE_ORDER.map((role) => axisOfRole(point, role)).filter((axis): axis is string => !!axis)
  return (
    <Card className={`sensor-overview ${active ? 'active' : ''}`} size="small" onClick={onClick}
      style={{ '--zone': edge } as React.CSSProperties}>
      <div className="sensor-overview-head">
        <b>{posLabel(point, index)}</b>
        <span className={`overview-zone ${zone ? zoneClass[zone] : 'zone-empty'}`}>{zone ? `Vùng ${zone}` : applicable ? 'Chờ dữ liệu' : 'BASE'}</span>
      </div>
      <div className="sensor-overview-main">
        <div><span>{`RMS velocity · ${axisName(point, mainAxis)} (${mainAxis.toUpperCase()})`}</span><strong><AnimatedNumber value={main.value} decimals={2} fallback="--" /><small>mm/s</small></strong></div>
        <div className={`sensor-online ${point.gateway_online ? 'ok' : ''}`}><i />{point.gateway_online ? 'Trực tuyến' : 'Mất kết nối'}</div>
      </div>
      <div className="sensor-overview-axes">
        {axes.map((axis) => {
          const reading = isoValue({ point, axis, data: point?.axes?.[axis] || {}, series: [] })
          return <div key={axis}>
            <span>{axisName(point, axis)} ({axis.toUpperCase()})</span>
            <b><AnimatedNumber value={reading.value} decimals={2} fallback="--" /> <small>mm/s</small></b>
            <em><AnimatedNumber value={reading.acc == null ? null : reading.acc * G_TO_MM_S2} decimals={0} fallback="--" /> mm/s²</em>
          </div>
        })}
      </div>
    </Card>
  )
}

/** Same-direction RMS of every sensor side by side; the base/bearing ratio shows how much vibration reaches the foundation. */
function CompareCard({ points, status, installation }: { points: any[]; status: any[]; installation: any }) {
  const cell = (point: any, role: string): number | null => {
    const axis = axisOfRole(point, role)
    if (!axis) return null
    const sp = status.find((p: any) => p.id === point.id)
    return isoValue({ point: sp || point, axis, data: sp?.axes?.[axis] || {}, series: [] }).value
  }
  const bearing = points.find((p) => pointRole(p) === 'bearing')
  const base = points.find((p) => pointRole(p) === 'base')
  return (
    <Card className="dashboard-card" size="small" title="Sensor comparison | RMS velocity, mm/s">
      <div className="compare-layout">
      <div className="compare-data"><table className="compare-table">
        <thead>
          <tr><th>Measurement axis</th>{points.map((p, i) => <th key={p.id}>{posLabel(p, i)}<small>{p.name}</small></th>)}
            {bearing && base && <th>Base / bearing ratio</th>}
            {bearing && base && <th>Bearing-corrected RMS</th>}</tr>
        </thead>
        <tbody>
          {ROLE_ORDER.map((role) => {
            const b = bearing ? cell(bearing, role) : null
            const d = base ? cell(base, role) : null
            const ratio = b != null && d != null && b > 0.05 ? (d / b) * 100 : null
            return (
              <tr key={role}>
                <td>{{ radial_h: 'Horizontal (H)', radial_v: 'Vertical (V)', axial: 'Axial (A)' }[role]}</td>
                {points.map((p) => <td key={p.id}>{num(cell(p, role), 2)}</td>)}
                {bearing && base && <td className={ratio != null && ratio > 50 ? 'ratio-high' : ''}>{ratio != null ? `${num(ratio, 0)} %` : '--'}</td>}
                {bearing && base && <td>{num(ownRms(b, d), 2)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      <div className="compare-diagram"><img src={installation.image} alt={installation.name} /></div>
      </div>
    </Card>
  )
}

export default function Live() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const { can } = useAuth()
  const { data: machine, isFetching: isFetchingMachine } = useQuery<any>({
    queryKey: ['machine', id],
    queryFn: () => api(`/machines/${id}`),
    placeholderData: keepPreviousData,
  })
  const { data: installationModels } = useQuery<any[]>({ queryKey: ['installation-models'], queryFn: () => api('/installation-models') })
  const { data: status, isLoading: isLoadingStatus, isFetching: isFetchingStatus } = useQuery<any>({
    queryKey: ['status', id],
    queryFn: () => api(`/machines/${id}/status`),
    // WebSocket is primary; this is a safety net if a proxy/network drops it.
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  })
  const { data: overview } = useQuery<any>({ queryKey: ['shell-overview'], queryFn: () => api('/overview') })
  const { data: runtime } = useQuery<any>({
    queryKey: ['runtime', id], queryFn: () => api(`/machines/${id}/runtime`, { params: rangeParams(lastHours(24)) }),
    refetchInterval: 30_000, placeholderData: keepPreviousData,
  })
  const [wavePoint, setWavePoint] = useState<string>()
  const [, setTick] = useState(0)
  // Arrival time (browser clock) of the last live push: immune to browser/server clock skew.
  const lastPushAt = useRef(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t) }, [])

  // ISO RMS per point × axis over the last 6 h (one value per capture) – trend chart and 60-min sparklines.
  const isoQueries: { data?: any }[] = useQueries({
    queries: (machine?.points || []).map((point: any) => ({
      queryKey: ['iso-series', point.id],
      queryFn: () => api(`/points/${point.id}/metrics`, { params: { ...rangeParams(lastHours(6)), fields: 'iso_vrms_mm_s' } }),
      refetchInterval: 60_000,
      placeholderData: keepPreviousData,
    })),
  })
  const isoSeries: Record<string, IsoSeries> = {}
  ;(machine?.points || []).forEach((point: any, i: number) => {
    const s = isoQueries[i]?.data?.series || {}
    isoSeries[point.id] = Object.fromEntries(Object.entries(s).map(([axis, f]: any) => [axis, f.iso_vrms_mm_s || []]))
  })

  useEffect(() => {
    if (!machine?.points?.length) return
    const exists = machine.points.some((point: any) => point.id === wavePoint)
    if (!exists || !wavePoint) {
      setWavePoint(machine.points.find((point: any) => point.role === 'bearing')?.id || machine.points[0]?.id)
    }
  }, [machine, wavePoint])

  useEffect(() => {
    if (searchParams.get('focus') === 'spectrum' && machine?.points?.length) {
      const point = machine.points.find((item: any) => item.role === 'bearing') || machine.points[0]
      nav(`/points/${point.id}/spectrum`, { replace: true })
    }
  }, [machine, nav, searchParams])

  // Push updates are applied to the cached data directly (no refetch round-trip):
  // a capture updates the ISO reference, while vibstat updates the fast RMS cards once per second.
  useRealtime([`machine:${id}`], (message) => {
    const d = message.data || {}
    if (d.type === 'vib' || d.type === 'vibstat' || d.type === 'capture') lastPushAt.current = Date.now()
    if (d.type === 'run') {
      qc.setQueryData(['status', id], (old: any) => old && ({ ...old, run_state: { ts: d.ts, running: d.running, source: d.source } }))
      qc.invalidateQueries({ queryKey: ['runtime', id] })
      return
    }
    if (d.type === 'vib') {
      qc.setQueryData(['status', id], (old: any) => old && ({
        ...old,
        points: old.points.map((point: any) => point.id !== d.point_id ? point : {
          ...point,
          gateway_online: true,
          axes: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, { ...(point.axes?.[axis] || {}), ts: d.ts }])),
        }),
      }))
      return
    }
    if (d.type === 'vibstat' && d.source === 'edge_raw_iso' && d.axes) {
      qc.setQueryData(['status', id], (old: any) => old && ({
        ...old,
        points: old.points.map((point: any) => point.id !== d.point_id ? point : {
          ...point,
          gateway_online: true,
          axes: Object.fromEntries(['x', 'y', 'z'].map((axis) => {
            const fast = d.axes?.[axis]
            return [axis, fast ? { ...(point.axes?.[axis] || {}), ...fast, rms_ts: d.ts, rms_window_ms: d.window_ms } : (point.axes?.[axis] || {})]
          })),
        }),
      }))
      return
    }
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
    qc.invalidateQueries({ queryKey: ['status', id] })
  })

  const lastCapture = useMemo(() => status?.points?.find((point: any) => point.id === wavePoint)?.last_capture, [status, wavePoint])
  const { data: wave, isFetching: isFetchingWave } = useQuery<any>({
    queryKey: ['wave', lastCapture?.capture_id],
    queryFn: () => api(`/captures/${lastCapture.capture_id}/waveform`, { params: { max_points: 4096 } }),
    enabled: !!lastCapture?.capture_id,
    placeholderData: keepPreviousData,
  })

  // Machine metadata and live status are fetched independently. Either request
  // may finish first, so never render the dashboard until both are available.
  // The previous condition only waited when `machine` was missing and crashed
  // on `status.points` when the machine request won the race.
  const isInitialLoading = isLoadingStatus || !status || !machine
  if (isInitialLoading) return <div className="page page-loading"><Spin size="large" /></div>

  const points = byPosition(status.points || [])
  const basePoint = points.find((point: any) => pointRole(point) === 'base')
  const isRunning = status.run_state?.running ?? status.power?.running ?? true
  const installation = templateById(machine.meta?.installation_template, installationModels)
  const selPoint = points.find((point: any) => point.id === wavePoint) || points[0]
  const selMeta = machine.points.find((point: any) => point.id === selPoint?.id) || selPoint
  const selApplicable = pointRole(selPoint) === 'bearing'
  // Overall ISO state: worst valid RMS value across every configured ISO axis of every bearing.
  const maxValue = Math.max(0, ...points.filter((point: any) => pointRole(point) === 'bearing')
    .map((point: any) => worstIsoReading(point, basePoint, isRunning).reading.value ?? 0))

  // "Live" only when indicators are fresh AND the gateway is online; otherwise say how old the data is.
  const dataTs = Math.max(0, ...points.flatMap((p: any) => Object.values(p.axes || {}).map((a: any) => Date.parse(a.ts) || 0)))
  const gatewayOnline = points.some((p: any) => p.gateway_online)
  const pushFresh = lastPushAt.current > 0 && Date.now() - lastPushAt.current < LIVE_MAX_AGE_MS
  const lastTs = pushFresh ? lastPushAt.current : dataTs
  const isLive = gatewayOnline && lastTs > 0 && Date.now() - lastTs < LIVE_MAX_AGE_MS

  const wavePointObj = machine.points.find((point: any) => point.id === wavePoint)
  const trendPoint = wavePoint || points[0]?.id
  const trendSeries = (['x', 'z', 'y'] as const).map((axis) => ({
    name: axisName(machine.points.find((q: any) => q.id === trendPoint), axis), data: isoSeries[trendPoint]?.[axis] || [], color: axisColor[axis],
  })).filter((s) => s.data.length)

  const power = status.power
  const temps = status.temps
  const temperatureRows = [
    ['Sensor temperature', temps?.sensor_temp_c], ['Bearing housing (PT100)', temps?.bearing_temp_c],
    ['Motor housing (PT100)', temps?.frame_temp_c], ['Ambient', temps?.ambient_temp_c],
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
    `ISO 20816-3 nhóm ${machine.iso_group} | ${machine.foundation === 'flexible' ? 'nền mềm' : 'nền cứng'}`,
  ].filter(Boolean).join(' | ')

  // Background status polling (every 5 s) must not dim the page; only a machine switch does.
  const isSwitching = isFetchingMachine || (isFetchingStatus && !status)

  return (
    <>
      <div className={`machine-switch-loader ${isSwitching ? 'loading' : ''}`} />
      <div className={`page live-page ${isSwitching ? 'page-updating' : ''}`}>
        <div className="live-titlebar">
          <div><h1>{machine.id.toUpperCase()} | {machine.name}</h1><p>{subtitle}</p></div>
          <div className="live-actions">
            <OverallZoneTag value={maxValue || null} limits={machine.iso_limits} />
            {runtime && <Tag className="runtime-tag">RUN {num(runtime.run_seconds / 3600, 1)} h · RATE {num(runtime.rate_pct, 1)} %</Tag>}
            {isLive
              ? <Tag className="live-tag">TRỰC TIẾP | cập nhật {ago(new Date(lastTs).toISOString())}</Tag>
              : <Tag className="offline-tag">{lastTs ? `MẤT KẾT NỐI | dữ liệu cuối ${ago(new Date(lastTs).toISOString())}` : 'GATEWAY CHƯA GỬI DỮ LIỆU'}</Tag>}
            {can('admin') && <AddSensor machineId={id} />}
            <label className="machine-picker">
              <span>Động cơ</span>
              <Select value={id} showSearch optionFilterProp="label" style={{ minWidth: 260 }} onChange={(value) => nav(`/machines/${value}/live`)}
                options={(overview?.machines || []).map((item: any) => ({ value: item.id, label: `${item.name} (${String(item.id).toUpperCase()})` }))} />
            </label>
          </div>
        </div>

        <Row gutter={[14, 14]}>
          {points.map((point: any, i: number) => <Col xs={24} md={12} key={point.id}>
            <SensorOverview index={i} point={point} basePoint={basePoint} limits={machine.iso_limits} running={isRunning} active={point.id === selPoint?.id}
              onClick={() => setWavePoint(point.id)} />
          </Col>)}
          {!points.length && <Col span={24}><Card><Empty description="Máy chưa được cấu hình điểm đo" /></Card></Col>}

          <Col span={24}>
            <Card className="dashboard-card trend-inline" size="small" title={`Xu hướng vận tốc RMS ISO | 6 giờ | ${posLabel(selMeta, 0)}`}
              extra={trendPoint && <Button size="small" onClick={() => nav(`/points/${trendPoint}/spectrum`)}>Xem phổ</Button>}>
              {trendSeries.length ? <TrendChart height={220} limits={selApplicable ? machine.iso_limits : undefined} yName="mm/s" series={trendSeries} />
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có capture trong 6 giờ qua" />}
            </Card>
          </Col>

          {points.length > 1 && <Col span={24}><CompareCard points={byPosition(machine.points)} status={points} installation={installation} /></Col>}

          <Col xs={24} xl={15}>
            <Card className="dashboard-card waveform-card" title="Dạng sóng gia tốc">
              <div className="card-subtitle">
                {wave ? `${wavePointObj?.name || ''} | ${num(wave.fs_hz / 1000, 1)} kS/s | capture ${ago(lastCapture?.ts)}` : 'Dữ liệu capture mới nhất'}
              </div>
              <div className={`waveform-chart-wrap ${isFetchingWave ? 'chart-loading' : ''}`}>
                {isFetchingWave && (
                  <div className="waveform-loading-overlay">
                    <Spin size="small" /> <span>Đang cập nhật...</span>
                  </div>
                )}
                {wave ? <WaveformChart axes={wave.axes} dt={wave.dt_s} height={250} roles={wavePointObj?.axes_map}
                  defaultAxis={Object.entries(wavePointObj?.axes_map || defaultRoles).find(([, r]) => r === 'radial_h')?.[0] || 'x'} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dạng sóng từ gateway" />}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <div className="stack-cards">
              <Card className="data-list-card" size="small" title="Nhiệt độ">
                {temperatureRows.length ? temperatureRows.map(([label, value]) => (
                  <div className="data-row" key={String(label)}>
                    <span>{label}</span>
                    <b><AnimatedNumber value={value as number} decimals={1} /> °C</b>
                  </div>
                )) : <div className="card-empty-line">Chưa nhận dữ liệu nhiệt độ</div>}
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

        </Row>
      </div>
    </>
  )
}
