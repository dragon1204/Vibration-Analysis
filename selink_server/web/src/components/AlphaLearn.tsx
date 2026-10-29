import { useState } from 'react'
import dayjs from 'dayjs'
import { Alert, Button, Modal, Segmented, Space, Table, Tag, Typography } from 'antd'
import { api } from '../api/client'
import { RangePicker, rangeParams, type Range } from './common'

const AXIS = { x: 'X dọc trục', y: 'Y ngang', z: 'Z đứng' } as Record<string, string>
const DURATIONS = [15, 30, 60]

/** Learn α = RMS(DE) / RMS(BASE) from a window where this machine is stopped; preview first, then apply. */
export default function AlphaLearn({ machineId, current, onApply }: { machineId: string; current: number; onApply: (alpha: number) => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState<number | 'custom'>(30)
  const [range, setRange] = useState<Range>([dayjs().subtract(30, 'minute'), dayjs()])
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const window = (): Range => (minutes === 'custom' ? range : [dayjs().subtract(minutes, 'minute'), dayjs()])
  const run = () => {
    setBusy(true); setError(''); setResult(null)
    api(`/machines/${machineId}/alpha-learn`, { params: rangeParams(window()) })
      .then(setResult).catch((e) => setError(e.message)).finally(() => setBusy(false))
  }
  const learned: number | null = result?.learned ?? null
  const change = learned != null && current > 0 ? ((learned - current) / current) * 100 : null

  return <>
    <Button size="small" onClick={() => { setOpen(true); setResult(null); setError('') }}>Học hệ số α</Button>
    <Modal open={open} width={760} title="Học hệ số truyền BASE → ổ đỡ (α)" onCancel={() => setOpen(false)}
      footer={<Space>
        <Button onClick={() => setOpen(false)}>Đóng</Button>
        <Button onClick={run} loading={busy}>Tính α</Button>
        <Button type="primary" disabled={learned == null} onClick={() => learned != null && onApply(learned).then(() => setOpen(false))}>
          {learned != null ? `Áp dụng α = ${learned.toFixed(2)}` : 'Áp dụng'}</Button>
      </Space>}>
      <Typography.Paragraph type="secondary">
        Chọn khoảng thời gian <b>máy này đang dừng</b> nhưng các máy lân cận vẫn chạy. Khi đó rung ở DE chỉ là rung truyền từ đế,
        nên α = RMS(DE) ÷ RMS(BASE). Máy chạy trong khoảng này hoặc rung BASE quá nhỏ (sát nhiễu cảm biến) thì không học được.
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <span className="muted">Thời gian học</span>
          <Segmented value={minutes} onChange={(v) => setMinutes(v as number | 'custom')}
            options={[...DURATIONS.map((m) => ({ value: m, label: `${m} phút gần nhất` })), { value: 'custom', label: 'Tùy chọn' }]} />
        </Space>
        {minutes === 'custom' && <RangePicker value={range} onChange={setRange} />}
        {error && <Alert type="error" showIcon message={error} />}
        {result && <>
          <div className="alpha-change">
            <div><span>Hiện tại</span><b>{current > 0 ? current.toFixed(2) : 'tắt'}</b></div>
            <div className="alpha-arrow">→</div>
            <div><span>Học được</span><b>{learned != null ? learned.toFixed(2) : '–'}</b></div>
            {change != null && <Tag color={Math.abs(change) < 10 ? 'green' : 'gold'}>{change >= 0 ? '+' : ''}{change.toFixed(0)} %</Tag>}
          </div>
          <div className="muted">Máy chạy {result.running_pct}% thời gian trong khoảng đã chọn · α chung = trung bình các trục ISO ({(result.iso_axes || []).map((a: string) => a.toUpperCase()).join(', ')})</div>
          {(result.warnings || []).map((w: string) => <Alert key={w} type="warning" showIcon message={w} />)}
          <Table size="small" pagination={false} rowKey="axis" dataSource={Object.entries(result.axes).map(([axis, v]: any) => ({ axis, ...v }))} columns={[
            { title: 'Trục', dataIndex: 'axis', render: (a) => AXIS[a] || a },
            { title: 'α', dataIndex: 'alpha', render: (v, r: any) => v != null ? <b>{v.toFixed(2)}</b> : <span className="muted">{r.alpha_raw != null ? `(${r.alpha_raw.toFixed(2)})` : '–'}</span> },
            { title: 'Khoảng 25–75 %', dataIndex: 'spread', render: (s) => s ? `${s[0].toFixed(2)}–${s[1].toFixed(2)}` : '–' },
            { title: 'DE (mm/s)', dataIndex: 'de_mm_s', render: (v) => v?.toFixed(3) ?? '–' },
            { title: 'BASE (mm/s)', dataIndex: 'base_mm_s', render: (v) => v?.toFixed(3) ?? '–' },
            { title: 'Cặp mẫu', dataIndex: 'pairs' },
            { title: 'Ghi chú', dataIndex: 'reason', render: (v) => v ? <span className="muted">{v}</span> : <Tag color="green">đạt</Tag> },
          ]} />
        </>}
      </Space>
    </Modal>
  </>
}
