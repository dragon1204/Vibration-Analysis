import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Empty, Progress, Row, Segmented, Space, Table, Tag, Typography } from 'antd'
import { ApiOutlined, NodeIndexOutlined } from '@ant-design/icons'
import { api } from '../api/client'
import { MultiSpectrumChart } from '../components/charts'
import { dt, num } from '../utils/format'
import MachineNav from './MachineNav'

const COLORS = ['#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4d7c0f']

function correlation(a: number[] = [], b: number[] = []) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const x = a.slice(0, n); const y = b.slice(0, n)
  const ax = x.reduce((sum, value) => sum + value, 0) / n
  const ay = y.reduce((sum, value) => sum + value, 0) / n
  let top = 0; let xx = 0; let yy = 0
  for (let i = 0; i < n; i += 1) { const dx = x[i] - ax; const dy = y[i] - ay; top += dx * dy; xx += dx * dx; yy += dy * dy }
  return xx && yy ? top / Math.sqrt(xx * yy) : null
}

export default function DeepAnalysis() {
  const { id = '' } = useParams()
  const [axis, setAxis] = useState('x')
  const [fmax, setFmax] = useState(500)
  const range = useMemo(() => ({ from: new Date(Date.now() - 6 * 3600000).toISOString(), to: new Date().toISOString() }), [])
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const points = machine?.points || []
  const captureQueries = useQueries({ queries: points.map((point: any) => ({
    queryKey: ['deep-captures', point.id], queryFn: () => api<any[]>(`/points/${point.id}/captures`, { params: { ...range, limit: 5 } }),
    refetchInterval: 60_000,
  })) })
  const latest = points.map((point: any, index: number) => ({ point, capture: (captureQueries[index]?.data as any[])?.[0] })).filter((item: any) => item.capture)
  const detailQueries = useQueries({ queries: latest.map((item: any) => ({
    queryKey: ['capture', item.capture.capture_id], queryFn: () => api(`/captures/${item.capture.capture_id}`),
  })) })
  const spectrumQueries = useQueries({ queries: latest.map((item: any) => ({
    queryKey: ['deep-spectrum', item.capture.capture_id, axis, fmax],
    queryFn: () => api(`/captures/${item.capture.capture_id}/spectrum`, { params: { type: 'vel', axis, fmax } }),
  })) })
  const rows = latest.map((item: any, index: number) => {
    const detail: any = detailQueries[index]?.data
    const spectrum: any = spectrumQueries[index]?.data
    const feature = detail?.features?.axes?.[axis] || {}
    return { ...item, detail, spectrum, feature, color: COLORS[index % COLORS.length] }
  })
  const source = rows.find((row: any) => row.point.role === 'source') || rows.find((row: any) => /s1/i.test(row.point.id))
  const base = rows.find((row: any) => row.point.role === 'base') || rows.find((row: any) => /s2/i.test(row.point.id))
  const targets = rows.filter((row: any) => row.point.role === 'bearing')
  const sourceRms = source?.feature?.iso_vrms_mm_s
  const baseRms = base?.feature?.iso_vrms_mm_s
  const matrix = rows.map((row: any) => {
    const rms = row.feature?.iso_vrms_mm_s
    const corr = source?.spectrum && row.spectrum ? correlation(source.spectrum.values, row.spectrum.values) : null
    return {
      key: row.point.id, point: row.point, capture: row.capture, color: row.color, rms,
      one: row.feature?.orders?.['1'], two: row.feature?.orders?.['2'], mesh: row.feature?.mesh_mm_s,
      sourceRatio: sourceRms && rms != null ? rms / sourceRms : null,
      baseRatio: baseRms && rms != null ? rms / baseRms : null, correlation: corr,
    }
  })
  const targetAssessment = targets.map((target: any) => {
    const item = matrix.find((row: any) => row.key === target.point.id)
    if (!item) return null
    const transmitted = (item.correlation || 0) >= 0.8 && (item.baseRatio || 0) <= 1.3
    const local = (item.baseRatio || 0) > 1.45 || ((item.one || 0) / Math.max(item.rms || 1, 0.001)) > 0.9
    return { ...item, transmitted, local }
  }).filter(Boolean) as any[]
  const timestamps = latest.map((item: any) => Date.parse(item.capture.ts)).filter(Number.isFinite)
  const skewMs = timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null
  const markers = rows.find((row: any) => row.spectrum)?.spectrum?.markers || []
  const spectra = rows.filter((row: any) => row.spectrum).map((row: any) => ({
    name: `${row.point.id.toUpperCase()} · ${row.point.name}`, df: row.spectrum.df_hz, values: row.spectrum.values, color: row.color,
  }))
  const complete = points.length > 1 && rows.length === points.length
  // The Beer HN transmission method compares simultaneous captures of several points with roles
  // source (S1) / base (S2) / bearing (S3, S4). With fewer points it has nothing to compare against.
  const hasRef = points.some((p: any) => p.role === 'source' || p.role === 'base')
  const applicable = points.length >= 2 && hasRef
  const roleName = (role: string) => (role === 'source' ? 'Nguồn rung (S1)' : role === 'base' ? 'Tham chiếu bệ (S2)' : 'Gối động cơ')

  return <div className="page deep-analysis-page">
    <MachineNav id={id} />
    <div className="page-hero">
      <div><div className="page-kicker">Cross-channel vibration analysis</div><Typography.Title level={2} style={{ margin: 0 }}>Phân tích sâu đa điểm S1–S4</Typography.Title><p className="page-description">So sánh đồng thời nguồn rung máy nén, bệ đỡ và hai gối động cơ để phân biệt rung truyền và lỗi cục bộ.</p></div>
      <Space><Segmented value={axis} onChange={(value) => setAxis(String(value))} options={['x', 'y', 'z'].map((value) => ({ value, label: `Trục ${value.toUpperCase()}` }))} /><Segmented value={fmax} onChange={(value) => setFmax(Number(value))} options={[250, 500, 1000].map((value) => ({ value, label: `${value} Hz` }))} /></Space>
    </div>
    {!applicable && <Alert type="info" showIcon style={{ marginBottom: 12 }}
      message="Phân tích truyền rung chưa áp dụng cho máy này"
      description={<>Phương pháp so sánh đồng thời nhiều điểm đo: <b>S1</b> nguồn rung (máy nén / máy lân cận), <b>S2</b> bệ đỡ, <b>S3–S4</b> gối động cơ,
        để phân biệt rung <i>truyền sang</i> với lỗi <i>cục bộ</i>. Máy hiện có {points.length} điểm đo
        {hasRef ? '' : ', chưa có điểm vai trò nguồn (source) hoặc bệ (base)'}. Cần ít nhất 2 cảm biến đo đồng thời, trong đó có S1 hoặc S2.
        Dưới đây chỉ hiển thị phổ của từng điểm; xem chẩn đoán đơn điểm ở trang <a href={`/machines/${id}/diagnosis`}>AI chẩn đoán</a>.</>} />}
    {applicable && !complete && <Alert type="info" showIcon message="Đang ghép capture mới nhất của các điểm đo" description={`Đã có ${rows.length}/${points.length} điểm. Capture nhóm từ gateway sẽ cho kết quả tốt nhất.`} style={{ marginBottom: 12 }} />}
    <div className="sensor-flow">
      {rows.map((row: any, index: number) => <div className="sensor-flow-node" key={row.point.id} style={{ borderColor: row.color }}><span>{row.point.id.split('-').pop()?.toUpperCase()}</span><b>{row.point.name}</b><small>{roleName(row.point.role)} · trục {axis.toUpperCase()}</small><strong>{num(row.feature?.iso_vrms_mm_s, 2)} mm/s <small>RMS ISO</small></strong>{index < rows.length - 1 && <NodeIndexOutlined className="sensor-flow-arrow" />}</div>)}
    </div>
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={17}><Card title={`${spectra.length > 1 ? 'Phổ vận tốc chồng các điểm đo' : 'Phổ vận tốc'} · trục ${axis.toUpperCase()}`} extra={latest.length > 1 && <Tag color={skewMs != null && skewMs < 10_000 ? 'success' : 'warning'}>Lệch capture {num((skewMs ?? 0) / 1000, 2)} s</Tag>}>
        {spectra.length ? <MultiSpectrumChart spectra={spectra} markers={markers} fmax={fmax} /> : <Empty description="Chưa có phổ để so sánh" />}
      </Card></Col>
      <Col xs={24} xl={7}><Card title="Kết luận truyền rung" className="assessment-card">
        {!applicable ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Cần ≥ 2 điểm đo đồng thời (có S1 hoặc S2) để kết luận rung truyền hay cục bộ" />
          : targetAssessment.length ? targetAssessment.map((item) => <Alert key={item.key} style={{ marginBottom: 10 }} showIcon
          type={item.local && !item.transmitted ? 'warning' : 'info'}
          message={`${item.point.id.split('-').pop()?.toUpperCase()}: ${item.transmitted ? 'thiên về rung truyền' : item.local ? 'có thành phần cục bộ' : 'cần thêm capture đồng bộ'}`}
          description={`Tương đồng phổ với S1 ${item.correlation == null ? '—' : `${num(item.correlation * 100, 0)}%`} · so S1 ${item.sourceRatio == null ? '—' : `${num(item.sourceRatio, 2)}×`} · so S2 ${item.baseRatio == null ? '—' : `${num(item.baseRatio, 2)}×`}`} />) : <Empty description="Chưa đủ S1/S2/S3/S4" />}
        {applicable && <Alert type="warning" showIcon icon={<ApiOutlined />} message="Lưu ý kỹ thuật" description="Tương đồng phổ không thay thế coherence/pha. Kết luận chính thức cần capture nhóm đồng bộ từ gateway." />}
      </Card></Col>
      <Col span={24}><Card title="Ma trận đặc trưng đa điểm"><Table rowKey="key" size="small" pagination={false} dataSource={matrix} scroll={{ x: 980 }} columns={[
        { title: 'Điểm', render: (_, row: any) => <Space><span className="series-dot" style={{ background: row.color }} /><b>{row.point.id.toUpperCase()}</b><span>{row.point.name}</span></Space> },
        { title: 'Vai trò', render: (_, row: any) => <Tag>{roleName(row.point.role)}</Tag> },
        { title: 'RMS ISO', dataIndex: 'rms', render: (value) => `${num(value, 3)} mm/s` },
        { title: '1X', dataIndex: 'one', render: (value) => `${num(value, 3)} mm/s` },
        { title: '2X', dataIndex: 'two', render: (value) => `${num(value, 3)} mm/s` },
        { title: 'f_mesh', dataIndex: 'mesh', render: (value) => value == null ? '—' : `${num(value, 3)} mm/s` },
        { title: 'So S1', dataIndex: 'sourceRatio', render: (value) => value == null ? '—' : <Progress percent={Math.min(100, Math.round(value * 100))} size="small" format={() => `${num(value, 2)}×`} /> },
        { title: 'So S2', dataIndex: 'baseRatio', render: (value) => value == null ? '—' : `${num(value, 2)}×` },
        { title: 'Tương đồng phổ', dataIndex: 'correlation', render: (value) => value == null ? '—' : `${num(value * 100, 0)}%` },
        { title: 'Capture', dataIndex: 'capture', render: (value) => <span className="muted">{dt(value.ts)}</span> },
      ]} /></Card></Col>
    </Row>
  </div>
}
