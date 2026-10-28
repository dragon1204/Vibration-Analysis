import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Breadcrumb, Card, Col, Empty, InputNumber, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag } from 'antd'
import { api } from '../api/client'
import { SpectrumChart, WaterfallChart, WaveformChart } from '../components/charts'
import { RangePicker, ZoneTag, lastHours, rangeParams, type Range } from '../components/common'
import { dt, num } from '../utils/format'
import { STICKY_HEAD } from '../utils/table'

export default function Spectrum() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [range, setRange] = useState<Range>(lastHours(24 * 7))
  const [profile, setProfile] = useState<string>()
  const [capId, setCapId] = useState<string>()
  const [compareId, setCompareId] = useState<string>()
  const [type, setType] = useState('vel')
  const [axis, setAxis] = useState('x')
  const [fmax, setFmax] = useState<number | null>(1000)
  const [orders, setOrders] = useState(false)
  const { data: point } = useQuery<any>({ queryKey: ['point', id], queryFn: () => api(`/points/${id}`) })
  const { data: caps = [] } = useQuery<any[]>({
    queryKey: ['captures', id, range, profile],
    queryFn: () => api(`/points/${id}/captures`, { params: { ...rangeParams(range), profile } }),
  })
  useEffect(() => {
    if (!capId && caps.length) setCapId(caps[0].capture_id)
  }, [caps, capId])
  const { data: spec } = useQuery<any>({
    queryKey: ['spec', capId, type, axis, fmax],
    queryFn: () => api(`/captures/${capId}/spectrum`, { params: { type, axis, fmax: fmax || undefined } }),
    enabled: !!capId,
  })
  const { data: cmp } = useQuery<any>({
    queryKey: ['spec', compareId, type, axis, fmax],
    queryFn: () => api(`/captures/${compareId}/spectrum`, { params: { type, axis, fmax: fmax || undefined } }),
    enabled: !!compareId,
  })
  const { data: wave } = useQuery<any>({ queryKey: ['wave', capId], queryFn: () => api(`/captures/${capId}/waveform`), enabled: !!capId })
  const { data: wf } = useQuery<any>({
    queryKey: ['waterfall', id, range, type, axis, profile],
    queryFn: () => api(`/points/${id}/waterfall`, { params: { ...rangeParams(range), type: type === 'iso' ? 'vel' : type, axis, profile } }),
  })
  const cap = caps.find((c) => c.capture_id === capId)
  const profiles = [...new Set(caps.map((c) => c.profile))]
  return (
    <div className="page">
      <Breadcrumb style={{ marginBottom: 8 }} items={[
        { title: <a onClick={() => nav('/')}>Tổng quan</a> },
        { title: <a onClick={() => nav(`/machines/${point?.machine_id}/live`)}>{point?.machine_id}</a> },
        { title: `Phân tích phổ – ${point?.name || id}` }]} />
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker value={range} onChange={setRange} />
        <Select allowClear placeholder="Profile" style={{ width: 130 }} value={profile} onChange={setProfile}
          options={profiles.map((p) => ({ value: p, label: p }))} />
        <Segmented value={type} onChange={(v) => setType(String(v))} options={[
          { label: 'Vận tốc', value: 'vel' }, { label: 'Gia tốc', value: 'acc' }, { label: 'Phổ bao', value: 'env' }, { label: 'Đã cô lập', value: 'iso' }]} />
        <Segmented value={axis} onChange={(v) => setAxis(String(v))} options={['x', 'y', 'z'].map((a) => ({ label: a.toUpperCase(), value: a }))} />
        <Segmented value={fmax ?? 'full'} onChange={(value) => setFmax(value === 'full' ? null : Number(value))} options={[
          { value: 250, label: '0–250 Hz' }, { value: 500, label: '0–500 Hz' }, { value: 1000, label: '0–1.000 Hz' }, { value: 'full', label: 'Toàn dải' },
        ]} />
        <InputNumber addonBefore="f max" addonAfter="Hz" value={fmax} onChange={setFmax} min={10} step={50} style={{ width: 165 }} />
        <Space>Trục bậc (X)<Switch checked={orders} onChange={setOrders} /></Space>
      </Space>
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={7}>
          <Card size="small" title="Capture">
            <Table sticky={STICKY_HEAD} size="small" rowKey="capture_id" dataSource={caps} pagination={{ pageSize: 12, size: 'small' }}
              rowSelection={{ type: 'radio', selectedRowKeys: capId ? [capId] : [], onChange: (k) => setCapId(String(k[0])) }}
              onRow={(r) => ({ onClick: () => setCapId(r.capture_id) })}
              columns={[
                { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v) },
                { title: 'Profile', dataIndex: 'profile' },
                { title: 'RMS ISO', dataIndex: 'iso_vrms_max_mm_s', align: 'right', render: (v, r: any) => <span className="nowrap">{num(v)} <ZoneTag zone={r.iso_zone} /></span> },
              ]} />
            <Select allowClear placeholder="So sánh với capture (baseline)…" style={{ width: '100%' }} value={compareId} onChange={setCompareId}
              options={caps.filter((c) => c.capture_id !== capId).map((c) => ({ value: c.capture_id, label: `${dt(c.ts)} · ${c.profile}` }))} />
          </Card>
        </Col>
        <Col xs={24} xl={17}>
          <Tabs items={[
            {
              key: 'spec', label: 'Phổ', children: spec ? (
                <Card size="small">
                  <SpectrumChart df={spec.df_hz} values={spec.values} unit={spec.unit} markers={spec.markers} speedHz={spec.speed_hz}
                    showOrders={orders} csvName={`${capId}_${type}_${axis}.csv`} height={500}
                    compare={cmp ? { name: `So sánh ${dt(caps.find((c) => c.capture_id === compareId)?.ts)}`, df: cmp.df_hz, values: cmp.values } : undefined} />
                  {cap && <Space wrap className="muted">
                    <span>{cap.capture_id}</span><span>fs {num(cap.fs_hz, 0)} Hz</span><span>{cap.frames} frame</span>
                    <span>1X = {num(cap.speed_hz, 2)} Hz ({cap.speed_confidence})</span>
                    {cap.quality_flags?.map((f: string) => <Tag key={f}>{f}</Tag>)}
                  </Space>}
                </Card>
              ) : <Empty description="Chọn capture" />,
            },
            {
              key: 'wave', label: 'Dạng sóng', children: wave ? <Card size="small"><WaveformChart axes={wave.axes} dt={wave.dt_s} height={420} defaultAxis={axis} /></Card>
                : <Empty description="Không có sóng thô" />,
            },
            {
              key: 'wf', label: 'Waterfall', children: wf?.rows?.length ? <Card size="small"><WaterfallChart rows={wf.rows} df={wf.df_hz} unit={type === 'env' ? 'g' : type === 'acc' ? 'g' : 'mm/s'} /></Card>
                : <Empty description="Chưa đủ capture có phổ" />,
            },
          ]} />
        </Col>
      </Row>
    </div>
  )
}
