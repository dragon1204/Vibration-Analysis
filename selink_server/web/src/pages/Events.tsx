import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Descriptions, Drawer, Input, List, Select, Space, Steps, Table, Tag, Timeline } from 'antd'
import { api, patch } from '../api/client'
import { useRealtime } from '../api/realtime'
import { RangePicker, StatusTag, lastHours, rangeParams, type Range } from '../components/common'
import { useAuth } from '../auth'
import { EVENT_STATE, dt, num } from '../utils/format'
import { STICKY_HEAD } from '../utils/table'

const FLOW = ['raised', 'acknowledged', 'diagnosed', 'resolved', 'closed']

export default function Events() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [sp, setSp] = useSearchParams()
  const [range, setRange] = useState<Range>(lastHours(24 * 30))
  const [severity, setSeverity] = useState<string[]>([])
  const [state, setState] = useState<string[]>(['raised', 'acknowledged', 'diagnosed'])
  const [machine, setMachine] = useState<string>()
  const [comment, setComment] = useState('')
  const openId = sp.get('event')
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['events', range[0].valueOf(), severity, state, machine],
    queryFn: () => api('/events', { params: { ...rangeParams(range), severity: severity.join(','), state: state.join(','), machine_id: machine } }),
  })
  const { data: ev } = useQuery<any>({ queryKey: ['event', openId], queryFn: () => api(`/events/${openId}`), enabled: !!openId })
  useRealtime(['events'], () => qc.invalidateQueries({ queryKey: ['events'] }))
  useEffect(() => setComment(''), [openId])

  const update = async (body: any) => {
    try {
      await patch(`/events/${openId}`, body)
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['event', openId] })
      message.success('Đã cập nhật')
    } catch (e: any) {
      message.error(e.message)
    }
  }
  const next = ev ? FLOW[FLOW.indexOf(ev.state) + 1] : undefined
  return (
    <div className="page">
      <Space wrap style={{ marginBottom: 12 }}>
        <RangePicker value={range} onChange={setRange} />
        <Select mode="multiple" placeholder="Mức" style={{ minWidth: 180 }} value={severity} onChange={setSeverity}
          options={['watch', 'warning', 'danger', 'info'].map((s) => ({ value: s, label: <StatusTag status={s} /> }))} />
        <Select mode="multiple" placeholder="Trạng thái" style={{ minWidth: 240 }} value={state} onChange={setState}
          options={FLOW.map((s) => ({ value: s, label: EVENT_STATE[s] }))} />
        <Select allowClear placeholder="Máy" style={{ width: 220 }} value={machine} onChange={setMachine}
          options={machines.map((m) => ({ value: m.id, label: m.name }))} />
      </Space>
      <Card size="small">
        <Table sticky={STICKY_HEAD} size="small" rowKey="event_id" loading={isLoading} dataSource={data} pagination={{ pageSize: 20 }}
          onRow={(r) => ({ onClick: () => setSp({ event: r.event_id }), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v), width: 150 },
            { title: 'Mức', dataIndex: 'severity', render: (s) => <StatusTag status={s} />, width: 120 },
            { title: 'Máy / điểm đo', key: 'm', render: (_, r: any) => <span>{r.machine_name || r.gateway_id}<br /><span className="muted">{r.point_id}</span></span> },
            { title: 'Nội dung', dataIndex: 'message' },
            { title: 'Giá trị / ngưỡng', key: 'v', render: (_, r: any) => r.value != null ? `${num(r.value)} / ${num(r.threshold)}` : '', responsive: ['md'] },
            { title: 'Chẩn đoán', dataIndex: 'diagnosis', render: (d) => d?.label ? <Tag color="purple">{d.label}</Tag> : '', responsive: ['lg'] },
            { title: 'Trạng thái', dataIndex: 'state', render: (s, r: any) => <span>{EVENT_STATE[s]}{r.cleared_at && <Tag style={{ marginLeft: 4 }}>đã hết</Tag>}</span> },
            { title: 'Nguồn', dataIndex: 'source', responsive: ['xl'] },
          ]} />
      </Card>
      <Drawer open={!!openId} width={560} onClose={() => setSp({})} title={ev && <Space><StatusTag status={ev.severity} />{ev.message}</Space>}>
        {ev && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Steps size="small" current={FLOW.indexOf(ev.state)} items={FLOW.map((s) => ({ title: EVENT_STATE[s] }))} />
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Thời điểm">{dt(ev.ts, true)}</Descriptions.Item>
              <Descriptions.Item label="Máy / điểm đo">{ev.machine_id} / {ev.point_id}</Descriptions.Item>
              <Descriptions.Item label="Luật">{ev.rule} ({ev.metric}) · nguồn {ev.source}</Descriptions.Item>
              <Descriptions.Item label="Giá trị / ngưỡng">{num(ev.value, 3)} / {num(ev.threshold, 3)}</Descriptions.Item>
              {ev.cleared_at && <Descriptions.Item label="Điều kiện hết">{dt(ev.cleared_at)}</Descriptions.Item>}
              {ev.ack_by && <Descriptions.Item label="Xác nhận">{ev.ack_by} – {dt(ev.ack_at)}</Descriptions.Item>}
              {ev.capture && (
                <Descriptions.Item label="Capture">
                  <a onClick={() => nav(`/points/${ev.point_id}/spectrum`)}>{ev.capture.capture_id}</a> · ISO {num(ev.capture.iso_vrms_max_mm_s)} mm/s vùng {ev.capture.iso_zone}
                </Descriptions.Item>
              )}
            </Descriptions>
            {ev.diagnosis && (
              <Card size="small" title={`Chẩn đoán: ${ev.diagnosis.label} (${Math.round(ev.diagnosis.confidence * 100)}%)`}>
                <List size="small" dataSource={ev.diagnosis.evidence || []} renderItem={(e: any) => <List.Item>{e.feature}: {typeof e.value === 'number' ? num(e.value, 3) : e.value} – {e.note}</List.Item>} />
                <b>Khuyến nghị:</b> {ev.diagnosis.recommendation}
              </Card>
            )}
            <Space wrap>
              {next && can(next === 'acknowledged' ? 'operator' : 'engineer') && (
                <Button type="primary" onClick={() => update({ state: next })}>→ {EVENT_STATE[next]}</Button>
              )}
              {ev.machine_id && <Button onClick={() => nav(`/machines/${ev.machine_id}/diagnosis`)}>AI chẩn đoán</Button>}
              {can('engineer') && ev.diagnosis && (
                <>
                  <Button onClick={() => update({ feedback: { verdict: 'correct' } })}>Chẩn đoán đúng</Button>
                  <Button danger onClick={() => update({ feedback: { verdict: 'wrong' } })}>Chẩn đoán sai</Button>
                </>
              )}
            </Space>
            <Timeline items={(ev.comments || []).map((c: any) => ({ children: <span><b>{c.by}</b> <span className="muted">{dt(c.ts)}</span><br />{c.text}</span> }))} />
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="Bình luận…" value={comment} onChange={(e) => setComment(e.target.value)} onPressEnter={() => comment && update({ comment })} />
              <Button onClick={() => comment && update({ comment })}>Gửi</Button>
            </Space.Compact>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
