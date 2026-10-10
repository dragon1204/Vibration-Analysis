import { Tag, Tooltip, DatePicker } from 'antd'
import {
  CheckCircleFilled, EyeFilled, WarningFilled, CloseCircleFilled, DisconnectOutlined, InfoCircleFilled,
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

export const RANGE_PRESETS = [
  { label: '1 giờ', value: () => [dayjs().subtract(1, 'hour'), dayjs()] as Range },
  { label: '24 giờ', value: () => [dayjs().subtract(24, 'hour'), dayjs()] as Range },
  { label: '7 ngày', value: () => [dayjs().subtract(7, 'day'), dayjs()] as Range },
  { label: '30 ngày', value: () => [dayjs().subtract(30, 'day'), dayjs()] as Range },
  { label: '90 ngày', value: () => [dayjs().subtract(90, 'day'), dayjs()] as Range },
]

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <DatePicker.RangePicker showTime value={value} presets={RANGE_PRESETS} format="DD/MM/YYYY HH:mm"
      onChange={(v) => v && v[0] && v[1] && onChange([v[0], v[1]])} />
  )
}

export const lastHours = (h: number): Range => [dayjs().subtract(h, 'hour'), dayjs()]

export const rangeParams = (r: Range) => ({ from: r[0].toISOString(), to: r[1].toISOString() })
