import { useParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Empty, Progress, Row, Statistic, Tag, Typography } from 'antd'
import { api, post } from '../api/client'
import { TrendChart } from '../components/charts'
import { useAuth } from '../auth'
import { dt, num } from '../utils/format'
import MachineNav from './MachineNav'

// Requirements mirrored from the analytics service (analytics/service.py job_baseline_learn + anomaly.rul_exponential).
const BASELINE_MIN_CAPTURES = 200
const RUL_MIN_CAPTURES = 30
const RUL_MIN_DAYS = 14
const RUL_MIN_R2 = 0.7

const STATUS_TEXT: Record<string, string> = {
  ok: 'Đã tính được',
  no_active_baseline: 'Chưa có baseline hiệu lực',
  no_reliable_trend: 'Chưa có xu hướng đủ tin cậy',
  insufficient_samples: `Chưa đủ ${RUL_MIN_CAPTURES} capture sạch`,
  insufficient_time_bins: 'Dữ liệu chưa trải đủ 10 ngày khác nhau',
  insufficient_span: `Dữ liệu chưa trải đủ ${RUL_MIN_DAYS} ngày`,
  poor_fit: `Xu hướng không khớp mô hình (R² < ${RUL_MIN_R2})`,
  no_significant_positive_trend: 'Rung không có xu hướng tăng rõ – máy ổn định',
  weak_monotonic_trend: 'Xu hướng tăng yếu, chưa đơn điệu',
  too_many_outliers: 'Quá nhiều điểm bất thường trong dữ liệu',
  unstable_bootstrap: 'Khoảng tin cậy không ổn định',
  horizon_too_long: 'Còn rất xa ngưỡng (> 10 năm)',
  threshold_reached: 'Đã chạm ngưỡng cảnh báo',
  invalid_threshold: 'Ngưỡng baseline không hợp lệ',
}

function Step({ done, title, children, percent }: { done: boolean; title: string; children: React.ReactNode; percent?: number }) {
  return (
    <div className="rul-step">
      <div className={`rul-step-icon ${done ? 'done' : ''}`}>{done ? 'ĐẠT' : 'CHỜ'}</div>
      <div className="rul-step-body">
        <b>{title}</b>
        <div className="muted">{children}</div>
        {percent != null && !done && <Progress percent={Math.min(100, Math.round(percent))} size="small" style={{ maxWidth: 360 }} />}
      </div>
    </div>
  )
}

export default function Rul() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const to = new Date()
  const from = new Date(to.getTime() - 180 * 86400000)
  const { data: machine } = useQuery<any>({ queryKey: ['machine', id], queryFn: () => api(`/machines/${id}`) })
  const { data: diagnosis } = useQuery<any>({ queryKey: ['diagnosis', id], queryFn: () => api(`/machines/${id}/diagnosis`) })
  const { data: history = [] } = useQuery<any[]>({ queryKey: ['health-rul', id], queryFn: () => api(`/machines/${id}/health`, { params: { from: from.toISOString(), to: to.toISOString() } }) })
  const { data: baselines = [] } = useQuery<any[]>({ queryKey: ['baselines', id], queryFn: () => api('/baselines', { params: { machine_id: id } }) })
  const bearingPoints = (machine?.points || []).filter((p: any) => (p.role || 'bearing') === 'bearing')
  const capQueries: { data?: any }[] = useQueries({
    queries: bearingPoints.map((p: any) => ({
      queryKey: ['rul-caps', p.id],
      queryFn: () => api(`/points/${p.id}/captures`, { params: { from: from.toISOString(), to: to.toISOString(), limit: 2000 } }),
    })),
  })

  const current = diagnosis?.rul
  const detail = current?.detail || {}
  const hasValue = current?.rul_days != null
  const series = history.filter((row) => row.rul_days != null).map((row) => [row.ts, row.rul_days] as [string, number])

  // Progress towards the prerequisites (best point).
  const caps: any[] = capQueries.flatMap((q) => (q.data as any[]) || []).filter((c) => c.running !== false)
  const nCaps = caps.length
  const times = caps.map((c) => Date.parse(c.ts)).filter(Number.isFinite)
  const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 86400000 : 0
  const isoBaselines = baselines.filter((b) => ['iso_vrms_mm_s', 'env.bpfo', 'env.bpfi'].includes(b.feature))
  const activeBaseline = isoBaselines.find((b) => b.status === 'active')
  const learning = isoBaselines.sort((a, b) => (b.n_samples || 0) - (a.n_samples || 0))[0]
  const baselineN = activeBaseline?.n_samples ?? learning?.n_samples ?? nCaps
  const trendCandidate = (detail.candidates || []).find((c: any) => c.r2 != null)
  const r2 = detail.r2 ?? trendCandidate?.r2
  const statusKey = hasValue ? 'ok' : (detail.candidates || []).find((c: any) => c.status)?.status || detail.status
  const notComputed = <span className="muted" style={{ fontSize: 15 }}>Chưa tính được</span>

  return <div className="page">
    <MachineNav id={id} />
    <div className="page-hero">
      <div><div className="page-kicker">Phân tích tiên lượng</div><Typography.Title level={2} style={{ margin: 0 }}>Dự đoán tuổi thọ còn lại (RUL)</Typography.Title>
        <p className="page-description">{machine?.name || id} · thời gian ước tính cho tới khi rung chạm <b>ngưỡng cảnh báo của baseline</b>, kèm khoảng tin cậy 95%. Đây không phải tuổi thọ hỏng hóc được chứng nhận.</p></div>
      {can('analyst') && <Button type="primary" onClick={async () => { await post('/analytics/run', { job: 'rul_estimate' }); message.success('Đã xếp hàng tính lại RUL'); setTimeout(() => qc.invalidateQueries({ queryKey: ['diagnosis', id] }), 2500) }}>Tính lại RUL</Button>}
    </div>
    <Row gutter={[14, 14]}>
      <Col xs={24} md={8}><Card><Statistic title="RUL ước lượng" value={hasValue ? current.rul_days : undefined} precision={0} suffix={hasValue ? 'ngày' : undefined} formatter={hasValue ? undefined : () => notComputed} />
        <div className="muted">{current ? `Lần tính gần nhất: ${dt(current.ts)}` : 'Chưa chạy lần tính nào'}</div>
        {statusKey && <Tag style={{ marginTop: 8 }} color={hasValue ? 'blue' : 'default'}>{STATUS_TEXT[statusKey] || statusKey}</Tag>}</Card></Col>
      <Col xs={12} md={5}><Card><Statistic title="Cận dưới (95%)" value={hasValue ? current.rul_lo_days : undefined} precision={0} suffix={hasValue ? 'ngày' : undefined} formatter={hasValue ? undefined : () => '—'} /></Card></Col>
      <Col xs={12} md={5}><Card><Statistic title="Cận trên (95%)" value={hasValue ? current.rul_hi_days : undefined} precision={0} suffix={hasValue ? 'ngày' : undefined} formatter={hasValue ? undefined : () => '—'} /></Card></Col>
      <Col xs={24} md={6}><Card title="Cơ sở tính"><div><Tag color="blue">{detail.feature || 'Vận tốc RMS ISO / phổ bao vòng bi'}</Tag></div>
        <div className="muted" style={{ marginTop: 10 }}>Ngưỡng: {detail.threshold == null ? (activeBaseline?.alarm != null ? `${num(activeBaseline.alarm, 2)} (alarm baseline)` : '—') : num(detail.threshold, 3)}<br />
          R²: {r2 == null ? '—' : num(r2, 2)} · số ngày dữ liệu: {num(detail.span_days ?? spanDays, 1)}</div></Card></Col>

      {!hasValue && <Col span={24}><Card title="Điều kiện để tính RUL">
        <Step done={!!activeBaseline} title="1. Học baseline (trạng thái bình thường của máy)" percent={(baselineN / BASELINE_MIN_CAPTURES) * 100}>
          {activeBaseline ? `Baseline hiệu lực · ${activeBaseline.n_samples} capture · ngưỡng alarm ${num(activeBaseline.alarm, 2)}`
            : `Cần ≥ ${BASELINE_MIN_CAPTURES} capture khi máy đang chạy ổn định (hiện ${baselineN}). Với 1 capture/phút cần khoảng ${num(BASELINE_MIN_CAPTURES / 60, 1)} giờ máy chạy; baseline được học trong 28 ngày đầu kể từ capture đầu tiên hoặc lần bảo trì có reset baseline.`}
        </Step>
        <Step done={nCaps >= RUL_MIN_CAPTURES && spanDays >= RUL_MIN_DAYS} title={`2. Dữ liệu xu hướng ≥ ${RUL_MIN_DAYS} ngày`} percent={(Math.min(spanDays / RUL_MIN_DAYS, nCaps / RUL_MIN_CAPTURES)) * 100}>
          Cần ≥ {RUL_MIN_CAPTURES} capture sạch trải trên ≥ 10 ngày khác nhau và tổng ≥ {RUL_MIN_DAYS} ngày, cùng chế độ tốc độ. Hiện có {nCaps} capture trong {num(spanDays, spanDays < 1 ? 2 : 1)} ngày.
        </Step>
        <Step done={r2 != null && r2 >= RUL_MIN_R2} title="3. Rung có xu hướng tăng rõ ràng">
          Mô hình chỉ đưa ra RUL khi rung đang tăng dần và khớp đường xu hướng (R² ≥ {RUL_MIN_R2}). Máy ổn định, không tăng, thì không có RUL – đó là tín hiệu tốt.
        </Step>
      </Card></Col>}

      <Col span={24}><Card title="Lịch sử RUL 180 ngày">
        {series.length ? <TrendChart height={340} yName="ngày" series={[{ name: 'RUL', data: series, color: '#3270ed' }]} />
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có giá trị RUL nào – xem các điều kiện ở trên" />}
        {hasValue && detail.confidence && <Alert style={{ marginTop: 10 }} type="info" showIcon message={`Độ tin cậy: ${detail.confidence === 'high' ? 'cao' : detail.confidence === 'medium' ? 'trung bình' : 'thấp'}`} />}
      </Card></Col>
    </Row>
  </div>
}
