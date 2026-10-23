import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { api, post } from '../api/client'
import { ago } from '../utils/format'

const MAC_RE = /^([0-9a-f]{2}[:-]?){5}[0-9a-f]{2}$/i
const normMac = (v: string) => v.replace(/[^0-9a-f]/gi, '').toLowerCase().replace(/(..)(?=.)/g, '$1:')

/** Zero-touch enrolment: a new gateway plugged into any LAN announces its MAC; the admin adds it here by MAC. */
export default function AddGateway() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [mac, setMac] = useState('')
  const [site, setSite] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<any>()
  const { data: pending = [] } = useQuery<any[]>({ queryKey: ['provision-pending'], queryFn: () => api('/provision/pending'), refetchInterval: 10_000 })
  const { data: sites = [] } = useQuery<any[]>({ queryKey: ['sites'], queryFn: () => api('/sites') })
  const valid = MAC_RE.test(mac.trim())
  const siteId = site || (sites.length === 1 ? sites[0].id : undefined)

  const claim = async () => {
    setBusy(true)
    try {
      const r = await post('/provision/claim', { mac: normMac(mac.trim()), site_id: siteId })
      setDone(r)
      setMac('')
      message.success(`Đã thêm ${r.gateway_id}`)
      qc.invalidateQueries({ queryKey: ['provision-pending'] })
      qc.invalidateQueries({ queryKey: ['gateways'] })
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card size="small" title="Thêm gateway bằng MAC" style={{ marginBottom: 12 }}>
      <Space wrap>
        <Input placeholder="MAC, ví dụ 02:00:10:85:97:67" value={mac} onChange={(e) => setMac(e.target.value)} onPressEnter={() => valid && claim()}
          status={mac && !valid ? 'error' : undefined} style={{ width: 280 }} allowClear />
        {sites.length > 1 && <Select placeholder="Khu vực" style={{ width: 220 }} value={site} onChange={setSite}
          options={sites.map((s: any) => ({ value: s.id, label: s.name || s.id }))} />}
        <Button type="primary" disabled={!valid || !siteId} loading={busy} onClick={claim}>Thêm gateway</Button>
      </Space>
      {done && <Alert style={{ marginTop: 10 }} type="success" showIcon closable onClose={() => setDone(undefined)}
        message={`Đã thêm gateway ${done.gateway_id} (MAC ${done.mac})`} description={done.note} />}
      {pending.length > 0 && (
        <Table size="small" style={{ marginTop: 12 }} rowKey="mac" pagination={false} dataSource={pending}
          title={() => <b>Gateway mới phát hiện (chưa thêm)</b>}
          onRow={(r: any) => ({ onClick: () => setMac(r.mac), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'MAC', dataIndex: 'mac', render: (v) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Serial', dataIndex: 'serial', render: (v) => v || '–' },
            { title: 'IP trong LAN', dataIndex: 'local_ips', render: (v: string[]) => (v || []).join(', ') || '–' },
            { title: 'IP công cộng', dataIndex: 'ip' },
            { title: 'Báo danh', dataIndex: 'last_seen', render: (v, r: any) => <Space size={4}>{ago(v)}{r.fresh ? <Tag color="green">sẵn sàng</Tag> : <Tag>quá 15 phút</Tag>}</Space> },
          ]} />
      )}
    </Card>
  )
}
