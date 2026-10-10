import { useEffect, useMemo, useState } from 'react'
import { App, Alert, Button, Card, Col, Drawer, Form, Input, InputNumber, Radio, Row, Select, Steps, Tag, Typography } from 'antd'
import { CheckCircleFilled, DashboardOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons'
import { patch, post } from '../api/client'
import { num } from '../utils/format'

type Props = {
  open: boolean
  machine?: any
  sites: any[]
  onClose: () => void
  onSaved: () => void
}

const machineTypes = [
  { value: 'compressor_motor', label: 'Động cơ máy nén' },
  { value: 'pump_motor', label: 'Động cơ bơm' },
  { value: 'fan_motor', label: 'Động cơ quạt' },
  { value: 'gearbox', label: 'Hộp số / truyền động' },
  { value: 'other', label: 'Thiết bị quay khác' },
]

function limits(group: number, foundation: string) {
  if (group === 1) return foundation === 'flexible' ? [3.5, 7.1, 11] : [2.3, 4.5, 7.1]
  return foundation === 'flexible' ? [2.3, 4.5, 7.1] : [1.4, 2.8, 4.5]
}

export default function MachineSetupWizard({ open, machine, sites, onClose, onSaved }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const power = Form.useWatch('rated_power_kw', form) || 0
  const rpm = Form.useWatch('rated_speed_rpm', form) || 0
  const foundation = Form.useWatch('foundation', form) || 'rigid'
  const isoGroup = power > 300 ? 1 : 2
  const isoBandLo = rpm > 0 && rpm <= 600 ? 2 : 10
  const iso = useMemo(() => limits(isoGroup, foundation), [isoGroup, foundation])

  useEffect(() => {
    if (!open) return
    setStep(0)
    form.setFieldsValue(machine ? {
      ...machine,
      bearing_type: machine.meta?.bearing_type,
      bearing_model: machine.meta?.bearing_model,
      bearing_outer_diameter_mm: machine.meta?.bearing_outer_diameter_mm,
      coupling: machine.meta?.coupling || 'flexible',
    } : {
      line_freq_hz: 50, mounting: 'horizontal', foundation: 'rigid', coupling: 'flexible',
      insulation_class: 'F', type: 'pump_motor',
    })
  }, [open, machine, form])

  const next = async () => {
    const fields = step === 0
      ? ['id', 'site_id', 'name', 'type', 'maker', 'model', 'rated_power_kw', 'rated_speed_rpm']
      : ['mounting', 'foundation', 'coupling']
    await form.validateFields(fields)
    setStep((s) => Math.min(2, s + 1))
  }

  const save = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const { bearing_type, bearing_model, bearing_outer_diameter_mm, coupling, ...base } = v
      const payload = {
        ...base,
        iso_group: isoGroup,
        iso_band_lo_hz: isoBandLo,
        iso_band_hi_hz: 1000,
        meta: { ...(machine?.meta || {}), bearing_type, bearing_model, bearing_outer_diameter_mm, coupling },
      }
      if (machine) await patch(`/machines/${machine.id}`, payload)
      else await post('/machines', payload)
      message.success(machine ? 'Đã cập nhật cấu hình máy' : 'Đã thêm máy mới')
      onSaved()
      onClose()
    } catch (e: any) {
      message.error(e.message || 'Không thể lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={720} destroyOnClose
      title={machine ? `Cấu hình · ${machine.name}` : 'Thêm thiết bị giám sát'}
      extra={<Tag color="cyan">ISO 20816-3</Tag>}
      footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={step ? () => setStep(step - 1) : onClose}>{step ? 'Quay lại' : 'Hủy'}</Button>
        {step < 2 ? <Button type="primary" onClick={next}>Tiếp tục</Button> : <Button type="primary" loading={saving} onClick={save}>Lưu & áp dụng ngưỡng</Button>}
      </div>}>
      <Steps current={step} size="small" style={{ marginBottom: 28 }} items={[
        { title: 'Thông tin máy', icon: <DashboardOutlined /> },
        { title: 'Cơ khí & ổ bi', icon: <ToolOutlined /> },
        { title: 'ISO & xác nhận', icon: <SettingOutlined /> },
      ]} />
      <Form form={form} layout="vertical" requiredMark="optional">
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
          <Alert type="info" showIcon message="Nhập đúng thông số trên nhãn máy" description="Công suất và tốc độ được dùng để tự chọn nhóm ISO và dải tần đánh giá." style={{ marginBottom: 18 }} />
          <Row gutter={14}>
            <Col span={8}><Form.Item name="id" label="Mã thiết bị" rules={[{ required: true }]}><Input disabled={!!machine} placeholder="pump-04" /></Form.Item></Col>
            <Col span={16}><Form.Item name="site_id" label="Khu vực" rules={[{ required: true }]}><Select disabled={!!machine} options={sites.map((s) => ({ value: s.id, label: s.name }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="name" label="Tên hiển thị" rules={[{ required: true }]}><Input placeholder="Bơm nước sạch #4" /></Form.Item></Col>
            <Col span={12}><Form.Item name="type" label="Loại thiết bị" rules={[{ required: true }]}><Select options={machineTypes} /></Form.Item></Col>
            <Col span={6}><Form.Item name="maker" label="Hãng"><Input placeholder="HEM" /></Form.Item></Col>
            <Col span={6}><Form.Item name="model" label="Model"><Input placeholder="4KA355" /></Form.Item></Col>
            <Col span={8}><Form.Item name="rated_power_kw" label="Công suất định mức" rules={[{ required: true }]}><InputNumber min={0.1} addonAfter="kW" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="rated_speed_rpm" label="Tốc độ định mức" rules={[{ required: true }]}><InputNumber min={60} addonAfter="v/ph" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="poles" label="Số cực"><InputNumber min={2} max={32} step={2} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </div>
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <Typography.Title level={5}>Bố trí cơ khí</Typography.Title>
          <Row gutter={14}>
            <Col span={12}><Form.Item name="mounting" label="Hướng lắp máy" rules={[{ required: true }]}><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'horizontal', label: 'Nằm ngang' }, { value: 'vertical', label: 'Trục đứng' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="foundation" label="Kết cấu nền" rules={[{ required: true }]}><Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'rigid', label: 'Nền cứng' }, { value: 'flexible', label: 'Nền mềm' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="coupling" label="Liên kết truyền động" rules={[{ required: true }]}><Select options={[{ value: 'direct', label: 'Khớp nối trực tiếp' }, { value: 'flexible', label: 'Khớp nối mềm' }, { value: 'belt', label: 'Dây đai' }, { value: 'gear', label: 'Hộp số' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="bearing_type" label="Loại ổ"><Select allowClear options={[{ value: 'roller', label: 'Ổ lăn' }, { value: 'sleeve', label: 'Ổ trượt' }, { value: 'unknown', label: 'Chưa xác định' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="bearing_model" label="Mã vòng bi"><Input placeholder="SKF 6322" /></Form.Item></Col>
            <Col span={12}><Form.Item name="bearing_outer_diameter_mm" label="Đường kính ngoài vòng bi"><InputNumber min={1} addonAfter="mm" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Alert type="warning" showIcon message="Đường kính ngoài không đủ để tính BPFO/BPFI" description="Để chẩn đoán vòng bi chính xác, bổ sung số bi, đường kính bi, đường kính vòng chia và góc tiếp xúc trong danh mục Vòng bi." />
        </div>
        <div style={{ display: step === 2 ? 'block' : 'none' }}>
          <Alert type="success" showIcon icon={<CheckCircleFilled />} message="Cấu hình đo được đề xuất tự động" description={`Máy ${num(power, 0)} kW, ${num(rpm, 0)} v/ph → ISO nhóm ${isoGroup}, dải ${isoBandLo}–1000 Hz.`} style={{ marginBottom: 18 }} />
          <Row gutter={[12, 12]}>
            {[['A / B', iso[0], '#34d399', 'Tốt'], ['B / C', iso[1], '#fbbf24', 'Theo dõi'], ['C / D', iso[2], '#fb7185', 'Nguy hiểm']].map(([label, value, color, hint]) => (
              <Col span={8} key={String(label)}><Card size="small" style={{ borderTop: `3px solid ${color}` }}><div className="muted">{label} · {hint}</div><Typography.Title level={3} style={{ margin: '8px 0 0', color: String(color) }}>{num(Number(value), 1)} <small style={{ fontSize: 11 }}>mm/s RMS</small></Typography.Title></Card></Col>
            ))}
          </Row>
          <Card size="small" style={{ marginTop: 14 }} title="Cấu hình sẽ áp dụng">
            <Row gutter={[16, 12]}>
              <Col span={12}><div className="metric-line"><span>Nhóm ISO</span><strong>Nhóm {isoGroup}</strong></div></Col>
              <Col span={12}><div className="metric-line"><span>Nền máy</span><strong>{foundation === 'rigid' ? 'Cứng' : 'Mềm'}</strong></div></Col>
              <Col span={12}><div className="metric-line"><span>Tần số quay 1X</span><strong>{num(rpm / 60, 2)} Hz</strong></div></Col>
              <Col span={12}><div className="metric-line"><span>Dải RMS ISO</span><strong>{isoBandLo}–1000 Hz</strong></div></Col>
            </Row>
          </Card>
        </div>
      </Form>
    </Drawer>
  )
}
