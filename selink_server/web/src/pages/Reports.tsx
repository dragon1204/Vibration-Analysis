import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Select, Space, Table } from 'antd'
import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { api, download, post } from '../api/client'
import { useAuth } from '../auth'
import { dt } from '../utils/format'

export default function Reports() {
  const { can } = useAuth()
  const { message } = App.useApp()
  const [machine, setMachine] = useState<string>()
  const [month, setMonth] = useState<Dayjs | null>(null)
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['reports', machine, month?.format('YYYY-MM')],
    queryFn: () => api('/reports', { params: { machine_id: machine, month: month?.format('YYYY-MM') } }),
  })
  return (
    <div className="page">
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Máy" style={{ width: 240 }} value={machine} onChange={setMachine}
          options={machines.map((m) => ({ value: m.id, label: m.name }))} />
        <DatePicker picker="month" value={month} onChange={setMonth} format="MM/YYYY" placeholder="Tháng" />
        {can('analyst') && (
          <Button icon={<PlayCircleOutlined />} onClick={() => post('/analytics/run', { job: 'monthly_report' })
            .then(() => message.success('Đang tạo báo cáo tháng trước…')).catch((e) => message.error(e.message))}>Tạo báo cáo tháng trước</Button>
        )}
      </Space>
      <Card size="small" title="Báo cáo PDF hằng tháng">
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
