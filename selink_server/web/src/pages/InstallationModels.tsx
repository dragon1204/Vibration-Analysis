import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Drawer, Empty, Form, Input, Row, Select, Space, Tag, Upload } from 'antd'
import { api, patch, post } from '../api/client'
import { useAuth } from '../auth'

/** Algorithms the platform runs today (mirrors SUPPORTED_ALGORITHMS in common/installation.py). */
const SUPPORTED = new Set(['iso_corrected_rms', 'bearing_envelope', 'run_detection'])
const algorithmLabel = (id: string, label: string) => SUPPORTED.has(id) ? label : `${label} (chưa hỗ trợ)`
const ALGORITHMS = [
  ['iso_corrected_rms', 'ISO corrected RMS'], ['bearing_envelope', 'Bearing envelope'], ['run_detection', 'RUN detection'],
  ['alignment_screening', 'Alignment screening'], ['unbalance_screening', 'Unbalance screening'],
  ['hydraulic_vane_pass', 'Hydraulic / vane-pass'], ['belt_frequency', 'Belt frequency'],
  ['fan_blade_pass', 'Fan blade-pass'], ['gear_mesh', 'Gear mesh'], ['screw_lobe_mesh', 'Screw lobe mesh'], ['axial_thrust', 'Axial / thrust'],
]
const SLOT_ROLES = ['bearing', 'base', 'driver', 'driven', 'gearbox_input', 'gearbox_output', 'thrust']

const emptyModel = () => ({ asset_class: 'rotating_machine', slots: [
  { code: 'DE', label: 'Drive end', role: 'bearing', axes: ['x', 'y', 'z'], x: 42, y: 34 },
  { code: 'BASE', label: 'Foundation', role: 'base', axes: ['x', 'y', 'z'], x: 60, y: 69 },
], algorithms: ['iso_corrected_rms', 'bearing_envelope', 'run_detection'] })

function payload(values: any) {
  return {
    id: values.id?.trim() || undefined, name: values.name.trim(), description: values.description || '', asset_class: values.asset_class,
    image_url: values.image_url || undefined, algorithms: values.algorithms || [], parameters: {},
    slots: (values.slots || []).map((slot: any) => ({ code: slot.code, label: slot.label || slot.code, role: slot.role, axes: slot.axes || ['x', 'y', 'z'], marker: { x: Number(slot.x), y: Number(slot.y) } })),
  }
}

export default function InstallationModels() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [editing, setEditing] = useState<any>()
  const [image, setImage] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { data: models = [], isLoading } = useQuery<any[]>({ queryKey: ['installation-models'], queryFn: () => api('/installation-models') })

  useEffect(() => {
    if (!editing) return
    form.setFieldsValue(editing.id ? {
      ...editing,
      slots: (editing.slots || []).map((slot: any) => ({ ...slot, x: slot.marker?.x ?? 50, y: slot.marker?.y ?? 50 })),
    } : emptyModel())
    setImage(undefined)
  }, [editing, form])

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const body = payload(values)
      const model = editing.id ? await patch(`/installation-models/${editing.id}`, body) : await post('/installation-models', body)
      if (image) await api(`/installation-models/${model.id}/image`, { method: 'POST', body: (() => { const data = new FormData(); data.append('image', image); return data })() })
      message.success(editing.id ? 'Đã cập nhật mô hình' : 'Đã thêm mô hình')
      setEditing(undefined)
      qc.invalidateQueries({ queryKey: ['installation-models'] })
    } catch (error: any) {
      message.error(error.message || 'Không thể lưu mô hình')
    } finally {
      setSaving(false)
    }
  }

  return <div className="page model-library-page">
    <div className="page-hero">
      <div><div className="page-kicker">Installation model library</div><h1 className="page-heading">Mô hình lắp đặt</h1><p className="page-description">Định nghĩa ảnh sơ đồ, vị trí cảm biến và các thuật toán được phép áp dụng cho từng kiểu máy.</p></div>
      {can('analyst') && <Button type="primary" onClick={() => setEditing({})}>Thêm mô hình</Button>}
    </div>
    <Row gutter={[16, 16]}>
      {models.map((model) => <Col xs={24} md={12} xl={8} key={model.id}>
        <Card className="installation-model-card" loading={isLoading} cover={model.image_url ? <img src={model.image_url} alt={model.name} /> : undefined}
          actions={can('analyst') ? [<Button type="link" onClick={() => setEditing(model)}>Cấu hình</Button>] : undefined}>
          <Card.Meta title={<Space><span>{model.name}</span>{model.builtin && <Tag>Built-in</Tag>}</Space>} description={model.description || 'Chưa có mô tả'} />
          <div className="model-tags"><span>Sensor slots</span>{(model.slots || []).map((slot: any) => <Tag key={slot.code} color={slot.role === 'base' ? 'default' : 'blue'}>{slot.code}</Tag>)}</div>
          <div className="model-tags"><span>Algorithms</span>{(model.algorithms || []).map((algorithm: string) => <Tag key={algorithm} color={SUPPORTED.has(algorithm) ? 'cyan' : 'default'}>{algorithmLabel(algorithm, ALGORITHMS.find(([id]) => id === algorithm)?.[1] || algorithm)}</Tag>)}</div>
        </Card>
      </Col>)}
    </Row>
    {!isLoading && !models.length && <Empty description="Chưa có mô hình lắp đặt" />}
    <Drawer open={!!editing} width={760} onClose={() => setEditing(undefined)} title={editing?.id ? `Cấu hình mô hình · ${editing.name}` : 'Thêm mô hình lắp đặt'}
      extra={<Button type="primary" loading={saving} onClick={save}>Lưu mô hình</Button>} destroyOnClose>
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="image_url" hidden><Input /></Form.Item>
        <Row gutter={12}><Col span={10}><Form.Item name="id" label="Model ID" rules={[{ required: !editing?.id }, { pattern: /^[a-z][a-z0-9-]{2,63}$/, message: 'lowercase, number, -' }]}><Input disabled={!!editing?.id} placeholder="motor-pump-4point" /></Form.Item></Col>
          <Col span={14}><Form.Item name="name" label="Tên mô hình" rules={[{ required: true }]}><Input placeholder="Motor–pump · 4 sensors" /></Form.Item></Col></Row>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="asset_class" label="Nhóm thiết bị"><Select options={['standalone_motor', 'motor_pump', 'motor_fan', 'motor_gearbox', 'vertical_pump', 'screw_compressor', 'rotating_machine'].map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item label="Ảnh sơ đồ"><Upload maxCount={1} accept="image/*" beforeUpload={(file) => { setImage(file); return false }} onRemove={() => setImage(undefined)}><Button>Tải ảnh sơ đồ</Button></Upload><div className="muted">PNG/JPG tối đa 10 MB. Ảnh sẽ được lưu cùng mô hình.</div></Form.Item>
        <Form.List name="slots">{(fields, { add, remove }) => <Card size="small" title="Vị trí cảm biến" extra={<Button size="small" onClick={() => add({ role: 'bearing', axes: ['x', 'y', 'z'], x: 50, y: 50 })}>Thêm vị trí</Button>}>
          {fields.map((field) => <Row gutter={8} key={field.key} align="middle"><Col span={3}><Form.Item {...field} name={[field.name, 'code']} rules={[{ required: true }]}><Input placeholder="DE" /></Form.Item></Col><Col span={4}><Form.Item {...field} name={[field.name, 'label']}><Input placeholder="Drive end" /></Form.Item></Col><Col span={4}><Form.Item {...field} name={[field.name, 'role']}><Select options={SLOT_ROLES.map((value) => ({ value, label: value }))} /></Form.Item></Col><Col span={4}><Form.Item {...field} name={[field.name, 'axes']}><Select mode="multiple" options={['x', 'y', 'z'].map((value) => ({ value, label: value.toUpperCase() }))} /></Form.Item></Col><Col span={3}><Form.Item {...field} name={[field.name, 'x']}><Input type="number" placeholder="X %" /></Form.Item></Col><Col span={3}><Form.Item {...field} name={[field.name, 'y']}><Input type="number" placeholder="Y %" /></Form.Item></Col><Col span={3}><Button danger type="text" onClick={() => remove(field.name)}>Xóa</Button></Col></Row>)}</Card>}</Form.List>
        <Form.Item name="algorithms" label="Thuật toán áp dụng" rules={[{ required: true }]} style={{ marginTop: 16 }}><Select mode="multiple" options={ALGORITHMS.map(([value, label]) => ({ value, label: algorithmLabel(value, label) }))} /></Form.Item>
      </Form>
    </Drawer>
  </div>
}
