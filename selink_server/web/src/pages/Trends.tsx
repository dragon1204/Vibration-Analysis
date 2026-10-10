import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Card, Checkbox, Select, Space, Spin } from 'antd'
import { api } from '../api/client'
import { TrendChart } from '../components/charts'
import { RangePicker, lastHours, rangeParams, type Range } from '../components/common'
import MachineNav from './MachineNav'

const FIELDS = [
  { value: 'vel_mm_s', label: 'Vận tốc (mm/s)', iso: true },
  { value: 'vel_rms_mm_s', label: 'VRMS cảm biến (mm/s)', iso: true },
  { value: 'acc_rms_g', label: 'Gia tốc RMS (g)' },
  { value: 'kurtosis', label: 'Kurtosis' },
  { value: 'temp_c', label: 'Nhiệt cảm biến (°C)' },
]
const COLORS = ['#0b4f6c', '#fa541c', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96']

export default function Trends() {
  const { id = '' } = useParams()
  const [range, setRange] = useState<Range>(lastHours(24 * 7))
  const [field, setField] = useState('vel_mm_s')
  const [axes, setAxes] = useState(['x', 'z'])
  const [showLoad, setShowLoad] = useState(true)
  const [pts, setPts] = useState<string[]>()
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const points: string[] = pts || m?.points.filter((p: any) => p.role === 'bearing').map((p: any) => p.id) || []
  const results = useQueries({
    queries: points.map((p) => ({
      queryKey: ['metrics', p, field, axes.join(), range[0].valueOf(), range[1].valueOf()],
      queryFn: () => api(`/points/${p}/metrics`, { params: { ...rangeParams(range), fields: field, axis: axes.join(',') } }),
    })),
  })
  const { data: power } = useQuery<any>({
    queryKey: ['power', id, range[0].valueOf(), range[1].valueOf()],
    queryFn: () => api(`/machines/${id}/power`, { params: rangeParams(range) }), enabled: showLoad,
  })
  const { data: maint = [] } = useQuery<any[]>({ queryKey: ['maint', id], queryFn: () => api(`/machines/${id}/maintenance`) })
  const series = results.flatMap((r, i) => {
    if (!r.data) return []
    return Object.entries(r.data.series).map(([a, f]: any, j) => ({
      name: `${points[i]} ${a.toUpperCase()}`, data: f[field] || [], color: COLORS[(i * 3 + j) % COLORS.length],
    }))
  })
  if (showLoad && power?.rows?.length) {
    series.push({ name: '% tải', data: power.rows.map((r: any) => [r.ts, r.load_pct]), yAxisIndex: 1, color: '#bfbfbf', dashed: true } as any)
  }
  const isoField = FIELDS.find((f) => f.value === field)?.iso
  return (
    <div className="page">
      <MachineNav id={id} />
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker value={range} onChange={setRange} />
        <Select mode="multiple" style={{ minWidth: 260 }} value={points} onChange={setPts}
          options={(m?.points || []).map((p: any) => ({ value: p.id, label: p.name }))} />
        <Select style={{ width: 220 }} value={field} onChange={setField} options={FIELDS} />
        <Checkbox.Group value={axes} onChange={(v) => setAxes(v as string[])} options={['x', 'y', 'z'].map((a) => ({ value: a, label: a.toUpperCase() }))} />
        <Checkbox checked={showLoad} onChange={(e) => setShowLoad(e.target.checked)}>Chồng % tải</Checkbox>
      </Space>
      <Card size="small">
        {results.some((r) => r.isLoading) ? <Spin /> : (
          <TrendChart series={series as any} limits={isoField ? m?.iso_limits : undefined} height={460}
            yName={FIELDS.find((f) => f.value === field)?.label} y2Name={showLoad ? '% tải' : undefined}
            markers={maint.map((x: any) => ({ ts: x.ts, label: `Bảo trì: ${x.action}` }))} csvName={`${id}_${field}.csv`} />
        )}
        <div className="muted">Dải nền màu = vùng ISO 20816-3 · dữ liệu &gt; 2 ngày dùng tổng hợp 1 giờ · đường chấm = sự kiện bảo trì</div>
      </Card>
    </div>
  )
}
