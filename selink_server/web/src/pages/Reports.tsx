import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import { api, download, post } from '../api/client'
import { useAuth } from '../auth'
import { ZoneTag } from '../components/common'
import { dt, num } from '../utils/format'
import { STICKY_HEAD } from '../utils/table'

type PeriodType = 'month' | 'quarter' | 'custom'
const STATUS: Record<string, { color: string; label: string }> = {
  queued: { color: 'default', label: 'Đang chờ' }, running: { color: 'processing', label: 'Đang tạo' },
  done: { color: 'success', label: 'Hoàn tất' }, failed: { color: 'error', label: 'Lỗi' },
}

export default function Reports() {
  const { can } = useAuth()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [machine, setMachine] = useState<string>()
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null)
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const quarter = periodDate ? Math.floor(periodDate.month() / 3) + 1 : undefined
  const period = periodType === 'month' ? periodDate?.format('YYYY-MM') : periodType === 'quarter' && periodDate ? `${periodDate.year()}-Q${quarter}` : undefined
  const ready = !!machine && (periodType === 'custom' ? !!customRange : !!periodDate)

  const { data: machines = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['reports', machine, page],
    queryFn: () => api('/reports', { params: { machine_id: machine, limit: pageSize, offset: (page - 1) * pageSize } }),
    // Poll only while a report is still being built.
    refetchInterval: (q) => (q.state.data?.items || []).some((r) => r.status === 'queued' || r.status === 'running') ? 3000 : false,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['reports'] })

  const create = () => post('/reports', periodType === 'custom'
    ? { machine_id: machine, period_type: 'custom', from: customRange![0].startOf('day').toISOString(), to: customRange![1].endOf('day').add(1, 'ms').toISOString() }
    : { machine_id: machine, period_type: periodType, period })
    .then((r: any) => { message.success(`Đã xếp hàng báo cáo ${r.period} (mã ${r.id})`); refresh() })
    .catch((e) => message.error(e.message))

  return (
    <div className="page">
      <div className="page-hero"><div><div className="page-kicker">Hồ sơ vận hành</div><Typography.Title level={2} style={{ margin: 0 }}>Lịch sử & báo cáo</Typography.Title><p className="page-description">Đánh giá tình trạng theo ISO 20816-3, xu hướng, phân tích phổ, cảnh báo và khuyến nghị cho từng máy theo tháng, quý hoặc khoảng tùy chọn.</p></div></div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select allowClear placeholder="Chọn máy" style={{ width: 260 }} value={machine} onChange={(v) => { setMachine(v); setPage(1) }}
            options={machines.map((m) => ({ value: m.id, label: m.name }))} />
          <Segmented value={periodType} onChange={(v) => { setPeriodType(v as PeriodType); setPeriodDate(null); setCustomRange(null) }}
            options={[{ value: 'month', label: 'Tháng' }, { value: 'quarter', label: 'Quý' }, { value: 'custom', label: 'Tùy chọn' }]} />
          {periodType === 'custom'
            ? <DatePicker.RangePicker value={customRange} format="DD/MM/YYYY" onChange={(v) => setCustomRange(v && v[0] && v[1] ? [v[0], v[1]] : null)} />
            : <DatePicker picker={periodType} value={periodDate} onChange={setPeriodDate} format={periodType === 'month' ? 'MM/YYYY' : '[Q]Q/YYYY'}
              placeholder={periodType === 'month' ? 'Tháng' : 'Quý'} />}
          {can('analyst') && (
            <Tooltip title={machine ? '' : 'Chọn máy trước'}>
              <Button type="primary" disabled={!ready} onClick={create}>Tạo báo cáo</Button>
            </Tooltip>
          )}
          <Button onClick={refresh}>Làm mới</Button>
        </Space>
      </Card>
      <Card size="small" title="Báo cáo đã tạo">
        <Table sticky={STICKY_HEAD} size="small" rowKey="id" scroll={{ x: 'max-content' }} loading={isLoading} dataSource={data?.items || []}
          pagination={{ current: page, pageSize, total: data?.total || 0, onChange: setPage, showSizeChanger: false }}
          expandable={{
            rowExpandable: (r: any) => !!r.summary?.lines?.length,
            expandedRowRender: (r: any) => <ul className="report-summary">{r.summary.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>,
          }}
          columns={[
            { title: 'Kỳ', dataIndex: 'period', render: (v, r: any) => <Tooltip title={`${dt(r.period_start)} → ${dt(r.period_end)}`}>{v}</Tooltip> },
            { title: 'Máy', dataIndex: 'machine_name', render: (v) => <span className="nowrap">{v}</span> },
            { title: 'Trạng thái', dataIndex: 'status', render: (s: string, r: any) => {
              const tag = <Tag color={STATUS[s]?.color}>{STATUS[s]?.label || s}</Tag>
              return s === 'failed' && r.error ? <Tooltip title={r.error}>{tag}</Tooltip> : tag
            } },
            { title: 'Đánh giá', key: 'zone', render: (_, r: any) => r.summary ? <Space size={4} wrap><ZoneTag zone={r.summary.zone} />
              {r.summary.points?.[0] && <span className="muted nowrap">P95 {num(r.summary.points[0].p95)} mm/s</span>}
              {r.summary.period_complete === false && <Tag>kỳ chưa kết thúc</Tag>}</Space> : '–' },
            { title: 'Cảnh báo', key: 'ev', render: (_, r: any) => r.summary ? <span className="nowrap">{r.summary.events_total} ({r.summary.events_active} còn mở)</span> : '–' },
            { title: 'Người tạo', dataIndex: 'requested_by', render: (v) => v || '–' },
            { title: 'Tạo lúc', dataIndex: 'created_at', render: (v) => dt(v) },
            { title: '', key: 'act', render: (_, r: any) => <Space size={4}>
              <Button size="small" disabled={r.status !== 'done'}
                onClick={() => download(`/reports/${r.id}/download`, `${r.machine_id}-${r.period}-${r.id}.pdf`).catch((e) => message.error(e.message))}>PDF</Button>
              {r.status === 'failed' && can('analyst') && <Button size="small"
                onClick={() => post(`/reports/${r.id}/retry`, {}).then(refresh).catch((e) => message.error(e.message))}>Tạo lại</Button>}
              {can('admin') && r.status !== 'queued' && r.status !== 'running' && (
                <Popconfirm title="Xóa báo cáo này?" okText="Xóa" cancelText="Hủy"
                  onConfirm={() => api(`/reports/${r.id}`, { method: 'DELETE' }).then(refresh).catch((e) => message.error(e.message))}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              )}
            </Space> },
          ]} />
      </Card>
    </div>
  )
}
