import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Form, Input, InputNumber, Modal, Progress, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import { PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { api, patch, post, put } from '../api/client'
import MachineSetupWizard from '../components/MachineSetupWizard'
import { useAuth } from '../auth'
import { dt, num } from '../utils/format'

function JsonEditor({ value, onSave, disabled }: { value: any; onSave: (v: any) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState(JSON.stringify(value ?? null, null, 2))
  const [err, setErr] = useState<string>()
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Input.TextArea rows={10} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'monospace' }} disabled={disabled} />
      {err && <Tag color="red">{err}</Tag>}
      {!disabled && <Button onClick={async () => {
        try {
          await onSave(JSON.parse(text))
          setErr(undefined)
        } catch (e: any) {
          setErr(e.message)
        }
      }}>Lưu</Button>}
    </Space>
  )
}

function MachinesTab() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [edit, setEdit] = useState<any>()
  const [creating, setCreating] = useState(false)
  const { data = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  return (
    <>
      <div className="page-hero" style={{ marginBottom: 14 }}>
        <div><div className="page-kicker">Asset configuration</div><Typography.Title level={3} style={{ margin: 0 }}>Hồ sơ máy & ngưỡng đo</Typography.Title><div className="muted">Khai báo đúng thông số để tự động chọn ISO và cấu hình phân tích.</div></div>
        {can('admin') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Thêm máy</Button>}
      </div>
      <Table size="small" rowKey="id" dataSource={data} columns={[
        { title: 'Mã', dataIndex: 'id' }, { title: 'Tên', dataIndex: 'name' }, { title: 'Site', dataIndex: 'site_id' },
        { title: 'kW', dataIndex: 'rated_power_kw' }, { title: 'v/ph', dataIndex: 'rated_speed_rpm' },
        { title: 'ISO', key: 'iso', render: (_, r: any) => `nhóm ${r.iso_group}, ${r.foundation}` },
        { title: 'Hồ sơ', key: 'profile', render: (_, r: any) => { const fields = [r.type, r.rated_power_kw, r.rated_speed_rpm, r.mounting, r.foundation, r.meta?.bearing_type]; const pct = Math.round(fields.filter(Boolean).length / fields.length * 100); return <Progress percent={pct} size="small" style={{ width: 100 }} strokeColor={pct === 100 ? '#34d399' : '#22d3ee'} /> } },
        { title: 'Cô lập nhiễu', dataIndex: 'isolation', render: (i) => (i?.enabled ? <Tag color="cyan">bật</Tag> : '') },
        { title: '', key: 'e', render: (_, r: any) => <Button size="small" icon={<SettingOutlined />} onClick={() => setEdit(r)}>Cấu hình</Button> },
      ]} />
      <MachineSetupWizard open={creating} sites={sites} onClose={() => setCreating(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['machines'] })} />
      <MachineSetupWizard open={!!edit} machine={edit} sites={sites} onClose={() => setEdit(undefined)} onSaved={() => qc.invalidateQueries({ queryKey: ['machines'] })} />
    </>
  )
}

function BearingsTab() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { data = [] } = useQuery<any[]>({ queryKey: ['bearings'], queryFn: () => api('/bearings') })
  const [form] = Form.useForm()
  return (
    <>
      <Table size="small" rowKey="id" dataSource={data} pagination={false} columns={[
        { title: 'Model', dataIndex: 'model' }, { title: 'Hãng', dataIndex: 'maker' }, { title: 'Số bi N', dataIndex: 'n_balls' },
        { title: 'Bd (mm)', dataIndex: 'bd_mm' }, { title: 'Pd (mm)', dataIndex: 'pd_mm' }, { title: 'β (°)', dataIndex: 'contact_deg' },
        { title: 'BPFO×', dataIndex: 'bpfo_x' }, { title: 'BPFI×', dataIndex: 'bpfi_x' },
      ]} />
      {can('analyst') && (
        <Form form={form} layout="inline" style={{ marginTop: 12 }} onFinish={async (v) => {
          try {
            await post('/bearings', v)
            form.resetFields()
            qc.invalidateQueries({ queryKey: ['bearings'] })
          } catch (e: any) {
            message.error(e.message)
          }
        }}>
          <Form.Item name="model" rules={[{ required: true }]}><Input placeholder="Model" style={{ width: 100 }} /></Form.Item>
          <Form.Item name="maker"><Input placeholder="Hãng" style={{ width: 90 }} /></Form.Item>
          <Form.Item name="n_balls"><InputNumber placeholder="N" /></Form.Item>
          <Form.Item name="bd_mm"><InputNumber placeholder="Bd mm" /></Form.Item>
          <Form.Item name="pd_mm"><InputNumber placeholder="Pd mm" /></Form.Item>
          <Form.Item name="contact_deg" initialValue={0}><InputNumber placeholder="β" /></Form.Item>
          <Button htmlType="submit" type="primary">Thêm</Button>
        </Form>
      )}
    </>
  )
}

function BaselinesTab() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const { message } = App.useApp()
  const [point, setPoint] = useState<string>()
  const { data: points = [] } = useQuery<any[]>({ queryKey: ['points'], queryFn: () => api('/points') })
  const { data = [] } = useQuery<any[]>({ queryKey: ['baselines', point], queryFn: () => api('/baselines', { params: { point_id: point } }) })
  const upd = async (id: number, body: any) => {
    try {
      await put(`/baselines/${id}`, body)
      qc.invalidateQueries({ queryKey: ['baselines'] })
    } catch (e: any) {
      message.error(e.message)
    }
  }
  return (
    <>
      <Space style={{ marginBottom: 8 }}>
        <Select allowClear placeholder="Điểm đo" style={{ width: 280 }} value={point} onChange={setPoint}
          options={points.map((p) => ({ value: p.id, label: `${p.machine_id} · ${p.name}` }))} />
        {can('analyst') && <Button onClick={() => post('/analytics/run', { job: 'baseline_learn' }).then(() => message.success('Đang học baseline…'))}>Học baseline ngay</Button>}
      </Space>
      <Table size="small" rowKey="id" dataSource={data} columns={[
        { title: 'Điểm', dataIndex: 'point_id' }, { title: 'Đặc trưng', dataIndex: 'feature' }, { title: 'Nhóm tải', dataIndex: 'load_bin' },
        { title: 'Median', dataIndex: 'median', render: (v) => num(v, 3) }, { title: 'MAD/σ', key: 's', render: (_, r: any) => `${num(r.mad, 3)} / ${num(r.std, 3)}` },
        { title: 'n', dataIndex: 'n_samples' }, { title: 'Phương pháp', dataIndex: 'method' },
        { title: 'W', dataIndex: 'warn', render: (v) => num(v, 3) }, { title: 'A', dataIndex: 'alarm', render: (v) => num(v, 3) },
        { title: 'Trạng thái', dataIndex: 'status', render: (s, r: any) => can('analyst')
          ? <Select size="small" value={s} style={{ width: 110 }} onChange={(v) => upd(r.id, { status: v })}
            options={[{ value: 'learning', label: 'đang học' }, { value: 'active', label: 'hiệu lực' }, { value: 'frozen', label: 'khóa' }]} />
          : s },
        { title: 'Cập nhật', dataIndex: 'updated_at', render: (v) => dt(v), responsive: ['xl'] },
      ]} />
    </>
  )
}

function RulesTab() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { data = [] } = useQuery<any[]>({ queryKey: ['rules'], queryFn: () => api('/alarm-rules') })
  const [edit, setEdit] = useState<any>()
  return (
    <>
      <Table size="small" rowKey="id" dataSource={data} columns={[
        { title: 'Phạm vi', key: 'sc', render: (_, r: any) => `${r.scope}${r.scope_id ? ':' + r.scope_id : ''}` },
        { title: 'Luật', dataIndex: 'rule' }, { title: 'Mức', dataIndex: 'severity' },
        { title: 'Tham số', dataIndex: 'params', render: (p) => <code style={{ fontSize: 11 }}>{JSON.stringify(p)}</code> },
        { title: 'Bật', dataIndex: 'enabled', render: (v) => (v ? '✓' : '') },
        { title: '', key: 'e', render: (_, r: any) => can('analyst') && <Button size="small" onClick={() => setEdit(r)}>Sửa</Button> },
      ]} />
      <Modal open={!!edit} title={`Luật ${edit?.rule}`} footer={null} onCancel={() => setEdit(undefined)} destroyOnClose>
        {edit && <JsonEditor value={edit.params} onSave={async (params) => {
          await patch(`/alarm-rules/${edit.id}`, { ...edit, params })
          message.success('Đã lưu')
          setEdit(undefined)
          qc.invalidateQueries({ queryKey: ['rules'] })
        }} />}
      </Modal>
    </>
  )
}

function UsersTab() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { data = [] } = useQuery<any[]>({ queryKey: ['users'], queryFn: () => api('/users') })
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)} style={{ marginBottom: 8 }}>Thêm người dùng</Button>
      <Table size="small" rowKey="id" dataSource={data} columns={[
        { title: 'Email', dataIndex: 'email' }, { title: 'Tên', dataIndex: 'name' }, { title: 'SĐT', dataIndex: 'phone' },
        { title: 'Quyền', dataIndex: 'roles', render: (rs) => rs.map((r: any, i: number) => <Tag key={i}>{r.role}@{r.site_id || r.tenant_id || 'toàn hệ thống'}</Tag>) },
        { title: 'Hoạt động', dataIndex: 'active', render: (v) => (v ? '✓' : '✗') },
      ]} />
      <Modal open={open} title="Người dùng mới" onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={async (v) => {
          try {
            await post('/users', { ...v, roles: [{ site_id: v.site_id || null, tenant_id: null, role: v.role }] })
            setOpen(false)
            form.resetFields()
            qc.invalidateQueries({ queryKey: ['users'] })
          } catch (e: any) {
            message.error(e.message)
          }
        }}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Tên"><Input /></Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="phone" label="SĐT"><Input /></Form.Item>
          <Form.Item name="telegram_chat_id" label="Telegram chat id"><Input /></Form.Item>
          <Form.Item name="zalo_id" label="Zalo user id"><Input /></Form.Item>
          <Form.Item name="role" label="Vai trò" initialValue="viewer"><Select options={['viewer', 'operator', 'engineer', 'analyst', 'admin'].map((r) => ({ value: r, label: r }))} /></Form.Item>
          <Form.Item name="site_id" label="Site (để trống = toàn hệ thống)"><Select allowClear options={sites.map((s) => ({ value: s.id, label: s.name }))} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function NotifyTab() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data = [] } = useQuery<any[]>({ queryKey: ['prefs'], queryFn: () => api('/notification-prefs') })
  const channels = ['email', 'telegram', 'zalo', 'sms']
  const rows = channels.map((c) => data.find((d) => d.channel === c) || { channel: c, min_severity: 'warning', enabled: false })
  const save = async (next: any[]) => {
    await put('/notification-prefs', next.filter((r) => r.enabled))
    message.success('Đã lưu')
    qc.invalidateQueries({ queryKey: ['prefs'] })
  }
  return (
    <Table size="small" rowKey="channel" pagination={false} dataSource={rows} columns={[
      { title: 'Kênh', dataIndex: 'channel' },
      { title: 'Bật', dataIndex: 'enabled', render: (v, r: any) => <Switch checked={v} onChange={(c) => save(rows.map((x) => (x.channel === r.channel ? { ...x, enabled: c } : x)))} /> },
      { title: 'Mức tối thiểu', dataIndex: 'min_severity', render: (v, r: any) => (
        <Select value={v} style={{ width: 140 }} onChange={(s) => save(rows.map((x) => (x.channel === r.channel ? { ...x, min_severity: s } : x)))}
          options={[{ value: 'watch', label: 'Theo dõi' }, { value: 'warning', label: 'Cảnh báo' }, { value: 'danger', label: 'Nguy hiểm' }]} />) },
    ]} />
  )
}

export default function Settings() {
  const { can } = useAuth()
  return (
    <div className="page">
      <Card size="small">
        <Tabs items={[
          { key: 'm', label: 'Máy & ngưỡng', children: <MachinesTab /> },
          { key: 'b', label: 'Baseline', children: <BaselinesTab /> },
          { key: 'r', label: 'Luật cảnh báo', children: <RulesTab /> },
          { key: 'br', label: 'Vòng bi', children: <BearingsTab /> },
          ...(can('admin') ? [{ key: 'u', label: 'Người dùng', children: <UsersTab /> }] : []),
          { key: 'n', label: 'Thông báo của tôi', children: <NotifyTab /> },
        ]} />
      </Card>
    </div>
  )
}
