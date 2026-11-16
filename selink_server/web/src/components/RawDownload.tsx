import { useState } from 'react'
import { Button, Dropdown, message } from 'antd'
import { download } from '../api/client'

/** Download every RAWFIFO sample of one capture (counts, g, m/s²) as Excel or CSV. */
export function RawDownload({ captureId, pointId, ts }: { captureId?: string; pointId?: string; ts?: string }) {
  const [busy, setBusy] = useState(false)
  if (!captureId) return null
  const stamp = ts ? new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/[-:]/g, '').replace(' ', '-') : captureId
  const get = (format: 'xlsx' | 'csv') => {
    setBusy(true)
    download(`/captures/${captureId}/waveform/export`, `${pointId || 'capture'}_song-tho_${stamp}.${format}`, { format })
      .catch((e) => message.error(`Không tải được sóng thô: ${e?.message || e}`))
      .finally(() => setBusy(false))
  }
  return (
    <Dropdown trigger={['click']} menu={{
      items: [{ key: 'xlsx', label: 'Excel (.xlsx)' }, { key: 'csv', label: 'CSV (.csv)' }],
      onClick: ({ key }) => get(key as 'xlsx' | 'csv'),
    }}>
      <Button size="small" loading={busy}>Tải sóng thô ▾</Button>
    </Dropdown>
  )
}
