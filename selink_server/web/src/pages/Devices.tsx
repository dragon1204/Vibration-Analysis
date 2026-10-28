import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Descriptions, Drawer, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { api, post } from '../api/client'
import { useRealtime } from '../api/realtime'
import { useAuth } from '../auth'
import { ago, dt, num } from '../utils/format'
import AddGateway from '../components/AddGateway'
import MachineSetupWizard from '../components/MachineSetupWizard'

export default function Devices() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const nav = useNavigate()
  const { message } = App.useApp()
  const [open, setOpen] = useState<string>()
  const [configuredMachine, setConfiguredMachine] = useState<any>()
  const [deploymentMachine, setDeploymentMachine] = useState<string>()
  const [deploying, setDeploying] = useState(false)
  const [assignmentGateway, setAssignmentGateway] = useState<string>()
  const [assignmentMachine, setAssignmentMachine] = useState<string>()
  const [assigning, setAssigning] = useState(false)
  const [cmd, setCmd] = useState<{ type: string; point_id?: string; profile?: string; url?: string; sha256?: string; machine_id?: string } | null>(null)
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['gateways'], queryFn: () => api('/gateways'), refetchInterval: 30_000 })
  const { data: gw } = useQuery<any>({ queryKey: ['gateway', open], queryFn: () => api(`/gateways/${open}`), enabled: !!open })
  const { data: machines = [] } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api('/machines') })
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  useRealtime(['gateways'], (m) => {
    if (m.data.type === 'cmd_ack') message.info(`${m.data.gateway_id}: ${m.data.cmd_id} → ${m.data.status} ${m.data.detail || ''}`)
    qc.invalidateQueries({ queryKey: ['gateways'] })
    if (open) qc.invalidateQueries({ queryKey: ['gateway', open] })
  })
  const send = async () => {
    if (!cmd || !open) return
    const { machine_id, ...rest } = cmd
    try {
      const r = await post(`/gateways/${open}/commands`, { ...rest, params: machine_id ? { machine_id } : undefined })
      message.success(`Đã gửi ${r.cmd_id}`)
      setCmd(null)
      qc.invalidateQueries({ queryKey: ['gateway', open] })
    } catch (e: any) {
      message.error(e.message)
    }
  }
  const h = gw?.health || {}
  const machinesOfGw = [...new Set((gw?.points || []).map((p: any) => p.machine_id))] as string[]
  const connectedDevices = machinesOfGw.map((id) => machines.find((machine: any) => machine.id === id) || { id, name: id })
  const deploy = async () => {
    if (!open || !deploymentMachine) return
    setDeploying(true)
    try {
      const result = await post(`/gateways/${open}/deployments`, { machine_id: deploymentMachine })
      message.success(result.unchanged ? 'Gateway đã được gán cho máy này' : `Đã chuyển gateway sang máy mới · cấu hình v${result.config_version}`)
      setDeploymentMachine(undefined)
      qc.invalidateQueries({ queryKey: ['gateways'] })
      qc.invalidateQueries({ queryKey: ['gateway', open] })
      qc.invalidateQueries({ queryKey: ['machines'] })
    } catch (e: any) { message.error(e.message) } finally { setDeploying(false) }
  }
  const assignFromBoard = async () => {
    if (!assignmentGateway || !assignmentMachine) return
    setAssigning(true)
    try {
      const result = await post(`/gateways/${assignmentGateway}/deployments`, { machine_id: assignmentMachine })
      message.success(result.unchanged ? 'Gateway đã được gán cho máy này' : `Đã phân công thành công · cấu hình v${result.config_version}`)
      setAssignmentMachine(undefined)
      qc.invalidateQueries({ queryKey: ['gateways'] })
      qc.invalidateQueries({ queryKey: ['gateway', assignmentGateway] })
      qc.invalidateQueries({ queryKey: ['machines'] })
    } catch (e: any) { message.error(e.message) } finally { setAssigning(false) }
  }
  const selectedGatewayInfo = data.find((gateway: any) => gateway.id === assignmentGateway)
  const assignmentMachines = machines.filter((machine: any) => !selectedGatewayInfo || machine.site_id === selectedGatewayInfo.site_id)
  return (
    <div className="page">
      {can('admin') && <AddGateway />}
      <div className="page-hero" style={{ marginBottom: 14 }}>
        <div><div className="page-kicker">Portable acquisition hardware</div><h1 className="page-heading">Thiết bị & gateway</h1><p className="page-description">Gateway là thiết bị di động. Mỗi lần phân công sẽ tạo một phiên đo gắn với máy, giữ nguyên lịch sử và chỉ đẩy cấu hình của máy đang đo.</p></div>
      </div>
      {can('analyst') && <Card size="small" className="gateway-assignment-board" title="Phân công gateway cho máy" style={{ marginBottom: 14 }} extra={<Typography.Text type="secondary">Một gateway · một máy tại một thời điểm</Typography.Text>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 1fr) minmax(260px, 1fr) auto', gap: 12, alignItems: 'center' }}>
          <Select value={assignmentGateway} placeholder="1. Chọn gateway" onChange={(value) => { setAssignmentGateway(value); setAssignmentMachine(undefined) }}
            options={data.map((gateway: any) => ({ value: gateway.id, label: `${gateway.id}${gateway.assigned_machine_name ? ` · đang đo ${gateway.assigned_machine_name}` : ' · chưa gán'}` }))} />
          <Select value={assignmentMachine} placeholder="2. Chọn động cơ / máy" disabled={!assignmentGateway} onChange={setAssignmentMachine}
            options={assignmentMachines.map((machine: any) => ({ value: machine.id, label: `${machine.name} (${machine.id})` }))} />
          <Button type="primary" loading={assigning} disabled={!assignmentGateway || !assignmentMachine} onClick={assignFromBoard}>Phân công & đẩy cấu hình</Button>
        </div>
        {selectedGatewayInfo?.assigned_machine_name && <Typography.Paragraph type="secondary" style={{ margin: '10px 0 0' }}>Xác nhận sẽ đóng phiên đo của <strong>{selectedGatewayInfo.assigned_machine_name}</strong>, giữ nguyên lịch sử, rồi kích hoạt cấu hình của máy mới.</Typography.Paragraph>}
      </Card>}
      <Card size="small" title="Gateway (T153)" loading={isLoading}>
        <Row gutter={[14, 14]}>
          {data.map((gateway: any) => <Col xs={24} md={12} xl={8} key={gateway.id}>
            <Card size="small" className="gateway-summary-card" title={<Space><strong>{gateway.id}</strong><Tag color={gateway.online ? 'green' : 'default'}>{gateway.online ? 'Trực tuyến' : 'Mất kết nối'}</Tag></Space>}
              extra={<Button type="link" size="small" onClick={() => setOpen(gateway.id)}>Chi tiết</Button>}>
              <Descriptions size="small" column={1} colon={false}>
                <Descriptions.Item label="Máy đang đo">{gateway.assigned_machine_id ? <strong>{gateway.assigned_machine_name || gateway.assigned_machine_id}</strong> : <Typography.Text type="secondary">Chưa gán</Typography.Text>}</Descriptions.Item>
                <Descriptions.Item label="Phiên đo">{gateway.deployment_started_at ? `Từ ${ago(gateway.deployment_started_at)}` : '–'}</Descriptions.Item>
                <Descriptions.Item label="Kết nối cuối">{ago(gateway.last_seen)}</Descriptions.Item>
                <Descriptions.Item label="Cấu hình">v{gateway.config_version} · {gateway.fw_version || '–'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>)}
        </Row>
      </Card>
      <Drawer
        open={!!open}
        width="min(1120px, 92vw)"
        rootStyle={{ top: 56, height: 'calc(100vh - 56px)' }}
        styles={{ body: { overflowY: 'auto' } }}
        onClose={() => setOpen(undefined)}
        title={`Gateway ${open}`}
      >
        {gw && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Trạng thái">{gw.online ? 'Trực tuyến' : 'Mất kết nối'}</Descriptions.Item>
              <Descriptions.Item label="Liên lạc cuối">{dt(gw.last_seen, true)}</Descriptions.Item>
              <Descriptions.Item label="Uptime">{num((h.uptime_s || 0) / 3600, 1)} giờ</Descriptions.Item>
              <Descriptions.Item label="Nhiệt SoC">{num(h.soc_temp_c, 1)} °C</Descriptions.Item>
              <Descriptions.Item label="Đĩa trống">{num(h.disk_free_mb, 0)} MB</Descriptions.Item>
              <Descriptions.Item label="Dữ liệu edge">{num(h.data_used_mb, 0)} MB</Descriptions.Item>
              <Descriptions.Item label="Outbox chờ gửi">{h.outbox_pending}</Descriptions.Item>
              <Descriptions.Item label="Còi/relay">{h.local_alarm_on ? <Tag color="red">BẬT</Tag> : 'tắt'}</Descriptions.Item>
              {/* Server receive time − gateway time; it includes delivery delay when the outbox has a backlog. */}
              <Descriptions.Item label="Đồng hồ gateway" span={2}>
                {h.time_unsynced ? <Tag color="red">CHƯA ĐỒNG BỘ GIỜ</Tag> : <Tag color="green">ĐÃ ĐỒNG BỘ</Tag>}
                {h.clock_offset_s != null && <span className="muted">lệch so với server {num(h.clock_offset_s, 1)} s</span>}
                {h.clock_step_s != null && <span className="muted"> | đã hiệu chỉnh dữ liệu đo trước khi đồng bộ {num(h.clock_step_s, 1)} s</span>}
              </Descriptions.Item>
            </Descriptions>
            <Card size="small" title="Phiên đo hiện tại" extra={can('analyst') && <Button type="primary" size="small" onClick={() => setDeploymentMachine(gw.deployment?.machine_id || machines[0]?.id)}>Gán / chuyển máy</Button>}>
              {gw.deployment ? <Descriptions size="small" column={2}>
                <Descriptions.Item label="Máy"><strong>{gw.deployment.machine_name}</strong></Descriptions.Item>
                <Descriptions.Item label="Bắt đầu">{dt(gw.deployment.started_at, true)}</Descriptions.Item>
                <Descriptions.Item label="Cấu hình edge">v{gw.deployment.config_version ?? '–'}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái"><Tag color="green">Đang đo</Tag></Descriptions.Item>
              </Descriptions> : <Typography.Text type="secondary">Gateway chưa gán máy. Gán máy trước, sau đó map cảm biến theo sơ đồ lắp đặt.</Typography.Text>}
              {can('analyst') && gw.deployment && <div style={{ marginTop: 10 }}><Popconfirm title="Dừng đo và bỏ gán máy hiện tại?" description="Gateway sẽ nhận cấu hình trống trước khi được di chuyển." okText="Bỏ gán" okButtonProps={{ danger: true }} onConfirm={() => post(`/gateways/${open}/unassign`, {}).then(() => { message.success('Đã bỏ gán gateway'); qc.invalidateQueries({ queryKey: ['gateway', open] }); qc.invalidateQueries({ queryKey: ['gateways'] }) }).catch((e) => message.error(e.message))}><Button danger size="small">Bỏ gán an toàn</Button></Popconfirm></div>}
            </Card>
            <Card size="small" title={`Thiết bị đi kèm (${connectedDevices.length})`} extra={<Typography.Text type="secondary">Liên kết qua cảm biến</Typography.Text>}>
              <Table size="small" pagination={false} rowKey="id" dataSource={connectedDevices} locale={{ emptyText: 'Gateway chưa được gán thiết bị. Thêm cảm biến cho máy để tạo liên kết.' }} columns={[
                { title: 'Thiết bị', key: 'device', render: (_, machine: any) => <><strong>{machine.name}</strong><br /><Typography.Text type="secondary">{machine.id}</Typography.Text></> },
                { title: 'Cảm biến', key: 'points', render: (_, machine: any) => (gw.points || []).filter((point: any) => point.machine_id === machine.id).map((point: any) => <Tag key={point.id}>{point.role || point.id}</Tag>) },
                { title: 'Cấu hình', key: 'actions', render: (_, machine: any) => <Space size="small"><Button size="small" onClick={() => nav(`/machines/${machine.id}`)}>Chi tiết</Button>{can('analyst') && <Button size="small" type="primary" onClick={() => setConfiguredMachine(machine)}>Cấu hình</Button>}</Space> },
              ]} />
            </Card>
            <Table size="small" pagination={false} rowKey="id" title={() => 'Cảm biến thuộc thiết bị'} dataSource={gw.points} columns={[
              { title: 'Thiết bị', key: 'machine', render: (_, r: any) => connectedDevices.find((machine: any) => machine.id === r.machine_id)?.name || r.machine_id },
              { title: 'Điểm', dataIndex: 'id' }, { title: 'Địa chỉ', dataIndex: 'sensor_addr', render: (a) => `0x${(a || 0).toString(16).toUpperCase()}` },
              { title: 'Đọc cuối', dataIndex: 'last_reading', render: (v) => ago(v) },
              { title: 'Lỗi (timeout/CRC)', key: 'err', render: (_, r: any) => {
                const busStats: any = Object.values(h.bus_stats || {})
                for (const b of busStats) {
                  const s = b.devices?.[r.id]
                  if (s) return `${s.timeouts}/${s.crc} trên ${s.requests}`
                }
                return '–'
              } },
              { title: 'Offline', key: 'off', render: (_, r: any) => (h.devices?.[r.id]?.offline ? <Tag color="red">offline</Tag> : <Tag color="green">ok</Tag>) },
            ]} />
            {can('analyst') && (
              <Space wrap>
                <Button onClick={() => setCmd({ type: 'ping' })}>Ping</Button>
                <Button onClick={() => setCmd({ type: 'capture_now', point_id: gw.points[0]?.id, profile: 'orders' })}>Chụp sóng ngay</Button>
                <Button onClick={() => setCmd({ type: 'group_capture', machine_id: machinesOfGw[0] })}>Capture nhóm (cô lập nhiễu)</Button>
                <Button onClick={() => setCmd({ type: 'learn_alpha', machine_id: machinesOfGw[0] })}>Học lại hệ số α</Button>
                <Button onClick={() => post(`/gateways/${open}/config/push`, {}).then((r) => message.success(`Cấu hình v${r.version}`)).catch((e) => message.error(e.message))}>Đẩy cấu hình</Button>
                {can('admin') && <Button danger onClick={() => setCmd({ type: 'reboot' })}>Khởi động lại</Button>}
                {can('admin') && <Button onClick={() => setCmd({ type: 'ota_update', url: '', sha256: '' })}>Cập nhật OTA</Button>}
              </Space>
            )}
            <Table size="small" rowKey="cmd_id" title={() => 'Lệnh gần đây'} dataSource={gw.commands} pagination={{ pageSize: 8 }} columns={[
              { title: 'Thời điểm', dataIndex: 'created_at', render: (v) => dt(v, true) }, { title: 'Lệnh', dataIndex: 'type' },
              { title: 'Kết quả', dataIndex: 'status', render: (s) => <Tag color={s === 'ok' ? 'green' : s === 'error' ? 'red' : 'blue'}>{s}</Tag> },
              { title: 'Chi tiết', dataIndex: 'detail' }, { title: 'Người gửi', dataIndex: 'created_by', responsive: ['lg'] },
            ]} />
          </Space>
        )}
      </Drawer>
      <MachineSetupWizard open={!!configuredMachine} machine={configuredMachine} sites={sites} onClose={() => setConfiguredMachine(undefined)} onSaved={() => {
        qc.invalidateQueries({ queryKey: ['machines'] })
        if (open) qc.invalidateQueries({ queryKey: ['gateway', open] })
      }} />
      <Modal open={!!cmd} title={`Gửi lệnh: ${cmd?.type}`} onCancel={() => setCmd(null)} onOk={send} okText="Gửi">
        {cmd && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {cmd.type === 'capture_now' && (
              <>
                <Select style={{ width: '100%' }} value={cmd.point_id} onChange={(v) => setCmd({ ...cmd, point_id: v })}
                  options={(gw?.points || []).map((p: any) => ({ value: p.id, label: p.id }))} />
                <Select style={{ width: '100%' }} value={cmd.profile} onChange={(v) => setCmd({ ...cmd, profile: v })}
                  options={['orders', 'iso', 'bearing'].map((p) => ({ value: p, label: p }))} />
              </>
            )}
            {(cmd.type === 'group_capture' || cmd.type === 'learn_alpha') && (
              <Select style={{ width: '100%' }} value={cmd.machine_id} onChange={(v) => setCmd({ ...cmd, machine_id: v })}
                options={machinesOfGw.map((m) => ({ value: m, label: m }))} />
            )}
            {cmd.type === 'ota_update' && (
              <>
                <Input placeholder="URL binary edge-agent (ARMv7)" value={cmd.url} onChange={(e) => setCmd({ ...cmd, url: e.target.value })} />
                <Input placeholder="SHA-256" value={cmd.sha256} onChange={(e) => setCmd({ ...cmd, sha256: e.target.value })} />
              </>
            )}
            {cmd.type === 'reboot' && <Typography.Text type="danger">Gateway sẽ khởi động lại sau 5 giây.</Typography.Text>}
          </Space>
        )}
      </Modal>
      <Modal open={!!deploymentMachine} title={`Phân công gateway ${open || ''}`} okText="Xác nhận & đẩy cấu hình" confirmLoading={deploying} onOk={deploy} onCancel={() => setDeploymentMachine(undefined)}>
        <Typography.Paragraph>Gateway chỉ đo một máy trong một phiên. Khi xác nhận, phiên cũ được đóng và cấu hình edge chỉ giữ máy mới.</Typography.Paragraph>
        <Select autoFocus style={{ width: '100%' }} value={deploymentMachine} onChange={setDeploymentMachine}
          options={machines.filter((m: any) => !gw || m.site_id === gw.site_id).map((m: any) => ({ value: m.id, label: `${m.name} (${m.id})` }))} />
      </Modal>
    </div>
  )
}
