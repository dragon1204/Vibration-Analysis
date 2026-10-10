import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Checkbox, Col, DatePicker, Form, Input, Row, Select, Table } from 'antd'
import dayjs from 'dayjs'
import { api, post } from '../api/client'
import { useAuth } from '../auth'
import { dt } from '../utils/format'
import MachineNav from './MachineNav'

const ACTIONS = [
  { value: 'bearing_replace', label: 'Thay vòng bi' }, { value: 'alignment', label: 'Căn chỉnh đồng trục' },
  { value: 'balancing', label: 'Cân bằng động' }, { value: 'lubrication', label: 'Bôi trơn' }, { value: 'other', label: 'Khác' },
]

export default function Maintenance() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data = [] } = useQuery<any[]>({ queryKey: ['maint', id], queryFn: () => api(`/machines/${id}/maintenance`) })
  const submit = async (v: any) => {
    try {
      await post(`/machines/${id}/maintenance`, { ...v, ts: v.ts?.toISOString(), photos: [] })
      message.success(v.reset_baseline ? 'Đã ghi – baseline sẽ học lại từ dữ liệu sau bảo trì' : 'Đã ghi nhật ký bảo trì')
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['maint', id] })
    } catch (e: any) {
      message.error(e.message)
    }
  }
  return (
    <div className="page">
      <MachineNav id={id} />
      <Row gutter={[12, 12]}>
        {can('engineer') && (
          <Col xs={24} lg={8}>
            <Card size="small" title="Ghi công việc bảo trì">
              <Form form={form} layout="vertical" onFinish={submit} initialValues={{ ts: dayjs(), action: 'lubrication' }}>
                <Form.Item name="ts" label="Thời điểm"><DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="point_id" label="Điểm đo (tùy chọn)">
                  <Select allowClear options={(m?.points || []).map((p: any) => ({ value: p.id, label: p.name }))} />
                </Form.Item>
                <Form.Item name="action" label="Công việc" rules={[{ required: true }]}><Select options={ACTIONS} /></Form.Item>
                <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
                <Form.Item name="found_fault" label="Lỗi tìm thấy"><Input /></Form.Item>
                <Form.Item name="reset_baseline" valuePropName="checked"><Checkbox>Học lại baseline sau bảo trì</Checkbox></Form.Item>
                <Button type="primary" htmlType="submit" block>Lưu</Button>
              </Form>
            </Card>
          </Col>
        )}
        <Col xs={24} lg={can('engineer') ? 16 : 24}>
          <Card size="small" title="Lịch sử bảo trì">
            <Table size="small" rowKey="id" dataSource={data} columns={[
              { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v) },
              { title: 'Công việc', dataIndex: 'action', render: (a) => ACTIONS.find((x) => x.value === a)?.label || a },
              { title: 'Điểm đo', dataIndex: 'point_id' }, { title: 'Mô tả', dataIndex: 'description' },
              { title: 'Lỗi tìm thấy', dataIndex: 'found_fault' }, { title: 'Người ghi', dataIndex: 'by_user' },
              { title: 'Học lại BL', dataIndex: 'reset_baseline', render: (v) => (v ? '✓' : '') },
            ]} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
