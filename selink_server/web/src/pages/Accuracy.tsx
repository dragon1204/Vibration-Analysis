import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Upload } from 'antd'
import { api, download, post } from '../api/client'
import { useAuth } from '../auth'
import { dt, num } from '../utils/format'
import { STICKY_HEAD } from '../utils/table'

const QUANTITIES = [
  { value: 'iso_vrms', label: 'RMS vận tốc dải ISO (mm/s)' }, { value: 'acc_rms', label: 'RMS gia tốc (g)' },
  { value: 'amp_1x', label: 'Biên độ 1X (mm/s)' }, { value: 'peak_freq', label: 'Tần số đỉnh (Hz)' }, { value: 'temp', label: 'Nhiệt độ (°C)' },
]

function parseCSV(text: string, pointId: string) {
  // Columns: ts,load_state,quantity,axis,freq_hz,ref_value,dut_value,capture_id,reference_device,reference_cert
  const lines = text.trim().split(/\r?\n/)
  const head = lines[0].split(',').map((s) => s.trim())
  return lines.slice(1).filter(Boolean).map((l) => {
    const c = l.split(',')
    const row: any = { point_id: pointId }
    head.forEach((h, i) => {
      const v = c[i]?.trim()
      if (!v) return
      row[h] = ['freq_hz', 'ref_value', 'dut_value'].includes(h) ? Number(v) : v
    })
    return row
  })
}

export default function Accuracy() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [point, setPoint] = useState<string>()
  const { data: points = [] } = useQuery<any[]>({ queryKey: ['points'], queryFn: () => api('/points') })
  const { data: tests = [] } = useQuery<any[]>({ queryKey: ['acc', point], queryFn: () => api('/accuracy-tests', { params: { point_id: point } }), enabled: !!point })
  const { data: rep } = useQuery<any>({ queryKey: ['accrep', point], queryFn: () => api('/accuracy-tests/report', { params: { point_id: point } }), enabled: !!point })
  const { data: caps = [] } = useQuery<any[]>({ queryKey: ['caps-acc', point], queryFn: () => api(`/points/${point}/captures`, { params: { limit: 50 } }), enabled: !!point })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['acc', point] }); qc.invalidateQueries({ queryKey: ['accrep', point] }) }
  const add = async (rows: any[]) => {
    try {
      await post('/accuracy-tests', rows)
      message.success(`Đã thêm ${rows.length} phép đo`)
      refresh()
    } catch (e: any) {
      message.error(e.message)
    }
  }
  return (
    <div className="page">
      <Space wrap style={{ marginBottom: 12 }}>
        <Select showSearch placeholder="Chọn điểm đo" style={{ width: 320 }} value={point} onChange={setPoint}
          options={points.map((p) => ({ value: p.id, label: `${p.machine_id} · ${p.name}` }))} />
        {point && <Button onClick={() => download('/accuracy-tests/report', `bien-ban-${point}.pdf`, { point_id: point, format: 'pdf' })}>Xuất biên bản PDF</Button>}
      </Space>
      <Alert style={{ marginBottom: 12 }} type="info" showIcon
        message="Tiêu chí (mục 9.2): e = |X_dut − X_ref| / X_ref; đạt khi mean(e) ≤ 5% và P95(e) ≤ 8%; tần số đỉnh ≤ 1 bin; nhiệt độ ≤ 2 °C." />
      {point && (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={8}>
            {can('analyst') && (
              <Card size="small" title="Nhập số đo thiết bị đối chứng">
                <Form layout="vertical" onFinish={(v) => add([{ ...v, point_id: point }])} initialValues={{ quantity: 'iso_vrms', axis: 'x' }}>
                  <Form.Item name="reference_device" label="Thiết bị chuẩn"><Input placeholder="model, số seri" /></Form.Item>
                  <Form.Item name="reference_cert" label="Số giấy hiệu chuẩn"><Input /></Form.Item>
                  <Form.Item name="load_state" label="Trạng thái tải"><Select options={['không tải', '50%', '80%', 'đầy tải'].map((x) => ({ value: x, label: x }))} /></Form.Item>
                  <Space>
                    <Form.Item name="quantity" label="Đại lượng"><Select style={{ width: 200 }} options={QUANTITIES} /></Form.Item>
                    <Form.Item name="axis" label="Trục"><Select style={{ width: 70 }} options={['x', 'y', 'z'].map((a) => ({ value: a, label: a }))} /></Form.Item>
                  </Space>
                  <Form.Item name="freq_hz" label="Tần số / Δf (Hz)"><InputNumber style={{ width: '100%' }} /></Form.Item>
                  <Form.Item name="ref_value" label="Giá trị chuẩn" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
                  <Form.Item name="capture_id" label="Capture đồng thời (tự lấy giá trị cảm biến)">
                    <Select allowClear options={caps.map((c) => ({ value: c.capture_id, label: `${dt(c.ts)} · ${c.profile}` }))} />
                  </Form.Item>
                  <Form.Item name="dut_value" label="Giá trị cảm biến (nếu không chọn capture)"><InputNumber style={{ width: '100%' }} /></Form.Item>
                  <Button type="primary" htmlType="submit" block>Thêm</Button>
                </Form>
                <Upload accept=".csv" showUploadList={false} beforeUpload={(f) => { f.text().then((t) => add(parseCSV(t, point))); return false }}>
                  <Button style={{ marginTop: 8 }} block>Nhập file CSV</Button>
                </Upload>
                <div className="muted">Cột CSV: ts,load_state,quantity,axis,freq_hz,ref_value,dut_value,capture_id,reference_device,reference_cert</div>
              </Card>
            )}
          </Col>
          <Col xs={24} lg={16}>
            <Card size="small" title={<Space>Kết luận {rep && (rep.pass ? <Tag color="green">ĐẠT</Tag> : <Tag color="red">CHƯA ĐẠT</Tag>)}</Space>}>
              <Table sticky={STICKY_HEAD} size="small" pagination={false} rowKey={(r: any) => r.quantity + r.load_state} dataSource={rep?.summary || []} columns={[
                { title: 'Đại lượng', dataIndex: 'quantity' }, { title: 'Tải', dataIndex: 'load_state' }, { title: 'n', dataIndex: 'n' },
                { title: 'mean(e)', dataIndex: 'mean_pct', render: (v, r: any) => `${num(v)} ${['temp', 'peak_freq'].includes(r.quantity) ? (r.quantity === 'temp' ? '°C' : 'Hz') : '%'}` },
                { title: 'P95(e)', dataIndex: 'p95_pct', render: (v) => num(v) },
                { title: 'Kết luận', dataIndex: 'pass', render: (p) => (p ? <Tag color="green">Đạt</Tag> : <Tag color="red">Không đạt</Tag>) },
              ]} />
            </Card>
            <Card size="small" title="Số liệu" style={{ marginTop: 12 }}>
              <Table sticky={STICKY_HEAD} size="small" rowKey="id" dataSource={tests} columns={[
                { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v) }, { title: 'Tải', dataIndex: 'load_state' },
                { title: 'Đại lượng', dataIndex: 'quantity' }, { title: 'Trục', dataIndex: 'axis' },
                { title: 'Chuẩn', dataIndex: 'ref_value', render: (v) => num(v, 3) }, { title: 'Cảm biến', dataIndex: 'dut_value', render: (v) => num(v, 3) },
                { title: 'e', dataIndex: 'error_pct', render: (v) => num(v) }, { title: 'Capture', dataIndex: 'capture_id', responsive: ['xl'] },
              ]} />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
