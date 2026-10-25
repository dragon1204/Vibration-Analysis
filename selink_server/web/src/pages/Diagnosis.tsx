import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Empty, Input, List, Modal, Progress, Row, Segmented, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { api, post } from '../api/client'
import { useRealtime } from '../api/realtime'
import { Gauge, SpectrumChart } from '../components/charts'
import { EstimateTag, StatusTag } from '../components/common'
import { useAuth } from '../auth'
import { ago, dt, num } from '../utils/format'
import MachineNav from './MachineNav'

const FAULTS = [
  ['unbalance', 'Mất cân bằng'], ['misalignment', 'Lệch tâm'], ['bent_shaft', 'Trục cong'], ['looseness', 'Lỏng cơ khí'],
  ['bearing_outer', 'Vòng ngoài'], ['bearing_inner', 'Vòng trong'], ['bearing_ball', 'Viên bi'], ['bearing_cage', 'Vòng cách'],
  ['electrical_stator', 'Lỗi điện stator'], ['resonance', 'Cộng hưởng'], ['compressor_mesh_wear', 'Mòn thùy máy nén'], ['other', 'Khác'],
]

export default function Diagnosis() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can } = useAuth()
  const { message } = App.useApp()
  const { data, isLoading } = useQuery<any>({ queryKey: ['diagnosis', id], queryFn: () => api(`/machines/${id}/diagnosis`) })
  useRealtime([`machine:${id}`], (m) => {
    if (m.data.type === 'diagnosis' || m.data.type === 'event') qc.invalidateQueries({ queryKey: ['diagnosis', id] })
  })
  const [sel, setSel] = useState(0)
  const [specType, setSpecType] = useState<'vel' | 'env' | 'acc' | 'iso'>('vel')
  const [axis, setAxis] = useState('x')
  const [fb, setFb] = useState<{ verdict: string; actual?: string; note?: string } | null>(null)
  const diag = data?.diagnoses?.[sel]
  const isBearing = diag?.fault?.startsWith('bearing')
  const { data: spec } = useQuery<any>({
    queryKey: ['spec', diag?.capture_id, specType, axis],
    queryFn: () => api(`/captures/${diag.capture_id}/spectrum`, { params: { type: specType, axis, fmax: 500 } }),
    enabled: !!diag?.capture_id && can('engineer'),
  })
  const { data: cap } = useQuery<any>({
    queryKey: ['capture', diag?.capture_id], queryFn: () => api(`/captures/${diag.capture_id}`), enabled: !!diag?.capture_id,
  })
  const iso = cap?.features?.isolation
  const markers = useMemo(() => {
    if (!spec) return []
    // Highlight markers relevant to the diagnosed fault.
    const want = isBearing ? ['bearing'] : diag?.fault === 'electrical_stator' ? ['electrical', 'order'] : ['order', 'mesh', 'electrical']
    return spec.markers.filter((m: any) => want.includes(m.kind))
  }, [spec, diag, isBearing])

  const sendFeedback = async () => {
    if (!fb || !diag) return
    try {
      await post(`/diagnoses/${diag.id}/feedback`, { verdict: fb.verdict, actual_fault: fb.actual, note: fb.note })
      message.success('Đã ghi nhận phản hồi – dữ liệu dùng để AI học')
      setFb(null)
      qc.invalidateQueries({ queryKey: ['diagnosis', id] })
    } catch (e: any) {
      message.error(e.message)
    }
  }

  if (isLoading || !data) return <div className="page"><MachineNav id={id} /><Spin /></div>
  return (
    <div className="page">
      <MachineNav id={id} />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8} lg={6}>
          <Card size="small" title="Sức khỏe & bất thường">
            <Gauge value={data.health?.health_index} title="Chỉ số sức khỏe (24h)" />
            <div className="muted" style={{ textAlign: 'center' }}>Điểm bất thường AI: <b>{data.health?.anomaly_score != null ? num(data.health.anomaly_score, 2) : 'chưa có'}</b></div>
            {data.rul?.rul_days != null && (
              <Alert style={{ marginTop: 8 }} type="info" showIcon
                message={<span>RUL <EstimateTag />: <b>{num(data.rul.rul_days, 0)} ngày</b></span>}
                description={`Khoảng tin cậy ${num(data.rul.rul_lo_days, 0)}–${num(data.rul.rul_hi_days, 0)} ngày · R² ${num(data.rul.detail?.r2, 2)} · ${data.rul.detail?.feature}`} />
            )}
          </Card>
        </Col>
        <Col xs={24} md={16} lg={18}>
          <Card size="small" title="Nguyên nhân có khả năng (xếp theo độ tin cậy)">
            {data.diagnoses.length === 0 ? <Empty description="Chưa có chẩn đoán – máy đang ở vùng A hoặc chưa đủ dữ liệu" /> : (
              <List dataSource={data.diagnoses} renderItem={(d: any, i: number) => (
                <List.Item onClick={() => setSel(i)} style={{ cursor: 'pointer', background: i === sel ? '#e6f4ff' : undefined, padding: 8 }}
                  actions={can('engineer') ? [
                    <Button key="ok" size="small" onClick={() => { setSel(i); setFb({ verdict: 'correct' }) }}>Đúng</Button>,
                    <Button key="no" size="small" danger onClick={() => { setSel(i); setFb({ verdict: 'wrong' }) }}>Sai</Button>,
                    <Button key="other" size="small" onClick={() => { setSel(i); setFb({ verdict: 'other' }) }}>Lỗi khác</Button>,
                  ] : []}>
                  <List.Item.Meta
                    title={<Space wrap><b>{(d.candidates?.[0]?.label) || d.fault}</b><Tag>{d.point_id}</Tag>
                      <Progress percent={Math.round((d.confidence || 0) * 100)} size="small" style={{ width: 140 }} />
                      {d.feedback && <Tag color={d.feedback.verdict === 'correct' ? 'green' : 'red'}>phản hồi: {d.feedback.verdict}</Tag>}</Space>}
                    description={<><div>{d.recommendation}</div><span className="muted">{ago(d.ts)} · {d.rules_version}</span></>} />
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
        {diag && (
          <>
            <Col xs={24} lg={9}>
              <Card size="small" title="Bằng chứng (luật đã kích hoạt)">
                <Table size="small" pagination={false} rowKey={(r: any) => r.feature + r.note} dataSource={diag.evidence || []} columns={[
                  { title: 'Đặc trưng', dataIndex: 'feature' }, { title: 'Giá trị', dataIndex: 'value', render: (v) => (typeof v === 'number' ? num(v, 3) : v) },
                  { title: 'Tham chiếu', dataIndex: 'ref', render: (v) => (v != null ? num(v, 3) : '') }, { title: 'Ghi chú', dataIndex: 'note' },
                ]} />
                <Alert style={{ marginTop: 8 }} type="warning" showIcon message="Khuyến nghị" description={diag.recommendation} />
                {(diag.candidates || []).length > 1 && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">Khả năng khác: </Typography.Text>
                    {diag.candidates.slice(1, 4).map((c: any) => <Tag key={c.fault}>{c.label} {Math.round(c.confidence * 100)}%</Tag>)}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={15}>
              <Card size="small" title="Phổ minh chứng"
                extra={<Space>
                  <Segmented size="small" value={specType} onChange={(v) => setSpecType(v as any)} options={[
                    { label: 'Vận tốc', value: 'vel' }, { label: 'Phổ bao', value: 'env' }, { label: 'Gia tốc', value: 'acc' },
                    ...(iso ? [{ label: 'Đã cô lập', value: 'iso' }] : [])]} />
                  <Select size="small" value={axis} onChange={setAxis} options={['x', 'y', 'z'].map((a) => ({ value: a, label: a.toUpperCase() }))} />
                </Space>}>
                {!can('engineer') ? <Typography.Text type="secondary">Cần quyền kỹ sư để xem phổ</Typography.Text>
                  : spec ? <SpectrumChart df={spec.df_hz} values={spec.values} unit={spec.unit} markers={markers} speedHz={spec.speed_hz} height={300}
                    csvName={`${diag.capture_id}_${specType}_${axis}.csv`} />
                  : <Empty description="Đang tải / chưa có phổ" />}
                {cap && <div className="muted">Capture {cap.capture_id} · {dt(cap.ts)} · 1X {num(cap.speed_hz, 2)} Hz · vùng {cap.iso_zone}</div>}
              </Card>
            </Col>
          </>
        )}
        {iso && (
          <Col span={24}>
            <Card size="small" title="Cô lập nhiễu đa cảm biến (LOAD tải · BASE đế · DE/NDE ổ đỡ)">
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <p>Tham chiếu bệ: <Tag>{iso.reference_point}</Tag> Nguồn: <Tag>{iso.source_point || '–'}</Tag></p>
                  <p>Hệ số truyền α: {iso.alpha_learned ? <Tag color="green">đã học</Tag> : <Tag color="orange">đang học (A_iso = A thô)</Tag>}</p>
                  {iso.mesh && <p>f_mesh máy nén: <b>{num(iso.mesh.freq_hz, 1)} Hz</b> (kỳ vọng {num(iso.mesh.expected_hz, 1)} Hz,
                    {iso.mesh.match_expected ? ' khớp' : ' lệch'}, {iso.mesh.harmonics} hài)</p>}
                  <p>RMS đã cô lập: <b>{num(iso.iso_vrms_max_mm_s)} mm/s</b> · vùng <b>{iso.zone}</b></p>
                </Col>
                <Col xs={24} md={8}>
                  <Typography.Text strong>Ngưỡng dải hẹp (SOP)</Typography.Text>
                  <Table size="small" pagination={false} rowKey={(r: any) => r.band + r.axis} dataSource={iso.bands || []} columns={[
                    { title: 'Dải', dataIndex: 'band', render: (b) => b.toUpperCase() }, { title: 'Trục', dataIndex: 'axis' },
                    { title: 'mm/s', dataIndex: 'vel_mm_s', render: (v) => num(v, 3) },
                    { title: 'W/A', key: 'l', render: (_, r: any) => `${num(r.warn, 2)} / ${num(r.alarm, 2)}` },
                    { title: 'Mức', dataIndex: 'level', render: (l) => <StatusTag status={l === 'alarm' ? 'warning' : l === 'warning' ? 'watch' : 'normal'} /> },
                  ]} />
                </Col>
                <Col xs={24} md={8}>
                  <Typography.Text strong>Đối chiếu chéo với LOAD</Typography.Text>
                  <div>Đỉnh cục bộ (lỗi thật tại động cơ):</div>
                  {(iso.local_peaks || []).map((p: any) => <Tag color="red" key={'l' + p.freq_hz}>{num(p.freq_hz, 1)} Hz · {num(p.vel_mm_s, 2)}</Tag>)}
                  <div style={{ marginTop: 6 }}>Đỉnh nhiễu truyền từ máy nén (bỏ qua):</div>
                  {(iso.transmitted_peaks || []).map((p: any) => <Tag key={'t' + p.freq_hz}>{num(p.freq_hz, 1)} Hz · {num(p.vel_mm_s, 2)}</Tag>)}
                </Col>
              </Row>
            </Card>
          </Col>
        )}
        <Col span={24}>
          <Card size="small" title="Cảnh báo 7 ngày gần nhất">
            <Table size="small" rowKey="event_id" dataSource={data.events} pagination={{ pageSize: 5 }} columns={[
              { title: 'Thời điểm', dataIndex: 'ts', render: (v) => dt(v) }, { title: 'Mức', dataIndex: 'severity', render: (s) => <StatusTag status={s} /> },
              { title: 'Điểm đo', dataIndex: 'point_id' }, { title: 'Nội dung', dataIndex: 'message' },
              { title: 'Chẩn đoán', dataIndex: 'diagnosis', render: (d) => d?.label || '' },
            ]} />
          </Card>
        </Col>
      </Row>
      <Modal open={!!fb} title="Phản hồi chẩn đoán" onCancel={() => setFb(null)} onOk={sendFeedback} okText="Gửi">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Segmented value={fb?.verdict} onChange={(v) => setFb((f) => ({ ...(f || {}), verdict: String(v) }))}
            options={[{ label: 'Đúng', value: 'correct' }, { label: 'Sai', value: 'wrong' }, { label: 'Lỗi khác', value: 'other' }]} />
          {fb?.verdict !== 'correct' && (
            <Select placeholder="Lỗi thực tế tìm thấy" style={{ width: '100%' }} value={fb?.actual}
              onChange={(v) => setFb((f) => ({ ...(f as any), actual: v }))} options={FAULTS.map(([v, l]) => ({ value: v, label: l }))} />
          )}
          <Input.TextArea placeholder="Ghi chú (kết quả kiểm tra, ảnh, ...)" value={fb?.note}
            onChange={(e) => setFb((f) => ({ ...(f as any), note: e.target.value }))} />
        </Space>
      </Modal>
    </div>
  )
}
