import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Segmented, Select, Space, Table, Typography } from 'antd'
import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { api, download, post } from '../api/client'
import { useAuth } from '../auth'
import { dt } from '../utils/format'

export default function Reports() {
  const { can } = useAuth()
  const { message } = App.useApp()
  const [machine, setMachine] = useState<string>()
  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('month')
  const [periodDate, setPeriodDate] = useState<Dayjs | null>(null)
  const selectedQuarter = periodDate ? Math.floor(periodDate.month() / 3) + 1 : undefined
  const period = periodDate ? (periodType === 'month' ? periodDate.format('YYYY-MM') : `${periodDate.year()}-Q${selectedQuarter}`) : undefined
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['reports', machine, period],
    queryFn: () => api('/reports', { params: { machine_id: machine, month: period } }),
  })
  return (
    <div className="page">
      <div className="page-hero"><div><div className="page-kicker">Hồ sơ vận hành</div><Typography.Title level={2} style={{ margin: 0 }}>Lịch sử & báo cáo</Typography.Title><p className="page-description">Tổng hợp rung động, cảnh báo và khuyến nghị theo tháng hoặc quý.</p></div></div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Máy" style={{ width: 240 }} value={machine} onChange={setMachine}
          options={machines.map((m) => ({ value: m.id, label: m.name }))} />
        <Segmented value={periodType} onChange={(value) => { setPeriodType(value as any); setPeriodDate(null) }} options={[{ value: 'month', label: 'Theo tháng' }, { value: 'quarter', label: 'Theo quý' }]} />
        <DatePicker picker={periodType} value={periodDate} onChange={setPeriodDate} format={periodType === 'month' ? 'MM/YYYY' : '[Q]Q/YYYY'} placeholder={periodType === 'month' ? 'Tháng' : 'Quý'} />
        {can('analyst') && (
          <Button type="primary" icon={<PlayCircleOutlined />} disabled={!periodDate} onClick={() => post('/analytics/run', { job: 'monthly_report', params: periodType === 'month'
            ? { period_type: 'month', period: periodDate?.format('YYYY-MM') }
            : { period_type: 'quarter', year: periodDate?.year(), quarter: selectedQuarter } })
            .then(() => message.success(`Đang tạo báo cáo ${period}…`)).catch((e) => message.error(e.message))}>Tạo báo cáo {periodType === 'month' ? 'tháng' : 'quý'}</Button>
        )}
      </Space>
      <Card size="small" title="Báo cáo PDF đã tạo">
        <Table size="small" rowKey="id" loading={isLoading} dataSource={data} columns={[
          { title: 'Kỳ', dataIndex: 'period' }, { title: 'Máy', dataIndex: 'machine_name' },
          { title: 'Tạo lúc', dataIndex: 'created_at', render: (v) => dt(v) },
          { title: '', key: 'dl', render: (_, r: any) => <Button size="small" icon={<DownloadOutlined />}
            onClick={() => download(`/reports/${r.id}/download`, `${r.machine_id}-${r.period}.pdf`)}>Tải PDF</Button> },
        ]} />
      </Card>
    </div>
  )
}
