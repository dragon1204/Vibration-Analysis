import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Checkbox, Col, DatePicker, Form, Image, Input, Row, Select, Space, Table, Upload } from 'antd'
import dayjs from 'dayjs'
import { api, post } from '../api/client'
import { useAuth } from '../auth'
import { dt } from '../utils/format'
import MachineNav from './MachineNav'
import { STICKY_HEAD } from '../utils/table'

const ACTIONS = [
  { value: 'bearing_replace', label: 'Thay vòng bi' }, { value: 'alignment', label: 'Căn chỉnh đồng trục' },
  { value: 'balancing', label: 'Cân bằng động' }, { value: 'lubrication', label: 'Bôi trơn' }, { value: 'other', label: 'Khác' },
]

function EvidencePhoto({ machineId, photoId }: { machineId: string; photoId: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let url: string | undefined
    api<Blob>(`/machines/${machineId}/maintenance/photos/${photoId}`, { raw: true }).then((blob) => {
      url = URL.createObjectURL(blob)
      setSrc(url)
    }).catch(() => undefined)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [machineId, photoId])
  return src ? <Image width={46} height={46} style={{ objectFit: 'cover', borderRadius: 5 }} src={src} /> : null
}

export default function Maintenance() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const { data: m } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data = [] } = useQuery<any[]>({ queryKey: ['maint', id], queryFn: () => api(`/machines/${id}/maintenance`) })
  const submit = async (v: any) => {
    try {
      await post(`/machines/${id}/maintenance`, { ...v, ts: v.ts?.toISOString(), photos })
      message.success(v.reset_baseline ? 'Đã ghi – baseline sẽ học lại từ dữ liệu sau bảo trì' : 'Đã ghi nhật ký bảo trì')
      form.resetFields()
      setPhotos([])
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
                <Form.Item label="Ảnh hiện trường (tối đa 5 MB/ảnh)">
                  <Upload accept="image/jpeg,image/png,image/webp" multiple showUploadList
                    customRequest={async ({ file, onSuccess, onError }) => {
                      setUploading(true)
                      try {
                        const body = new FormData()
                        body.append('photo', file as File)
                        const result = await api<{ id: string }>(`/machines/${id}/maintenance/photos`, { method: 'POST', body })
                        setPhotos((current) => [...current, result.id])
                        onSuccess?.(result)
                      } catch (error: any) { onError?.(error); message.error(error.message) }
                      finally { setUploading(false) }
                    }}
                    onRemove={(file: any) => {
                      const photoId = file.response?.id
                      if (photoId) setPhotos((current) => current.filter((item) => item !== photoId))
                      return true
                    }}>
                    <Button loading={uploading}>Chọn ảnh</Button>
                  </Upload>
                </Form.Item>
                <Form.Item name="reset_baseline" valuePropName="checked"><Checkbox>Học lại baseline sau bảo trì</Checkbox></Form.Item>
                <Button type="primary" htmlType="submit" loading={uploading} block>Lưu</Button>
              </Form>
            </Card>
          </Col>
        )}
        <Col xs={24} lg={can('engineer') ? 16 : 24}>
          <Card size="small" title="Lịch sử bảo trì">
            <Table sticky={STICKY_HEAD} size="small" rowKey="id" dataSource={data} columns={[
              { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v) },
              { title: 'Công việc', dataIndex: 'action', render: (a) => ACTIONS.find((x) => x.value === a)?.label || a },
              { title: 'Điểm đo', dataIndex: 'point_id' }, { title: 'Mô tả', dataIndex: 'description' },
              { title: 'Lỗi tìm thấy', dataIndex: 'found_fault' }, { title: 'Người ghi', dataIndex: 'by_user' },
              { title: 'Ảnh', dataIndex: 'photos', render: (items: string[] = []) => <Space size={4}>{items.map((photoId) => <EvidencePhoto key={photoId} machineId={id} photoId={photoId} />)}</Space> },
              { title: 'Học lại BL', dataIndex: 'reset_baseline', render: (v) => (v ? '✓' : '') },
            ]} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
