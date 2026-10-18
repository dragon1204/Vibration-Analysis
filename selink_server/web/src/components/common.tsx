import { useState } from 'react'
import { Button, Tag, Tooltip, DatePicker } from 'antd'
import {
  CheckCircleFilled, EyeFilled, WarningFilled, CloseCircleFilled, DisconnectOutlined, InfoCircleFilled, LeftOutlined, RightOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { STATUS, ZONE_COLOR } from '../utils/format'

const ICON: Record<string, JSX.Element> = {
  normal: <CheckCircleFilled />, watch: <EyeFilled />, warning: <WarningFilled />, danger: <CloseCircleFilled />,
  offline: <DisconnectOutlined />, info: <InfoCircleFilled />,
}

/** Status always shown with icon + text, not colour only (spec 7.1). */
export function StatusTag({ status }: { status?: string | null }) {
  const s = STATUS[status || 'normal'] || STATUS.normal
  return <Tag color={s.tag} icon={ICON[status || 'normal']}>{s.label}</Tag>
}

export function ZoneTag({ zone }: { zone?: string | null }) {
  if (!zone) return <Tag>–</Tag>
  return (
    <Tooltip title="Vùng ISO 20816-3">
      <Tag color={ZONE_COLOR[zone]} style={{ fontWeight: 600 }}>Vùng {zone}</Tag>
    </Tooltip>
  )
}

export function EstimateTag() {
  return <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px' }}>ước lượng</Tag>
}

export type Range = [Dayjs, Dayjs]

type Preset = { key: string; label: string; get: () => Range; spanMs?: number }
const rolling = (n: number, unit: 'minute' | 'hour' | 'day'): (() => Range) => () => [dayjs().subtract(n, unit), dayjs()]
const spanOf = (n: number, unit: 'minute' | 'hour' | 'day') => dayjs().diff(dayjs().subtract(n, unit))

/** Quick ranges: "rolling" ones end at the moment of the click, the calendar ones are fixed days. */
export const RANGE_PRESET_LIST: Preset[] = [
  { key: '5m', spanMs: spanOf(5, 'minute'), label: '5 phút', get: rolling(5, 'minute') },
  { key: '15m', spanMs: spanOf(15, 'minute'), label: '15 phút', get: rolling(15, 'minute') },
  { key: '1h', spanMs: spanOf(1, 'hour'), label: '1 giờ', get: rolling(1, 'hour') },
  { key: '6h', spanMs: spanOf(6, 'hour'), label: '6 giờ', get: rolling(6, 'hour') },
  { key: '24h', spanMs: spanOf(24, 'hour'), label: '24 giờ', get: rolling(24, 'hour') },
  { key: 'today', label: 'Hôm nay', get: () => [dayjs().startOf('day'), dayjs()] },
  { key: 'yesterday', label: 'Hôm qua', get: () => [dayjs().subtract(1, 'day').startOf('day'), dayjs().startOf('day')] },
  { key: '7d', spanMs: spanOf(7, 'day'), label: '7 ngày', get: rolling(7, 'day') },
  { key: '30d', spanMs: spanOf(30, 'day'), label: '30 ngày', get: rolling(30, 'day') },
  { key: '90d', spanMs: spanOf(90, 'day'), label: '90 ngày', get: rolling(90, 'day') },
]
export const RANGE_PRESETS = RANGE_PRESET_LIST.map((p) => ({ label: p.label, value: p.get }))

function humanSpan(r: Range): string {
  const sec = Math.max(0, r[1].diff(r[0], 'second'))
  if (sec < 90) return `${sec} giây`
  if (sec < 5400) return `${Math.round(sec / 60)} phút`
  if (sec < 129600) return `${(sec / 3600).toFixed(sec % 3600 === 0 ? 0 : 1)} giờ`
  return `${(sec / 86400).toFixed(sec % 86400 === 0 ? 0 : 1)} ngày`
}

/** Time-range chooser: one click on a chip for common spans, or "Tùy chọn" for an exact start/end (to the second). */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false)
  const [forceCustom, setForceCustom] = useState(false)
  // The active chip is derived from the value, so it survives parent re-renders and remounts.
  const spanMs = value[1].diff(value[0])
  const derived = (() => {
    const todayStart = dayjs().startOf('day')
    if (value[0].isSame(todayStart, 'minute') && Math.abs(value[1].diff(dayjs())) < 3_600_000) return 'today'
    if (value[0].isSame(todayStart.subtract(1, 'day'), 'minute') && value[1].isSame(todayStart, 'minute')) return 'yesterday'
    return RANGE_PRESET_LIST.find((p) => p.spanMs != null && Math.abs(p.spanMs - spanMs) < 1500
      && Math.abs(value[1].diff(dayjs())) < 6 * 3_600_000)?.key ?? 'custom'
  })()
  const active = forceCustom ? 'custom' : derived
  const pick = (key: string) => {
    if (key === 'custom') { setForceCustom(true); setOpen(true); return }
    const preset = RANGE_PRESET_LIST.find((p) => p.key === key)
    if (preset) { setForceCustom(false); setOpen(false); onChange(preset.get()) }
  }
  const shift = (dir: -1 | 1) => {
    const len = value[1].diff(value[0])
    setForceCustom(true)
    onChange([value[0].add(dir * len, 'millisecond'), value[1].add(dir * len, 'millisecond')])
  }
  return (
    <div className="range-picker">
      <div className="range-chips">
        {[...RANGE_PRESET_LIST.map((p) => ({ key: p.key, label: p.label })), { key: 'custom', label: 'Tùy chọn' }].map((c) => (
          <Tag.CheckableTag key={c.key} checked={active === c.key} onChange={() => pick(c.key)}>{c.label}</Tag.CheckableTag>
        ))}
      </div>
      <div className="range-picker-row">
        <Button size="small" icon={<LeftOutlined />} onClick={() => shift(-1)} title="Lùi một khoảng bằng độ dài hiện tại" />
        <DatePicker.RangePicker showTime={{ format: 'HH:mm:ss' }} value={value} format="DD/MM/YYYY HH:mm:ss" open={open}
          onOpenChange={setOpen} allowClear={false}
          onChange={(v) => {
            if (!v || !v[0] || !v[1]) return
            // antd may re-emit the unchanged value on blur; that must not flip a quick chip to "custom".
            if (!open || (Math.abs(v[0].diff(value[0])) < 1000 && Math.abs(v[1].diff(value[1])) < 1000)) return
            setForceCustom(true); onChange([v[0], v[1]])
          }} />
        <Button size="small" icon={<RightOutlined />} onClick={() => shift(1)} title="Tiến một khoảng bằng độ dài hiện tại" />
        <span className="range-span">Dài {humanSpan(value)}</span>
      </div>
    </div>
  )
}

export const lastHours = (h: number): Range => [dayjs().subtract(h, 'hour'), dayjs()]

export const rangeParams = (r: Range) => ({ from: r[0].toISOString(), to: r[1].toISOString() })
