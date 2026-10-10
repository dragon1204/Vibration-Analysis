import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { api, post } from '../api/client'
import { useRealtime } from '../api/realtime'
import { useAuth } from '../auth'
import { ago, dt, num } from '../utils/format'

export default function Devices() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const [open, setOpen] = useState<string>()
  const [cmd, setCmd] = useState<{ type: string; point_id?: string; profile?: string; url?: string; sha256?: string; machine_id?: string } | null>(null)
  const { data = [], isLoading } = useQuery<any[]>({ queryKey: ['gateways'], queryFn: () => api('/gateways'), refetchInterval: 30_000 })
  const { data: gw } = useQuery<any>({ queryKey: ['gateway', open], queryFn: () => api(`/gateways/${open}`), enabled: !!open })
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
  return (
    <div className="page">
      <Card size="small" title="Gateway (T153)">
        <Table size="small" rowKey="id" loading={isLoading} dataSource={data}
          onRow={(r) => ({ onClick: () => setOpen(r.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Gateway', dataIndex: 'id' }, { title: 'Site', dataIndex: 'site_id' },
            { title: 'Trạng thái', dataIndex: 'online', render: (o) => (o ? <Tag color="green">Trực tuyến</Tag> : <Tag>Mất kết nối</Tag>) },
            { title: 'Phiên bản', dataIndex: 'fw_version' }, { title: 'Liên lạc cuối', dataIndex: 'last_seen', render: (v) => ago(v) },
            { title: 'Outbox', key: 'ob', render: (_, r: any) => r.health?.outbox_pending ?? '–' },
            { title: 'CPU / RAM', key: 'cpu', render: (_, r: any) => r.health ? `${num(r.health.cpu_pct, 0)}% / ${num(r.health.mem_rss_mb, 0)} MB` : '–', responsive: ['md'] },
            { title: 'Mạng', key: 'net', render: (_, r: any) => r.health ? `${r.health.net_iface || ''} ${r.health.rssi_dbm != null ? num(r.health.rssi_dbm, 0) + ' dBm' : ''}` : '–', responsive: ['lg'] },
            { title: 'Điểm đo', dataIndex: 'points' }, { title: 'Cấu hình', dataIndex: 'config_version', render: (v) => `v${v}` },
          ]} />
      </Card>
      <Drawer open={!!open} width={720} onClose={() => setOpen(undefined)} title={`Gateway ${open}`}>
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
            </Descriptions>
            <Table size="small" pagination={false} rowKey="id" title={() => 'Cảm biến'} dataSource={gw.points} columns={[
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
    </div>
  )
}
